'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Smartphone, AlertCircle, ShieldCheck } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import { supabase } from '@/services/supabase';
import CouponPicker, { type AppliedCoupon } from '@/components/client/CouponPicker';
import { whatsappLink } from '@/config/store';
import styles from './page.module.css';

/**
 * A loja aceita SOMENTE pagamento pelo site. Não existe mais "pagar na
 * entrega": nem Pix ou cartão na maquininha do entregador, nem dinheiro.
 *
 * Por isso esta tela não é mais uma escolha entre formas de pagamento — é
 * uma confirmação. O que ela ainda precisa decidir é se dá para pagar
 * AGORA: sem a InfinitePay configurada não existe caminho nenhum, e é
 * melhor dizer isso aqui do que deixar o cliente montar o pedido e tomar
 * erro no fim.
 */
type StatusPagamento = 'verificando' | 'ok' | 'indisponivel';

export default function PagamentoPage() {
  const router = useRouter();
  const {
    items,
    cartSubtotal,
    deliveryFee,
    address,
    deliveryType,
    customerName,
    customerPhone,
  } = useCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [statusPagamento, setStatusPagamento] = useState<StatusPagamento>('verificando');

  useEffect(() => {
    fetch('/api/pagamento/status')
      .then((r) => r.json())
      .then((d) => setStatusPagamento(d.enabled ? 'ok' : 'indisponivel'))
      .catch(() => setStatusPagamento('indisponivel'));
  }, []);

  // Mesma conta do banco: total = subtotal + frete - desconto.
  // Aqui é só para exibir — quem manda é o create_order.
  const discount = coupon?.discount ?? 0;
  const total = Math.max(cartSubtotal + deliveryFee - discount, 0);

  useEffect(() => {
    if (isSubmitting) return;

    if (items.length === 0) {
      router.replace('/pedido');
      return;
    }

    // O carrinho é persistido no localStorage, mas nome/telefone/endereço não.
    // Num F5 nesta página eles voltam vazios: antes isso gerava um pedido sem
    // cliente, e agora faria a RPC recusar com um erro que não ajuda ninguém.
    if (!customerName || !customerPhone) {
      router.replace('/pedido/checkout/endereco');
    }
  }, [items, router, isSubmitting, customerName, customerPhone]);

  if (items.length === 0 || !customerName || !customerPhone) {
    return null;
  }

  const buildAddressLine = () => {
    if (deliveryType === 'pickup') return 'RETIRADA NO LOCAL';

    const complement = address.complement ? ` - ${address.complement}` : '';
    return `${address.street}, ${address.number}${complement} - ${address.neighborhood}`;
  };

  const processOrder = async () => {
    if (isSubmitting || statusPagamento !== 'ok') return;
    setIsSubmitting(true);

    try {
      // Monta a descrição legível de cada item ("Pizza 1: Calabresa, Mussarela")
      const orderItems = items.map((item: any) => {
        const detailsParts: string[] = [];

        if (item.selections && Object.keys(item.selections).length > 0) {
          Object.entries(item.selections).forEach(([groupId, options]: [string, any]) => {
            const group = item.product.complements?.find((g: any) => g.id === groupId);
            const groupLabel = group?.name || 'Opções';
            const selectedFlavors = options.map((opt: any) => opt.name).join(', ');
            detailsParts.push(`${groupLabel}: ${selectedFlavors}`);
          });
        } else if (item.flavors && item.flavors.length > 0) {
          detailsParts.push(`Sabores: ${item.flavors.join(', ')}`);
        }

        if (item.customizations && item.customizations.length > 0) {
          const paidExtras = item.customizations
            .filter((c: any) => c.price > 0)
            .map((c: any) => c.name)
            .join(', ');

          if (paidExtras) detailsParts.push(`Adicionais: ${paidExtras}`);
        }

        if (item.observation) detailsParts.push(`Obs: ${item.observation}`);

        // IDs das opções escolhidas: é com eles que o banco recalcula o preço.
        // Nenhum valor em reais sai daqui — quem soma é o create_order().
        const optionIds = item.selections
          ? Object.values(item.selections)
              .flat()
              .map((opt: any) => opt?.id)
              .filter(Boolean)
          : [];

        return {
          product_id: item.product.id,
          quantity: item.quantity,
          observation: detailsParts.join('\n'),
          option_ids: optionIds,
          customizations: item.customizations || {},
        };
      });

      // Uma chamada só: pedido + itens na mesma transação, preço vindo do banco.
      // Se qualquer item falhar, nada é gravado (antes sobrava pedido sem itens).
      const { data: orderId, error } = await supabase.rpc('create_order', {
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_customer_address: buildAddressLine(),
        p_payment_method: 'Pago online',
        p_delivery_type: deliveryType,
        p_neighborhood: deliveryType === 'delivery' ? address.neighborhood : null,
        p_items: orderItems,
        // Só o código. O desconto quem calcula é o banco.
        p_coupon_code: coupon?.code ?? null,
        p_payment_flow: 'online',
      });

      if (error) throw error;

      // Guarda para o cliente conseguir acompanhar o pedido depois
      const savedOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
      if (!savedOrders.includes(orderId)) {
        savedOrders.push(orderId);
        localStorage.setItem('my_orders', JSON.stringify(savedOrders));
      }
      localStorage.setItem('customer_phone', customerPhone);

      // O pedido existe, mas em AWAITING: não vale nada até o dinheiro
      // entrar. O carrinho SÓ é limpo depois do pagamento confirmar, na
      // tela de retorno — senão quem desiste no checkout perde tudo.
      const resposta = await fetch('/api/pagamento/criar-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.url) {
        throw new Error(dados.error || 'Não foi possível iniciar o pagamento.');
      }

      // O total desta tela vem do carrinho no localStorage; o que a
      // operadora vai cobrar vem do banco. Se divergirem (preço mudou
      // com a aba aberta), o cliente precisa aprovar antes — senão ele
      // clica achando que paga X e cai num checkout de Y.
      const cobrado = Number(dados.total ?? 0);

      if (Math.abs(cobrado - total) > 0.005) {
        const fmt = (v: number) =>
          v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const segue = window.confirm(
          `O valor do seu pedido foi atualizado.\n\n` +
          `Nesta tela: ${fmt(total)}\nA pagar: ${fmt(cobrado)}\n\n` +
          `Deseja continuar para o pagamento?`
        );

        if (!segue) {
          setIsSubmitting(false);
          return;
        }
      }

      window.location.href = dados.url;
    } catch (error: any) {
      console.error('Erro ao processar pedido:', error);
      // O banco devolve mensagens já em português ("A loja está fechada no momento")
      alert('Erro ao realizar pedido: ' + (error.message || 'Tente novamente.'));
      setIsSubmitting(false);
    }
  };

  const moeda = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <Link href="/pedido/checkout/endereco" className={styles.iconBtn}>
          <ArrowLeft size={24} />
        </Link>
        <h1>Pagamento</h1>
        <div style={{width: 24}}/>
      </header>

      <div className={styles.content}>
        <h2 className={styles.sectionTitle}>Pagamento pelo site</h2>
        <p className={styles.subtitle}>
          O pagamento é feito agora, na finalização. Assim que confirmar, seu pedido
          vai direto para a cozinha.
        </p>

        <div className={styles.options}>
          {statusPagamento === 'verificando' && (
            <div className={styles.option}>
              <div className={styles.iconBox}><Loader2 size={24} className={styles.spin} /></div>
              <div className={styles.info}>
                <span>Carregando formas de pagamento...</span>
              </div>
            </div>
          )}

          {statusPagamento === 'ok' && (
            <div className={`${styles.option} ${styles.optionOnline} ${styles.active}`}>
              <div className={styles.iconBox}><Smartphone size={24} /></div>
              <div className={styles.info}>
                <span>Pagar agora <small className={styles.badgeOnline}>Pix ou cartão</small></span>
                <small>Você escolhe entre Pix e cartão na próxima tela</small>
              </div>
            </div>
          )}

          {statusPagamento === 'indisponivel' && (
            <div className={styles.aviso}>
              <div className={styles.avisoIcone}><AlertCircle size={22} /></div>
              <div>
                <strong>Pagamento indisponível no momento</strong>
                <p>
                  Não conseguimos abrir o pagamento agora. Seu carrinho está salvo —
                  tente de novo em alguns minutos ou fale com a gente.
                </p>
                <a
                  href={whatsappLink('Oi! Quero fazer um pedido mas o pagamento não abriu no site')}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.avisoLink}
                >
                  Falar com a loja no WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>

        {statusPagamento === 'ok' && (
          <p className={styles.seguranca}>
            <ShieldCheck size={15} /> Pagamento processado pela InfinitePay. A loja não
            recebe os dados do seu cartão.
          </p>
        )}

        <div className={styles.couponSection}>
          <h2 className={styles.sectionTitle}>Cupom de desconto</h2>
          <CouponPicker
            subtotal={cartSubtotal}
            deliveryFee={deliveryFee}
            phone={customerPhone}
            deliveryType={deliveryType}
            applied={coupon}
            onApply={setCoupon}
          />
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.summaryLine}>
          <span>Subtotal</span>
          <span>{moeda(cartSubtotal)}</span>
        </div>
        <div className={styles.summaryLine}>
          <span>{deliveryType === 'pickup' ? 'Retirada no local' : 'Taxa de entrega'}</span>
          <span>{deliveryFee > 0 ? `+ ${moeda(deliveryFee)}` : 'Grátis'}</span>
        </div>
        {discount > 0 && (
          <div className={`${styles.summaryLine} ${styles.discountLine}`}>
            <span>Cupom {coupon?.code}</span>
            <span>- {moeda(discount)}</span>
          </div>
        )}
        <div className={styles.totalRow}>
          <span>Total a pagar</span>
          <span className={styles.totalValue}>{moeda(total)}</span>
        </div>
        <button
          className={styles.finishBtn}
          onClick={processOrder}
          disabled={isSubmitting || statusPagamento !== 'ok'}
          style={{ opacity: isSubmitting || statusPagamento !== 'ok' ? 0.6 : 1 }}
        >
          {isSubmitting ? (
            <span style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <Loader2 className={styles.spin} size={20} /> Enviando...
            </span>
          ) : statusPagamento === 'verificando' ? (
            'Aguarde...'
          ) : statusPagamento === 'indisponivel' ? (
            'Pagamento indisponível'
          ) : (
            `Pagar ${moeda(total)}`
          )}
        </button>
      </div>
    </main>
  );
}

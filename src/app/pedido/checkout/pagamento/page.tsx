'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Smartphone,
  AlertCircle,
  ShieldCheck,
  Check,
  Banknote,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import { supabase } from '@/services/supabase';
import CouponPicker, { type AppliedCoupon } from '@/components/client/CouponPicker';
import { whatsappLink } from '@/config/store';
import styles from './page.module.css';

/**
 * A loja aceita duas formas de pagamento:
 *
 *   ONLINE (Pix/cartão pela InfinitePay) — o pedido nasce em AWAITING e só
 *   chega à cozinha quando o dinheiro entra.
 *
 *   DINHEIRO na entrega/retirada — o pedido nasce em ON_DELIVERY e cai na
 *   cozinha na hora; quem cobra é o entregador.
 *
 * Pix e cartão NA MÃO DO ENTREGADOR não existem: dependem de maquininha e
 * de conferência que ninguém faz na porta. Quem garante isso não é esta
 * tela (ela roda no navegador do cliente) e sim o trigger da migration 12
 * — ver supabase/12-aceitar-dinheiro.sql.
 *
 * Consequência: o pagamento online pode estar indisponível (handle da
 * InfinitePay não configurada) sem travar a loja — o dinheiro segue de pé.
 */
type StatusOnline = 'verificando' | 'ok' | 'indisponivel';
type Forma = 'online' | 'dinheiro';
type Troco = 'sem' | 'com';

/**
 * Lê o valor do troco digitado pelo cliente.
 *
 * "50,00" e "1.500,00" seguem o padrão daqui: a vírgula é o decimal e o
 * ponto é milhar. Mas quem digita no teclado do computador escreve
 * "50.00" — tratar esse ponto como milhar virava 5000, e o pedido saía
 * pedindo troco para R$ 5.000.
 */
const parseMoedaBR = (texto: string): number => {
  const limpo = texto.replace(/[^\d.,]/g, '');
  if (!limpo) return NaN;

  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo.replace(/\.(?=\d{3}(\D|$))/g, '');

  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : NaN;
};

const moeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
    customerEmail,
    clearCart,
  } = useCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [statusOnline, setStatusOnline] = useState<StatusOnline>('verificando');

  const [forma, setForma] = useState<Forma>('online');
  const [troco, setTroco] = useState<Troco | null>(null);
  const [trocoPara, setTrocoPara] = useState('');

  useEffect(() => {
    fetch('/api/pagamento/status')
      .then((r) => r.json())
      .then((d) => {
        const habilitado = Boolean(d.enabled);
        setStatusOnline(habilitado ? 'ok' : 'indisponivel');
        // Sem online configurado, deixar 'online' pré-selecionado daria um
        // botão que não leva a lugar nenhum. Cai para dinheiro.
        if (!habilitado) setForma('dinheiro');
      })
      .catch(() => {
        setStatusOnline('indisponivel');
        setForma('dinheiro');
      });
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

  const trocoValor = parseMoedaBR(trocoPara);

  /**
   * O texto que vai para o cupom impresso e para o painel. O formato é
   * lido de volta pelo printReceipt (`Troco para R$ ...` / `Sem troco`),
   * então mexer aqui pede mexer lá.
   */
  const buildPaymentMethod = () => {
    if (forma === 'online') return 'Pago online';
    if (troco === 'com') {
      return `Dinheiro - Troco para R$ ${trocoValor.toFixed(2).replace('.', ',')}`;
    }
    return 'Dinheiro - Sem troco';
  };

  const processOrder = async () => {
    if (isSubmitting) return;
    if (forma === 'online' && statusOnline !== 'ok') return;

    // Sem escolha explícita de troco, o entregador sai sem saber se leva
    // ou não. Era o que o modal antigo forçava — aqui o botão trava até
    // o cliente responder.
    if (forma === 'dinheiro' && !troco) {
      alert('Diga se você precisa de troco.');
      return;
    }

    if (forma === 'dinheiro' && troco === 'com' && !(trocoValor >= total)) {
      alert(
        `O valor do troco precisa ser maior ou igual ao total do pedido (${moeda(total)}).`
      );
      return;
    }

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
        p_payment_method: buildPaymentMethod(),
        p_delivery_type: deliveryType,
        p_neighborhood: deliveryType === 'delivery' ? address.neighborhood : null,
        p_items: orderItems,
        // Só o código. O desconto quem calcula é o banco.
        p_coupon_code: coupon?.code ?? null,
        p_payment_flow: forma === 'online' ? 'online' : 'on_delivery',
      });

      if (error) throw error;

      // Guarda para o cliente conseguir acompanhar o pedido depois
      const savedOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
      if (!savedOrders.includes(orderId)) {
        savedOrders.push(orderId);
        localStorage.setItem('my_orders', JSON.stringify(savedOrders));
      }
      localStorage.setItem('customer_phone', customerPhone);

      // DINHEIRO: o pedido já nasce valendo (ON_DELIVERY) e cai na cozinha.
      // Não há checkout de operadora para esperar, então o carrinho pode
      // ser limpo aqui mesmo.
      if (forma === 'dinheiro') {
        clearCart();
        router.push('/pedido/historico');
        return;
      }

      // ONLINE: o pedido existe, mas em AWAITING: não vale nada até o
      // dinheiro entrar. O carrinho SÓ é limpo depois do pagamento
      // confirmar, na tela de retorno — senão quem desiste no checkout
      // perde tudo.
      const resposta = await fetch('/api/pagamento/criar-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // E-mail e CEP não viram dinheiro e não ficam no pedido: servem só
        // para o checkout da operadora abrir com contato e entrega
        // preenchidos. Por isso vão por aqui em vez de passar pelo banco.
        body: JSON.stringify({
          orderId,
          email: customerEmail || undefined,
          address: deliveryType === 'delivery' ? address : undefined,
        }),
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
        const segue = window.confirm(
          `O valor do seu pedido foi atualizado.\n\n` +
          `Nesta tela: ${moeda(total)}\nA pagar: ${moeda(cobrado)}\n\n` +
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

  const naEntrega = deliveryType === 'pickup' ? 'na retirada' : 'na entrega';

  const textoBotao = () => {
    if (isSubmitting) return null;
    if (statusOnline === 'verificando') return 'Aguarde...';
    if (forma === 'dinheiro') return 'Fazer pedido';
    return `Pagar ${moeda(total)}`;
  };

  // O troco NÃO trava o botão de propósito: botão cinza sem explicação é
  // beco sem saída. Quem barra é o processOrder, dizendo o que falta.
  const botaoTravado =
    isSubmitting ||
    statusOnline === 'verificando' ||
    (forma === 'online' && statusOnline !== 'ok');

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
        <h2 className={styles.sectionTitle}>Como você quer pagar?</h2>
        <p className={styles.subtitle}>
          Pague agora pelo site ou em dinheiro {naEntrega}.
        </p>

        <div className={styles.options}>
          {statusOnline === 'verificando' && (
            <div className={styles.option}>
              <div className={styles.iconBox}><Loader2 size={22} className={styles.spin} /></div>
              <div className={styles.info}>
                <span>Carregando formas de pagamento...</span>
              </div>
            </div>
          )}

          {/* PAGAR AGORA — o selo da InfinitePay mora dentro do card; solto
              embaixo, lia como aviso avulso. */}
          {statusOnline === 'ok' && (
            <div className={`${styles.payCard} ${forma === 'online' ? styles.payCardAtivo : ''}`}>
              <button
                type="button"
                className={styles.payMain}
                onClick={() => setForma('online')}
                aria-pressed={forma === 'online'}
              >
                <div className={styles.iconBox}><Smartphone size={22} /></div>
                <div className={styles.info}>
                  <span>Pagar agora</span>
                  <small>Você escolhe a forma na próxima tela</small>
                  <div className={styles.chips}>
                    <span className={styles.chip}>Pix</span>
                    <span className={styles.chip}>Cartão</span>
                  </div>
                </div>
                <div className={styles.radio}>
                  {forma === 'online' && <Check size={13} strokeWidth={3.5} />}
                </div>
              </button>
              <p className={styles.payFoot}>
                <ShieldCheck size={14} /> Processado pela InfinitePay — a loja não
                recebe os dados do seu cartão.
              </p>
            </div>
          )}

          {/* DINHEIRO — existe sempre, inclusive quando o online está fora.
              É o plano B que a loja não tinha. */}
          {statusOnline !== 'verificando' && (
            <div className={`${styles.payCard} ${forma === 'dinheiro' ? styles.payCardAtivo : ''}`}>
              <button
                type="button"
                className={styles.payMain}
                onClick={() => setForma('dinheiro')}
                aria-pressed={forma === 'dinheiro'}
              >
                <div className={styles.iconBox}><Banknote size={22} /></div>
                <div className={styles.info}>
                  <span>Dinheiro</span>
                  <small>Você paga {naEntrega}, em espécie</small>
                </div>
                <div className={styles.radio}>
                  {forma === 'dinheiro' && <Check size={13} strokeWidth={3.5} />}
                </div>
              </button>

              {forma === 'dinheiro' && (
                <div className={styles.trocoBox}>
                  <p className={styles.trocoPergunta}>Precisa de troco?</p>

                  <div className={styles.trocoOpcoes}>
                    <button
                      type="button"
                      className={`${styles.trocoBtn} ${troco === 'sem' ? styles.trocoBtnAtivo : ''}`}
                      onClick={() => { setTroco('sem'); setTrocoPara(''); }}
                    >
                      Não preciso
                    </button>
                    <button
                      type="button"
                      className={`${styles.trocoBtn} ${troco === 'com' ? styles.trocoBtnAtivo : ''}`}
                      onClick={() => setTroco('com')}
                    >
                      Preciso de troco
                    </button>
                  </div>

                  {troco === 'com' && (
                    <div className={styles.trocoCampo}>
                      <label htmlFor="troco-para">Vou pagar com</label>
                      <div className={styles.trocoInput}>
                        <span>R$</span>
                        <input
                          id="troco-para"
                          type="text"
                          inputMode="decimal"
                          placeholder="Ex: 100,00"
                          value={trocoPara}
                          onChange={(e) => setTrocoPara(e.target.value)}
                        />
                      </div>

                      {/* O cliente vê a conta antes de mandar o pedido: sem
                          isso, digitar menos que o total só aparecia como
                          erro no clique do botão. */}
                      {trocoPara.trim() !== '' && (
                        Number.isFinite(trocoValor) && trocoValor >= total ? (
                          <small className={styles.trocoOk}>
                            Troco de {moeda(trocoValor - total)}
                          </small>
                        ) : (
                          <small className={styles.trocoErro}>
                            Precisa ser pelo menos {moeda(total)}
                          </small>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {statusOnline === 'indisponivel' && (
            <div className={styles.aviso}>
              <div className={styles.avisoIcone}><AlertCircle size={22} /></div>
              <div>
                <strong>Pagamento pelo site indisponível agora</strong>
                <p>
                  Não conseguimos abrir o Pix/cartão neste momento — dá para
                  fechar o pedido em dinheiro. Se preferir pagar pelo site,
                  tente de novo em alguns minutos.
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
          disabled={botaoTravado}
          style={{ opacity: botaoTravado ? 0.6 : 1 }}
        >
          {isSubmitting ? (
            <span style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <Loader2 className={styles.spin} size={20} /> Enviando...
            </span>
          ) : (
            textoBotao()
          )}
        </button>
      </div>
    </main>
  );
}

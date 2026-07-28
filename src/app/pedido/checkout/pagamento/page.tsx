'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Banknote, QrCode, X, Loader2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import { supabase } from '@/services/supabase';
import CouponPicker, { type AppliedCoupon } from '@/components/client/CouponPicker';
import styles from './page.module.css';

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
    clearCart
  } = useCart();
  
  const [method, setMethod] = useState('pix');
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [changeValue, setChangeValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

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

  const handlePreFinish = () => {
    if (method === 'cash') {
      setIsCashModalOpen(true);
    } else {
      processOrder(getMethodLabel(method));
    }
  };

  const getMethodLabel = (key: string) => {
    switch (key) {
      case 'pix': return 'Pix'; 
      case 'card': return 'Cartão'; 
      case 'cash': return 'Dinheiro'; 
      default: return 'Dinheiro';
    }
  };

  const confirmChange = () => {
    if (!changeValue) return alert('Digite o valor para o troco');
    
    const valString = changeValue.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(valString);

    if (isNaN(val) || val < total) {
      return alert(`O valor deve ser maior ou igual ao total do pedido (${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`);
    }
    
    processOrder('Dinheiro', `Troco para R$ ${changeValue}`);
  };

  const confirmNoChange = () => {
    processOrder('Dinheiro', 'Sem troco');
  };

  const buildAddressLine = () => {
    if (deliveryType === 'pickup') return 'RETIRADA NO LOCAL';

    const complement = address.complement ? ` - ${address.complement}` : '';
    return `${address.street}, ${address.number}${complement} - ${address.neighborhood}`;
  };

  const processOrder = async (paymentMethodLabel: string, changeInfo: string = '') => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const finalPaymentMethod = changeInfo
        ? `${paymentMethodLabel} - ${changeInfo}`
        : paymentMethodLabel;

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
        p_payment_method: finalPaymentMethod,
        p_delivery_type: deliveryType,
        p_neighborhood: deliveryType === 'delivery' ? address.neighborhood : null,
        p_items: orderItems,
        // Só o código. O desconto quem calcula é o banco.
        p_coupon_code: coupon?.code ?? null,
      });

      if (error) throw error;

      // Guarda para o cliente conseguir acompanhar o pedido depois
      const savedOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
      if (!savedOrders.includes(orderId)) {
        savedOrders.push(orderId);
        localStorage.setItem('my_orders', JSON.stringify(savedOrders));
      }
      localStorage.setItem('customer_phone', customerPhone);

      clearCart();
      router.push('/pedido/historico');

    } catch (error: any) {
      console.error('Erro ao processar pedido:', error);
      // O banco devolve mensagens já em português ("A loja está fechada no momento")
      alert('Erro ao realizar pedido: ' + (error.message || 'Tente novamente.'));
      setIsSubmitting(false);
    }
  };

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
        <h2 className={styles.sectionTitle}>Pagamento na Entrega</h2>
        <p className={styles.subtitle}>Escolha como deseja pagar ao receber seu pedido.</p>
        
        <div className={styles.options}>
          <button className={`${styles.option} ${method === 'pix' ? styles.active : ''}`} onClick={() => setMethod('pix')}>
            <div className={styles.iconBox}><QrCode size={24} /></div>
            <div className={styles.info}><span>Pix</span><small>Pague ao entregador</small></div>
            <div className={styles.radio}>{method === 'pix' && <div className={styles.dot}/>}</div>
          </button>
          <button className={`${styles.option} ${method === 'card' ? styles.active : ''}`} onClick={() => setMethod('card')}>
            <div className={styles.iconBox}><CreditCard size={24} /></div>
            <div className={styles.info}><span>Cartão</span><small>Levamos a maquininha</small></div>
            <div className={styles.radio}>{method === 'card' && <div className={styles.dot}/>}</div>
          </button>
          <button className={`${styles.option} ${method === 'cash' ? styles.active : ''}`} onClick={() => setMethod('cash')}>
            <div className={styles.iconBox}><Banknote size={24} /></div>
            <div className={styles.info}><span>Dinheiro</span><small>Precisa de troco?</small></div>
            <div className={styles.radio}>{method === 'cash' && <div className={styles.dot}/>}</div>
          </button>
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
          <span>{cartSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        <div className={styles.summaryLine}>
          <span>{deliveryType === 'pickup' ? 'Retirada no local' : 'Taxa de entrega'}</span>
          <span>{deliveryFee > 0 ? `+ ${deliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : 'Grátis'}</span>
        </div>
        {discount > 0 && (
          <div className={`${styles.summaryLine} ${styles.discountLine}`}>
            <span>Cupom {coupon?.code}</span>
            <span>- {discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        )}
        <div className={styles.totalRow}>
          <span>Total a pagar</span>
          <span className={styles.totalValue}>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        <button 
          className={styles.finishBtn} 
          onClick={handlePreFinish}
          disabled={isSubmitting}
          style={{ opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting ? (
            <span style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <Loader2 className={styles.spin} size={20} /> Enviando...
            </span>
          ) : 'Fazer Pedido'}
        </button>
      </div>

      {isCashModalOpen && (
        <div className={styles.modalOverlay} onClick={(e) => { if(e.target === e.currentTarget) setIsCashModalOpen(false); }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}><h3>Pagamento em Dinheiro</h3><button onClick={() => setIsCashModalOpen(false)}><X size={24} /></button></div>
            <div className={styles.modalBody}>
              <p>Você vai precisar de troco?</p>
              <button className={styles.noChangeBtn} onClick={confirmNoChange} disabled={isSubmitting}>Não preciso de troco</button>
              <div className={styles.divider}><span>OU</span></div>
              <div className={styles.changeInputGroup}>
                <label>Preciso de troco para:</label>
                <div className={styles.inputWrapper}><span>R$</span><input type="text" placeholder="Ex: 50,00" value={changeValue} onChange={(e) => setChangeValue(e.target.value)} autoFocus inputMode="decimal"/></div>
                <button className={styles.confirmChangeBtn} onClick={confirmChange} disabled={isSubmitting}>{isSubmitting ? 'Confirmando...' : 'Confirmar Valor'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
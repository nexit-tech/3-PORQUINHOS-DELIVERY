'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Banknote, QrCode, X, Loader2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import { supabase } from '@/services/supabase';
import styles from './page.module.css';

export default function PagamentoPage() {
  const router = useRouter();
  const { 
    items, 
    cartSubtotal, 
    deliveryFee, 
    address, 
    customerName, 
    customerPhone,
    clearCart 
  } = useCart();
  
  const [method, setMethod] = useState('pix');
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [changeValue, setChangeValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const total = cartSubtotal + deliveryFee;

  useEffect(() => {
    if (items.length === 0 && !isSubmitting) {
      router.replace('/pedido');
    }
  }, [items, router, isSubmitting]);

  if (items.length === 0) {
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

  const processOrder = async (paymentMethodLabel: string, changeInfo: string = '') => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const finalPaymentMethod = changeInfo 
        ? `${paymentMethodLabel} - ${changeInfo}`
        : paymentMethodLabel;

      const orderPayload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: `${address.street}, ${address.number} ${address.complement ? `- ${address.complement}` : ''} - ${address.neighborhood}`,
        payment_method: finalPaymentMethod,
        delivery_fee: deliveryFee,
        total: total,
        status: 'PENDING'
      };

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();

      if (orderError) throw orderError;

      const orderId = orderData.id;

      // Salva ID do pedido no localStorage
      const savedOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
      if (!savedOrders.includes(orderId)) {
        savedOrders.push(orderId);
        localStorage.setItem('my_orders', JSON.stringify(savedOrders));
      }

      // 🔥 NOVO: Salva o telefone do cliente para buscar pedidos futuros
      localStorage.setItem('customer_phone', customerPhone);

      // 🔥 FORMATAÇÃO CORRIGIDA COM "Pizza 1", "Pizza 2", etc
      const orderItems = items.map((item: any) => {
        const detailsParts = [];
        
        // 🎯 NOVA LÓGICA: Formata grupos separadamente (Pizza 1, Pizza 2, etc)
        if (item.selections && Object.keys(item.selections).length > 0) {
          Object.entries(item.selections).forEach(([groupId, options]: [string, any]) => {
            // Busca o nome do grupo (ex: "Pizza 1", "Pizza 2")
            const group = item.product.complements?.find((g: any) => g.id === groupId);
            const groupLabel = group?.name || 'Opções';
            
            // Lista os sabores selecionados
            const selectedFlavors = options.map((opt: any) => opt.name).join(', ');
            
            // Adiciona a linha formatada: "Pizza 1: Calabresa, Mussarela"
            detailsParts.push(`${groupLabel}: ${selectedFlavors}`);
          });
        } else if (item.flavors && item.flavors.length > 0) {
          // Fallback antigo (se não tiver selections)
          detailsParts.push(`Sabores: ${item.flavors.join(', ')}`);
        }
        
        // Adicionais pagos (se houver)
        if (item.customizations && item.customizations.length > 0) {
          const paidExtras = item.customizations
            .filter((c: any) => c.price > 0)
            .map((c: any) => c.name)
            .join(', ');
          
          if (paidExtras) {
            detailsParts.push(`Adicionais: ${paidExtras}`);
          }
        }

        // Observação do cliente
        if (item.observation) {
          detailsParts.push(`Obs: ${item.observation}`);
        }
        
        // 🔥 USA QUEBRA DE LINHA PARA SEPARAR
        const detailsString = detailsParts.join('\n');

        return {
          order_id: orderId,
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.totalPrice / item.quantity,
          total_price: item.totalPrice,
          observation: detailsString, // 🎯 AQUI VAI A FORMATAÇÃO CORRETA
          customizations: item.customizations || {}
        };
      });

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      clearCart();
      router.push('/pedido/historico');

    } catch (error: any) {
      console.error('Erro ao processar pedido:', error);
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
      </div>

      <div className={styles.footer}>
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
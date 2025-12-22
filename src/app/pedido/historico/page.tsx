'use client';

import { useCart } from '@/context/CartContext';
import { Package, CheckCircle, MapPin, ChefHat, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.css';

export default function HistoricoPage() {
  const { orders } = useCart();

  const getStatusStep = (status: string) => {
    switch(status) {
      case 'recebido': return 0;
      case 'preparando': return 1;
      case 'saiu': return 2;
      case 'entregue': return 3;
      default: return 0;
    }
  };

  // Função para abrir WhatsApp
  const openHelp = (orderId: string) => {
    const phone = '5521973896869';
    const text = `Preciso de ajuda com meu pedido ${orderId}`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (orders.length === 0) {
    return (
      <div className={styles.empty}>
        <Package size={64} color="var(--border-color)" />
        <h2>Nenhum pedido ainda</h2>
        <p>Seus pedidos recentes aparecerão aqui.</p>
        <Link href="/pedido" className={styles.backBtn}>Fazer Pedido</Link>
      </div>
    );
  }

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Meus Pedidos</h1>

      <div className={styles.list}>
        {orders.map(order => {
          const step = getStatusStep(order.status);
          
          return (
            <div key={order.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.orderId}>Pedido {order.id}</span>
                <span className={styles.date}>
                  {order.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>

              {/* PROGRESSO */}
              <div className={styles.stepper}>
                <div className={`${styles.step} ${step >= 0 ? styles.stepActive : ''}`}>
                  <div className={styles.iconCircle}><CheckCircle size={16}/></div>
                  <span>Recebido</span>
                </div>
                <div className={`${styles.line} ${step >= 1 ? styles.lineActive : ''}`} />
                <div className={`${styles.step} ${step >= 1 ? styles.stepActive : ''}`}>
                  <div className={styles.iconCircle}><ChefHat size={16}/></div>
                  <span>Prep.</span>
                </div>
                <div className={`${styles.line} ${step >= 2 ? styles.lineActive : ''}`} />
                <div className={`${styles.step} ${step >= 2 ? styles.stepActive : ''}`}>
                  <div className={styles.iconCircle}><MapPin size={16}/></div>
                  <span>Saiu</span>
                </div>
              </div>

              <div className={styles.itemsSummary}>
                {order.items.map((item, idx) => (
                  <p key={idx}>{item.quantity}x {item.product.name}</p>
                ))}
              </div>

              <div className={styles.infoRow}>
                <small>Pagamento:</small>
                <strong>{order.paymentMethod}</strong>
              </div>

              <div className={styles.cardFooter}>
                <div className={styles.totalWrapper}>
                  <small>Total</small>
                  <span className={styles.total}>
                    {order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                {/* BOTÃO DE AJUDA WHATSAPP */}
                <button 
                  className={styles.helpBtn} 
                  onClick={() => openHelp(order.id)}
                >
                  <MessageCircle size={18} />
                  Ajuda com o pedido
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
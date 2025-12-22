'use client';

import { ArrowLeft, ShoppingBag, MessageCircle } from 'lucide-react'; // Importei MessageCircle pro ícone do Zap
import Link from 'next/link';
import { useOrders } from '@/hooks/useOrders';
import styles from './page.module.css';

function getStatusInfo(status: string) {
  switch (status) {
    case 'PENDING': return { label: 'Aguardando confirmação', color: '#f59e0b', bg: '#fffbeb' };
    case 'PREPARING': return { label: 'Em preparação', color: '#3b82f6', bg: '#eff6ff' };
    case 'DELIVERING': return { label: 'Saiu para entrega', color: '#8b5cf6', bg: '#f5f3ff' };
    case 'COMPLETED': return { label: 'Finalizado', color: '#10b981', bg: '#ecfdf5' };
    case 'CANCELED': return { label: 'Cancelado', color: '#ef4444', bg: '#fef2f2' };
    default: return { label: 'Processando', color: '#6b7280', bg: '#f3f4f6' };
  }
}

export default function HistoricoPage() {
  const { orders, loading } = useOrders();

  const handleHelpClick = (orderId: string) => {
    // Remove o '#' visual se tiver
    const cleanId = orderId.replace('#', '');
    const message = `Preciso de ajuda com o pedido #${cleanId}`;
    const url = `https://wa.me/5521973896869?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <Link href="/pedido" className={styles.iconBtn}>
          <ArrowLeft size={24} />
        </Link>
        <h1>Meus Pedidos</h1>
        <div style={{width: 24}}/>
      </header>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}><p>Carregando pedidos...</p></div>
        ) : orders.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><ShoppingBag size={48} /></div>
            <h2>Nenhum pedido ainda</h2>
            <p>Seus pedidos recentes aparecerão aqui.</p>
            <Link href="/pedido" className={styles.ctaBtn}>Fazer Pedido</Link>
          </div>
        ) : (
          <div className={styles.list}>
            {orders.map(order => {
              const statusInfo = getStatusInfo(order.status);
              
              return (
                <div key={order.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.orderId}>Pedido {order.id}</span>
                    <span className={styles.date}>{order.createdAt}</span>
                  </div>

                  <div className={styles.statusRow}>
                    <span className={styles.statusBadge} style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className={styles.itemsList}>
                    {order.items.map((item, idx) => (
                      <div key={idx} className={styles.itemWrapper}>
                        <div className={styles.itemRow}>
                          <span className={styles.qtd}>{item.quantity}x</span>
                          <span className={styles.prodName}>{item.name}</span>
                        </div>
                        {item.observation && (
                          <div className={styles.itemObs}>
                            {item.observation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className={styles.divider} />

                  <div className={styles.cardFooter}>
                    <div className={styles.totalInfo}>
                      <span>Total</span>
                      <strong>{order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                  </div>

                  {/* BOTÃO DE AJUDA NO WHATSAPP */}
                  <button 
                    className={styles.helpBtn}
                    onClick={() => handleHelpClick(order.id)}
                  >
                    <MessageCircle size={18} />
                    Ajuda com o pedido
                  </button>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
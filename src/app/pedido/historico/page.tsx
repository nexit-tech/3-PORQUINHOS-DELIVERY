'use client';

import { ArrowLeft, ShoppingBag, MessageCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useOrders } from '@/hooks/useOrders';
import { whatsappLink } from '@/config/store';
import styles from './page.module.css';

function getStatusInfo(status: string) {
  switch (status) {
    case 'PENDING': return { label: 'Aguardando confirmação', tom: styles.tomAmbar };
    case 'PREPARING': return { label: 'Em preparação', tom: styles.tomAzul };
    case 'DELIVERING': return { label: 'Saiu para entrega', tom: styles.tomRoxo };
    case 'COMPLETED': return { label: 'Finalizado', tom: styles.tomVerde };
    case 'CANCELED': return { label: 'Cancelado', tom: styles.tomVermelho };
    default: return { label: 'Processando', tom: styles.tomNeutro };
  }
}

const moeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function HistoricoPage() {
  // Pedido sem pagamento nem chega aqui: o useOrders filtra os AWAITING e
  // manda expirar os abandonados antes de listar.
  const { orders, loading } = useOrders();

  const handleHelpClick = (orderId: string | number) => {
    const cleanId = String(orderId).replace('#', '');
    window.open(whatsappLink(`Oi! Preciso de ajuda com o pedido ${cleanId}`), '_blank');
  };

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <Link href="/pedido" className={styles.iconBtn} aria-label="Voltar">
          <ArrowLeft size={20} />
        </Link>
        <h1>Meus Pedidos</h1>
        <div className={styles.headerSpacer} />
      </header>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <Loader2 size={20} className={styles.spin} /> Carregando pedidos...
          </div>
        ) : orders.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><ShoppingBag size={40} /></div>
            <h2>Nenhum pedido ainda</h2>
            <p>Seus pedidos confirmados aparecem aqui.</p>
            <Link href="/pedido" className={styles.ctaBtn}>Fazer pedido</Link>
          </div>
        ) : (
          <div className={styles.list}>
            {orders.map(order => {
              const statusInfo = getStatusInfo(order.status);

              return (
                <article key={order.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.orderId}>Pedido {order.id}</span>
                    <span className={styles.date}>{order.createdAt}</span>
                  </div>

                  <span className={`${styles.statusBadge} ${statusInfo.tom}`}>
                    {statusInfo.label}
                  </span>

                  <div className={styles.itemsList}>
                    {order.items.map((item, idx) => (
                      <div key={idx} className={styles.itemWrapper}>
                        <div className={styles.itemRow}>
                          <span className={styles.qtd}>{item.quantity}x</span>
                          <span className={styles.prodName}>{item.name}</span>
                        </div>
                        {item.observation && (
                          <div className={styles.itemObs}>{item.observation}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className={styles.resumo}>
                    {order.discount > 0 && (
                      <div className={`${styles.resumoLinha} ${styles.linhaCupom}`}>
                        <span>Cupom {order.couponCode}</span>
                        <span>- {moeda(order.discount)}</span>
                      </div>
                    )}
                    <div className={`${styles.resumoLinha} ${styles.linhaTotal}`}>
                      <span>Total</span>
                      <strong>{moeda(order.total)}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.helpBtn}
                    onClick={() => handleHelpClick(order.id)}
                  >
                    <MessageCircle size={16} />
                    Ajuda com o pedido
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

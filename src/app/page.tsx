'use client';

import { useOrders } from '@/hooks/useOrders';
import OrderCard from '@/components/admin/OrderCard';
// REMOVIDO: import Container ... 
import styles from './page.module.css';
import { ClipboardList, ChefHat, Bike } from 'lucide-react';

export default function AdminDashboard() {
  const { orders, updateStatus } = useOrders();

  const pending = orders.filter(o => o.status === 'PENDING');
  const preparing = orders.filter(o => o.status === 'PREPARING');
  const delivering = orders.filter(o => o.status === 'DELIVERING');

  return (
    <div className={styles.pageWrapper}>
      {/* Container removido. O wrapper agora cuida do padding. */}
      
      <header className={styles.topHeader}>
        <h1>Monitor de Pedidos</h1>
      </header>
      
      <div className={styles.board}>
        {/* Coluna 1: Pendentes */}
        <section className={styles.column}>
          <div className={styles.colHeader}>
            <h2 className={styles.colTitle}>
              <div className={styles.titleIcon}>
                <ClipboardList color="#fbbc05" size={20} />
                <span>Pendentes</span>
              </div>
              <span className={styles.count}>{pending.length}</span>
            </h2>
          </div>
          <div className={styles.colContent}>
            {pending.map(order => (
              <OrderCard key={order.id} order={order} onUpdateStatus={updateStatus} />
            ))}
          </div>
        </section>

        {/* Coluna 2: Em Preparo */}
        <section className={styles.column}>
          <div className={styles.colHeader}>
            <h2 className={styles.colTitle}>
              <div className={styles.titleIcon}>
                <ChefHat color="#3b82f6" size={20} />
                <span>Cozinha</span>
              </div>
              <span className={styles.count}>{preparing.length}</span>
            </h2>
          </div>
          <div className={styles.colContent}>
            {preparing.map(order => (
              <OrderCard key={order.id} order={order} onUpdateStatus={updateStatus} />
            ))}
          </div>
        </section>

        {/* Coluna 3: Em Rota */}
        <section className={styles.column}>
          <div className={styles.colHeader}>
            <h2 className={styles.colTitle}>
              <div className={styles.titleIcon}>
                <Bike color="#10b981" size={20} />
                <span>Em Rota</span>
              </div>
              <span className={styles.count}>{delivering.length}</span>
            </h2>
          </div>
          <div className={styles.colContent}>
            {delivering.map(order => (
              <OrderCard key={order.id} order={order} onUpdateStatus={updateStatus} />
            ))}
          </div>
        </section>
      </div>

    </div>
  );
}
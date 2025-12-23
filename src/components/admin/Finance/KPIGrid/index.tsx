import React from 'react';
import styles from './styles.module.css';

interface KPIGridProps {
  totalRevenue: number;
  totalOrders: number;
  averageTicket: number;
}

export default function KPIGrid({ totalRevenue, totalOrders, averageTicket }: KPIGridProps) {
  return (
    <div className={styles.kpiGrid}>
      {/* Card 1: Faturamento */}
      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          Faturamento Total
        </div>
        <strong>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}
        </strong>
      </div>

      {/* Card 2: Pedidos */}
      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          Pedidos Finalizados
        </div>
        <strong>{totalOrders}</strong>
      </div>

      {/* Card 3: Ticket Médio */}
      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          Ticket Médio
        </div>
        <strong>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(averageTicket)}
        </strong>
      </div>
    </div>
  );
}
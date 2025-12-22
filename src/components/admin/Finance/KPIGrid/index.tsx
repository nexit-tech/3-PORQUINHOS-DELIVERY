import { DollarSign, BarChart3, CreditCard } from 'lucide-react';
import styles from './styles.module.css';

interface KPIGridProps {
  revenue: number;
  orders: number;
  ticket: number;
}

export default function KPIGrid({ revenue, orders, ticket }: KPIGridProps) {
  return (
    <div className={styles.kpiGrid}>
      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          <span>Faturamento</span>
          <div className={styles.iconBox} style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
            <DollarSign size={20} />
          </div>
        </div>
        <strong>R$ {revenue.toFixed(2)}</strong>
        <span className={styles.trendUp}>+12% vs mês anterior</span>
      </div>

      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          <span>Pedidos</span>
          <div className={styles.iconBox} style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}>
            <BarChart3 size={20} />
          </div>
        </div>
        <strong>{orders}</strong>
        <span className={styles.trendNeutral}>Estável</span>
      </div>

      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          <span>Ticket Médio</span>
          <div className={styles.iconBox} style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}>
            <CreditCard size={20} />
          </div>
        </div>
        <strong>R$ {ticket.toFixed(2)}</strong>
        <span className={styles.trendUp}>+5% vs mês anterior</span>
      </div>
    </div>
  );
}
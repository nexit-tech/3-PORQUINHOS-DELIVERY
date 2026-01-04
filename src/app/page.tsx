'use client';

import { useState, useEffect, useRef } from 'react';
import { useAdminOrders } from '@/hooks/useAdminOrders'; // 🔥 NOVO HOOK
import OrderCard from '@/components/admin/OrderCard';
import styles from './page.module.css';
import { ClipboardList, ChefHat, Bike, Volume2 } from 'lucide-react';

export default function AdminDashboard() {
  // 🔥 USA O HOOK ADMIN AGORA
  const { orders, updateStatus } = useAdminOrders(true);

  // Lógica de Notificação Sonora
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [prevCount, setPrevCount] = useState(0);
  const [firstLoad, setFirstLoad] = useState(true);

  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.load();
  }, []);

  useEffect(() => {
    if (!orders) return;

    if (firstLoad) {
      setPrevCount(orders.length);
      setFirstLoad(false);
      return;
    }

    if (orders.length > prevCount) {
      audioRef.current?.play().catch(err => {
        console.warn("Autoplay bloqueado pelo navegador.", err);
      });
    }

    setPrevCount(orders.length);
  }, [orders, prevCount, firstLoad]);

  // Filtros de Status
  const pending = orders.filter(o => o.status === 'PENDING');
  const preparing = orders.filter(o => o.status === 'PREPARING');
  const delivering = orders.filter(o => o.status === 'DELIVERING');

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.topHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1>Monitor de Pedidos</h1>
          <div title="Notificação sonora ativa" style={{ padding: '8px', background: '#e0f2fe', borderRadius: '50%', display: 'flex' }}>
            <Volume2 size={18} color="#0284c7" />
          </div>
        </div>
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
            {pending.length === 0 && (
              <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: '20px' }}>Sem pedidos pendentes</p>
            )}
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
            {preparing.length === 0 && (
              <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: '20px' }}>Cozinha livre</p>
            )}
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
            {delivering.length === 0 && (
              <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: '20px' }}>Nenhuma entrega agora</p>
            )}
            {delivering.map(order => (
              <OrderCard key={order.id} order={order} onUpdateStatus={updateStatus} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
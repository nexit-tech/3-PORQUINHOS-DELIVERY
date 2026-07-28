'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAdminOrders } from '@/hooks/useAdminOrders';
import OrderCard from '@/components/admin/OrderCard';
import { BOT_SETTING_KEYS, getBotFlag, setBotFlag } from '@/services/botSettings';
import styles from './page.module.css';
import { ClipboardList, ChefHat, Bike, Volume2, Zap, ZapOff, Loader2 } from 'lucide-react';

export default function AdminDashboard() {
  const { orders, loading, updateStatus } = useAdminOrders();

  // Som de pedido novo. Em refs, não em state: como state, cada atualização
  // re-disparava o próprio efeito que dispara o aceite automático.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);
  const firstLoadRef = useRef(true);

  // Pedidos já enviados para aceite automático, para não reenviar o mesmo update
  const autoAcceptedRef = useRef<Set<number>>(new Set());

  const [autoAccept, setAutoAccept] = useState(false);
  const [loadingAutoAccept, setLoadingAutoAccept] = useState(true);

  // 1. Carrega Som e Configuração Inicial
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.load();

    getBotFlag(BOT_SETTING_KEYS.AUTO_ACCEPT, false)
      .then(setAutoAccept)
      .catch((error) => console.error('Erro ao carregar config:', error))
      .finally(() => setLoadingAutoAccept(false));
  }, []);

  // 2. Liga/desliga o aceite automático
  const toggleAutoAccept = async () => {
    const newState = !autoAccept;
    setAutoAccept(newState); // Otimista

    try {
      await setBotFlag(BOT_SETTING_KEYS.AUTO_ACCEPT, newState);
      toast.success(`Aceite automático ${newState ? 'ligado' : 'desligado'}`);
    } catch (error) {
      console.error('Erro ao salvar config:', error);
      setAutoAccept(!newState); // Rollback
      toast.error('Erro ao salvar configuração. Tente novamente.');
    }
  };

  // 3. Som quando chega pedido novo
  useEffect(() => {
    if (loading) return;

    // Primeira carga só registra a contagem, não toca som
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      prevCountRef.current = orders.length;
      return;
    }

    if (orders.length > prevCountRef.current) {
      audioRef.current?.play().catch((err) => console.warn('Autoplay bloqueado.', err));
    }

    prevCountRef.current = orders.length;
  }, [orders, loading]);

  // 4. Aceite automático
  useEffect(() => {
    if (!autoAccept) return;

    const toAccept = orders.filter(
      (o) =>
        o.status === 'PENDING' &&
        // Nunca aceitar sozinho um pedido que ainda não foi pago: seria
        // mandar produzir comida sem dinheiro na conta
        o.paymentStatus !== 'AWAITING' &&
        !autoAcceptedRef.current.has(o.id)
    );
    if (toAccept.length === 0) return;

    // Marca ANTES de disparar: o realtime devolve a lista antes do update terminar
    toAccept.forEach((o) => autoAcceptedRef.current.add(o.id));

    (async () => {
      for (const order of toAccept) {
        try {
          await updateStatus(order.id, 'PREPARING');
          console.log(`✅ Pedido ${order.id} aceito automaticamente.`);
        } catch (error) {
          autoAcceptedRef.current.delete(order.id); // Deixa tentar de novo
          console.error(`❌ Falha no aceite automático do pedido ${order.id}:`, error);
        }
      }
    })();
  }, [orders, autoAccept, updateStatus]);

  // Filtros de Status
  const pending = orders.filter(o => o.status === 'PENDING');
  const preparing = orders.filter(o => o.status === 'PREPARING');
  const delivering = orders.filter(o => o.status === 'DELIVERING');

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.topHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1>Monitor de Pedidos</h1>
          
          <div style={{width: '1px', height: '24px', background: '#cbd5e1', margin: '0 8px'}} />

          {/* 🔥 BOTÃO DE CONTROLE DO ACEITE AUTOMÁTICO */}
          <button 
            onClick={toggleAutoAccept}
            disabled={loadingAutoAccept}
            title={autoAccept ? "Aceite Automático LIGADO" : "Aceite Automático DESLIGADO"}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              cursor: loadingAutoAccept ? 'wait' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s',
              backgroundColor: autoAccept ? '#dcfce7' : '#f4f4f5',
              color: autoAccept ? '#166534' : '#71717a',
              boxShadow: autoAccept ? '0 0 0 2px #166534' : 'inset 0 0 0 1px #d4d4d8'
            }}
          >
            {loadingAutoAccept ? (
              <Loader2 size={18} className={styles.spin} /> // Se tiver classe spin no css global ou module
            ) : autoAccept ? (
              <>
                <Zap size={18} fill="#166534" />
                <span>Aceite Automático ON</span>
              </>
            ) : (
              <>
                <ZapOff size={18} />
                <span>Aceite automatico OFF</span>
              </>
            )}
          </button>

          <div title="Notificação sonora ativa" style={{ padding: '8px', background: '#e0f2fe', borderRadius: '50%', display: 'flex', marginLeft: 'auto' }}>
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
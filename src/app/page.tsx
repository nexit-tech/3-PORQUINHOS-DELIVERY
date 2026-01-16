'use client';

import { useState, useEffect, useRef } from 'react';
import { useAdminOrders } from '@/hooks/useAdminOrders';
import OrderCard from '@/components/admin/OrderCard';
import { supabase } from '@/services/supabase';
import styles from './page.module.css';
import { ClipboardList, ChefHat, Bike, Volume2, Zap, ZapOff, Loader2 } from 'lucide-react';

export default function AdminDashboard() {
  const { orders, updateStatus } = useAdminOrders(true);

  // Estados de Configuração e Som
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [prevCount, setPrevCount] = useState(0);
  const [firstLoad, setFirstLoad] = useState(true);
  
  // 🔥 NOVO: Estado do Aceite Automático
  const [autoAccept, setAutoAccept] = useState(false);
  const [loadingAutoAccept, setLoadingAutoAccept] = useState(true);

  // 1. Carrega Som e Configuração Inicial
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.load();

    // Busca status inicial do aceite automático
    async function loadAutoAcceptStatus() {
      try {
        const { data } = await supabase
          .from('bot_settings')
          .select('value')
          .eq('key', 'auto_accept_orders')
          .single();
        
        if (data?.value?.enabled) {
          setAutoAccept(true);
        }
      } catch (error) {
        console.error('Erro ao carregar config:', error);
      } finally {
        setLoadingAutoAccept(false);
      }
    }
    loadAutoAcceptStatus();
  }, []);

  // 🔥 2. Função para Alternar (Ligar/Desligar) Aceite Automático
  const toggleAutoAccept = async () => {
    const newState = !autoAccept;
    setAutoAccept(newState); // Atualiza visualmente na hora (otimista)

    try {
      await supabase.from('bot_settings').upsert({
        key: 'auto_accept_orders',
        value: { enabled: newState }
      });
      console.log(`Aceite automático ${newState ? 'ATIVADO' : 'DESATIVADO'}`);
    } catch (error) {
      console.error('Erro ao salvar config:', error);
      setAutoAccept(!newState); // Reverte se der erro
      alert('Erro ao salvar configuração. Tente novamente.');
    }
  };

  // 3. Monitoramento de Pedidos e Aceite Automático
  useEffect(() => {
    if (!orders) return;

    const handleNewOrders = async () => {
      // Toca som se chegou pedido novo
      if (!firstLoad && orders.length > prevCount) {
        audioRef.current?.play().catch(err => {
          console.warn("Autoplay bloqueado.", err);
        });
      }

      // 🔥 LÓGICA DE ACEITE: Só roda se o botão estiver LIGADO (autoAccept === true)
      if (autoAccept) {
        const pendingOrders = orders.filter(o => o.status === 'PENDING');
        
        for (const order of pendingOrders) {
          // Move para PREPARING
          await updateStatus(order.id, 'PREPARING');
          console.log(`✅ Pedido ${order.id} aceito automaticamente.`);
        }
      }

      setPrevCount(orders.length);
      if (firstLoad) setFirstLoad(false);
    };

    handleNewOrders();
  }, [orders, prevCount, firstLoad, updateStatus, autoAccept]); // Adicionado autoAccept nas dependências

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
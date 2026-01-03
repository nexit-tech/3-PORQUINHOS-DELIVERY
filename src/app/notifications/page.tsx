'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { Bell, ExternalLink, CheckCircle, Loader2, Trash2 } from 'lucide-react'; // 🔥 Trash2 importado
import styles from './page.module.css';

interface Notification {
  id: string;
  phone: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [prevCount, setPrevCount] = useState(0);

  useEffect(() => {
    // Inicializa o áudio
    audioRef.current = new Audio('/mensagem.mp3');
    audioRef.current.load();

    fetchNotifications();
    
    const interval = setInterval(() => {
      fetchNotifications();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('bot_notifications')
        .select('*')
        .eq('type', 'HUMAN_REQUEST')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Conta apenas para tocar o som (se chegou nova)
      const unreadCount = (data || []).length;
      
      // 🔊 TOCA SOM SE AUMENTOU O NÚMERO DE NOTIFICAÇÕES
      if (unreadCount > prevCount && prevCount > 0) {
        audioRef.current?.play().catch(err => {
          console.warn('Erro ao tocar som:', err);
        });
      }

      setPrevCount(unreadCount);
      setNotifications(data || []);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 EXCLUI UMA NOTIFICAÇÃO (MARCAR COMO OK)
  const handleResolve = async (id: string) => {
    try {
      await supabase
        .from('bot_notifications')
        .delete()
        .eq('id', id);

      // Atualiza a lista localmente para ser rápido
      setNotifications(current => current.filter(n => n.id !== id));
      // E garante buscando do banco
      fetchNotifications();
    } catch (error) {
      console.error('Erro ao excluir notificação:', error);
    }
  };

  // 🔥 EXCLUI TODAS AS NOTIFICAÇÕES (LIMPAR TELA)
  const handleResolveAll = async () => {
    if (!confirm('Tem certeza? Isso limpará todas as solicitações da tela.')) return;

    try {
      await supabase
        .from('bot_notifications')
        .delete()
        .eq('type', 'HUMAN_REQUEST');

      setNotifications([]);
      setPrevCount(0);
    } catch (error) {
      console.error('Erro ao excluir todas:', error);
    }
  };

  const handleOpenWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/55${cleanPhone}`;
    window.open(url, '_blank');
    // Não exclui automaticamente, você clica em "OK" quando quiser limpar
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spin} size={32} />
        <p>Carregando solicitações...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Solicitações de Atendimento</h1>
          <p>Gerencie os clientes que pediram ajuda</p>
        </div>
        
        {notifications.length > 0 && (
          <button onClick={handleResolveAll} className={styles.markAllBtn}>
            <CheckCircle size={18} /> Concluir Todas
          </button>
        )}
      </header>

      {notifications.length === 0 ? (
        <div className={styles.emptyState}>
          <Bell size={64} color="#d1d5db" />
          <h2>Tudo limpo!</h2>
          <p>Nenhuma solicitação de atendimento pendente.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {notifications.map((notif) => (
            <div 
              key={notif.id} 
              className={styles.card} // Removemos styles.read/unread pois agora tudo é "pendente" até excluir
              style={{ borderLeft: '4px solid var(--primary-color)' }}
            >
              <div className={styles.cardHeader}>
                <div className={styles.phoneRow}>
                  <span className={styles.phone}>
                    {notif.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </span>
                  <span className={styles.newBadge}>PENDENTE</span>
                </div>
                <span className={styles.time}>
                  {new Date(notif.created_at).toLocaleString('pt-BR')}
                </span>
              </div>

              <div className={styles.messageBox}>
                <p className={styles.message}>"{notif.message}"</p>
              </div>

              <div className={styles.actions}>
                <button
                  onClick={() => handleResolve(notif.id)}
                  className={styles.markReadBtn}
                  style={{ backgroundColor: '#10b981', color: 'white', border: 'none' }} // Verde para OK
                >
                  <CheckCircle size={16} /> OK (Concluir)
                </button>
                
                <button
                  onClick={() => handleOpenWhatsApp(notif.phone)}
                  className={styles.whatsappBtn}
                >
                  <ExternalLink size={16} /> WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// src/components/admin/BotManagement/index.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { Play, Pause, Trash2, Plus, Phone, Loader2, MessageSquare, ExternalLink, Bell } from 'lucide-react';
import styles from './styles.module.css';

interface PausedNumber {
  id: string;
  phone: string;
  is_paused: boolean;
  paused_at: string;
  notes?: string;
  auto_paused?: boolean;
}

interface Notification {
  id: string;
  phone: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function BotManagement() {
  const [numbers, setNumbers] = useState<PausedNumber[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchNumbers();
    fetchNotifications();

    // Polling a cada 10 segundos
    const interval = setInterval(() => {
      fetchNumbers();
      fetchNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchNumbers = async () => {
    try {
      const { data, error } = await supabase
        .from('bot_paused_numbers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNumbers(data || []);
    } catch (error) {
      console.error('Erro ao buscar números:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('bot_notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    }
  };

  const handleAddNumber = async () => {
    if (!newPhone.trim()) {
      alert('Digite um número válido!');
      return;
    }

    setIsAdding(true);
    try {
      const cleanPhone = newPhone.replace(/\D/g, '');

      const { error } = await supabase
        .from('bot_paused_numbers')
        .insert({
          phone: cleanPhone,
          is_paused: true,
          notes: newNotes || null,
          auto_paused: false
        });

      if (error) throw error;

      setNewPhone('');
      setNewNotes('');
      fetchNumbers();
    } catch (error: any) {
      console.error('Erro ao adicionar:', error);
      alert('Erro ao adicionar número: ' + error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleTogglePause = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('bot_paused_numbers')
        .update({ 
          is_paused: !currentStatus,
          paused_at: !currentStatus ? new Date().toISOString() : null
        })
        .eq('id', id);

      if (error) throw error;
      fetchNumbers();
    } catch (error) {
      console.error('Erro ao atualizar:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este número da lista?')) return;

    try {
      const { error } = await supabase
        .from('bot_paused_numbers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchNumbers();
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('bot_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      fetchNotifications();
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const handleOpenWhatsApp = (phone: string, notificationId?: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/55${cleanPhone}`;
    window.open(url, '_blank');

    if (notificationId) {
      handleMarkAsRead(notificationId);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spin} size={32} />
      </div>
    );
  }

  const unreadCount = notifications.length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3>Controle de Bot - WhatsApp</h3>
          <p>Pause o bot para números específicos</p>
        </div>
      </div>

      {/* 🔥 NOTIFICAÇÕES */}
      {unreadCount > 0 && (
        <div className={styles.notificationsSection}>
          <div className={styles.notifHeader}>
            <Bell size={20} />
            <h4>Solicitações de Atendimento ({unreadCount})</h4>
          </div>

          <div className={styles.notifList}>
            {notifications.map((notif) => (
              <div key={notif.id} className={styles.notifCard}>
                <div className={styles.notifInfo}>
                  <div className={styles.notifPhone}>
                    {notif.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </div>
                  <div className={styles.notifMessage}>
                    <MessageSquare size={14} />
                    "{notif.message}"
                  </div>
                  <div className={styles.notifTime}>
                    {new Date(notif.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>

                <div className={styles.notifActions}>
                  <button
                    onClick={() => handleOpenWhatsApp(notif.phone, notif.id)}
                    className={styles.openWhatsAppBtn}
                  >
                    <ExternalLink size={16} />
                    Atender
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADICIONAR NOVO */}
      <div className={styles.addSection}>
        <div className={styles.inputGroup}>
          <div className={styles.inputWithIcon}>
            <Phone size={18} />
            <input 
              type="tel"
              placeholder="DDD + Número (ex: 21999999999)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className={styles.input}
            />
          </div>
          
          <input 
            type="text"
            placeholder="Motivo (opcional)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            className={styles.input}
          />
        </div>

        <button 
          onClick={handleAddNumber}
          disabled={isAdding}
          className={styles.addBtn}
        >
          {isAdding ? <Loader2 className={styles.spin} size={18} /> : <Plus size={18} />}
          Adicionar
        </button>
      </div>

      {/* LISTA */}
      <div className={styles.list}>
        {numbers.length === 0 ? (
          <p className={styles.empty}>Nenhum número pausado no momento.</p>
        ) : (
          numbers.map((item) => (
            <div key={item.id} className={styles.row}>
              <div className={styles.info}>
                <div className={styles.phoneRow}>
                  <div className={styles.phone}>
                    {item.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </div>
                  {item.auto_paused && (
                    <span className={styles.autoBadge}>Auto-pausado</span>
                  )}
                </div>
                {item.notes && (
                  <div className={styles.notes}>{item.notes}</div>
                )}
                <div className={styles.date}>
                  {item.is_paused ? 'Pausado em' : 'Último pause em'}: {' '}
                  {new Date(item.paused_at).toLocaleString('pt-BR')}
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  onClick={() => handleOpenWhatsApp(item.phone)}
                  className={styles.whatsappBtn}
                  title="Abrir WhatsApp"
                >
                  <MessageSquare size={16} />
                </button>

                <button
                  onClick={() => handleTogglePause(item.id, item.is_paused)}
                  className={`${styles.toggleBtn} ${item.is_paused ? styles.paused : styles.active}`}
                  title={item.is_paused ? 'Reativar Bot' : 'Pausar Bot'}
                >
                  {item.is_paused ? <Play size={16} /> : <Pause size={16} />}
                  {item.is_paused ? 'Reativar' : 'Pausar'}
                </button>

                <button
                  onClick={() => handleDelete(item.id)}
                  className={styles.deleteBtn}
                  title="Remover da lista"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
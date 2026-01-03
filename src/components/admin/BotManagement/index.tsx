'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { Play, Pause, Trash2, Plus, Phone, Loader2, MessageSquare, Power, AlertTriangle } from 'lucide-react';
import styles from './styles.module.css';

interface PausedNumber {
  id: string;
  phone: string;
  is_paused: boolean;
  paused_at: string;
  notes?: string;
  auto_paused?: boolean;
}

export default function BotManagement() {
  const [numbers, setNumbers] = useState<PausedNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBotGlobalActive, setIsBotGlobalActive] = useState(true); // 🔥 Estado Global
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchGlobalStatus();
    fetchNumbers();
    const interval = setInterval(() => {
      fetchNumbers();
      fetchGlobalStatus(); // Mantém sincronizado se outra pessoa mexer
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 Busca status global
  const fetchGlobalStatus = async () => {
    try {
      const { data } = await supabase
        .from('bot_settings')
        .select('value')
        .eq('key', 'is_bot_active')
        .single();
      
      if (data && data.value) {
        setIsBotGlobalActive(data.value.enabled);
      }
    } catch (error) {
      console.error('Erro ao buscar status global:', error);
    } finally {
      setLoadingGlobal(false);
    }
  };

  // 🔥 Alterna status global (CORRIGIDO)
  const toggleGlobalBot = async () => {
    const newState = !isBotGlobalActive;
    const confirmMessage = newState 
      ? "Deseja LIGAR o bot novamente? Ele voltará a responder automaticamente."
      : "Deseja DESLIGAR o bot? Ele parará de responder a TODOS os clientes.";

    if (!confirm(confirmMessage)) return;

    // 1. Optimistic UI: Atualiza a tela instantaneamente
    setIsBotGlobalActive(newState); 
    
    try {
      // 2. CORREÇÃO AQUI: Trocado de .upsert para .update
      // Isso garante que ele atualize a linha existente e não tente criar outra
      const { error } = await supabase
        .from('bot_settings')
        .update({ 
          value: { enabled: newState } 
        })
        .eq('key', 'is_bot_active'); // Busca a chave exata

      if (error) throw error;

    } catch (error) {
      console.error('Erro ao alterar status global:', error);
      setIsBotGlobalActive(!newState); // Reverte se der erro (Rollback)
      alert('Erro ao salvar configuração no banco.');
    }
  };

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

  const handleAddNumber = async () => {
    if (!newPhone.trim()) {
      alert('Digite um número válido!');
      return;
    }

    setIsAdding(true);
    try {
      const cleanPhone = newPhone.replace(/\D/g, '');
      await supabase.from('bot_paused_numbers').upsert({
        phone: cleanPhone,
        is_paused: true,
        paused_at: new Date().toISOString(),
        notes: newNotes || null,
        auto_paused: false 
      }, { onConflict: 'phone' });

      setNewPhone('');
      setNewNotes('');
      fetchNumbers();
    } catch (error: any) {
      console.error('Erro ao adicionar:', error);
      alert('Erro ao adicionar número.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleTogglePause = async (id: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      await supabase.from('bot_paused_numbers').update({ 
        is_paused: newStatus,
        paused_at: newStatus ? new Date().toISOString() : null,
        auto_paused: false 
      }).eq('id', id);

      fetchNumbers();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover da lista?')) return;
    try {
      await supabase.from('bot_paused_numbers').delete().eq('id', id);
      fetchNumbers();
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  };

  const handleOpenWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/55${cleanPhone}`;
    window.open(url, '_blank');
  };

  if (loading || loadingGlobal) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spin} size={32} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      
      {/* 🔥 INTERRUPTOR GERAL */}
      <div className={`${styles.globalSwitch} ${isBotGlobalActive ? styles.globalOn : styles.globalOff}`}>
        <div className={styles.globalInfo}>
          <div className={styles.iconCircle}>
            <Power size={24} />
          </div>
          <div>
            <h3>Bot {isBotGlobalActive ? 'LIGADO' : 'DESLIGADO'}</h3>
            <p>
              {isBotGlobalActive 
                ? 'O sistema está respondendo automaticamente.' 
                : 'O bot está totalmente parado. Ninguém receberá respostas.'}
            </p>
          </div>
        </div>
        <button onClick={toggleGlobalBot} className={styles.globalBtn}>
          {isBotGlobalActive ? 'Desligar Bot Geral' : 'Ligar Bot Agora'}
        </button>
      </div>

      <header className={styles.header}>
        <div>
          <h3>Pausas Manuais</h3>
          <p>Gerencie números específicos que estão pausados (atendimento humano).</p>
        </div>
      </header>

      {/* Se o bot estiver desligado, mostra um aviso extra na lista */}
      {!isBotGlobalActive && (
        <div className={styles.warningBanner}>
          <AlertTriangle size={20} />
          <span>Atenção: O bot está desligado globalmente. As pausas abaixo não farão diferença até você ligá-lo novamente.</span>
        </div>
      )}

      <div className={styles.addSection}>
        <div className={styles.inputs}>
          <div className={styles.inputWithIcon}>
            <Phone size={18} />
            <input 
              type="tel"
              placeholder="DDD + Número"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
          <input 
            type="text"
            placeholder="Observação"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            className={styles.notesInput}
          />
        </div>
        <button onClick={handleAddNumber} disabled={isAdding} className={styles.addBtn}>
          {isAdding ? <Loader2 className={styles.spin} size={18} /> : <Plus size={18} />}
          Adicionar
        </button>
      </div>

      <div className={styles.list}>
        {numbers.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.robotIcon}>🤖</div>
            <p>Lista vazia.</p>
            <span>Adicione um número para pausar o atendimento automático dele.</span>
          </div>
        ) : (
          numbers.map((item) => (
            <div key={item.id} className={`${styles.card} ${item.is_paused ? styles.cardPaused : styles.cardActive}`}>
              <div className={styles.cardInfo}>
                <div className={styles.phoneRow}>
                  <span className={styles.phone}>
                    {item.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </span>
                  {item.auto_paused && <span className={styles.badgeAuto}>AUTO</span>}
                </div>
                {item.notes && <p className={styles.cardNotes}>{item.notes}</p>}
                <span className={styles.statusText}>
                  {item.is_paused ? <span className={styles.statusPaused}>⏸️ Pausado</span> : <span className={styles.statusActive}>🤖 Ativo</span>}
                </span>
              </div>
              <div className={styles.actions}>
                <button onClick={() => handleOpenWhatsApp(item.phone)} className={styles.iconBtn}>
                  <MessageSquare size={18} />
                </button>
                <button
                  onClick={() => handleTogglePause(item.id, item.is_paused)}
                  className={`${styles.toggleBtn} ${item.is_paused ? styles.btnResume : styles.btnPause}`}
                >
                  {item.is_paused ? <Play size={16} /> : <Pause size={16} />}
                </button>
                <button onClick={() => handleDelete(item.id)} className={styles.deleteBtn}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
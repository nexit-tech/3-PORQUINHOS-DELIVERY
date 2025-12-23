'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase'; // CORREÇÃO 1: Usando seu serviço existente
import { Clock, Check, X, Loader2, Save } from 'lucide-react';
import styles from './styles.module.css';

// Interface interna para o Estado do Componente (Front-end)
interface DaySchedule {
  id: string;
  day: string;
  label: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

// Interface para Tipar o retorno do Banco (Back-end / Snake Case)
interface DatabaseScheduleItem {
  id: string;
  day_of_week: string;
  label: string;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

const DAY_ORDER: Record<string, number> = {
  'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6, 'dom': 7
};

export default function OpeningHours() {
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*');

      if (error) throw error;

      if (data) {
        // CORREÇÃO 2: Tipando o 'item' como DatabaseScheduleItem
        const formattedData: DaySchedule[] = (data as DatabaseScheduleItem[]).map((item) => ({
          id: item.id,
          day: item.day_of_week,
          label: item.label,
          isOpen: item.is_open,
          openTime: item.open_time ? item.open_time.slice(0, 5) : '18:00',
          closeTime: item.close_time ? item.close_time.slice(0, 5) : '23:00'
        }));

        formattedData.sort((a, b) => (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99));

        setSchedule(formattedData);
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
      alert('Erro ao carregar horários.');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (index: number) => {
    const newSchedule = [...schedule];
    newSchedule[index].isOpen = !newSchedule[index].isOpen;
    setSchedule(newSchedule);
  };

  const updateTime = (index: number, field: 'openTime' | 'closeTime', value: string) => {
    const newSchedule = [...schedule];
    newSchedule[index][field] = value;
    setSchedule(newSchedule);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Converte de volta para o formato do banco (snake_case)
      const updates = schedule.map(item => ({
        id: item.id,
        day_of_week: item.day,
        label: item.label,
        is_open: item.isOpen,
        open_time: item.openTime,
        close_time: item.closeTime
      }));

      const { error } = await supabase
        .from('store_settings')
        .upsert(updates);

      if (error) throw error;

      alert("Horário de funcionamento atualizado com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert("Erro ao salvar alterações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-zinc-500">
        <Loader2 className={styles.spin} size={32} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.title}>
          <Clock size={24} color="var(--primary-color)" />
          <h2>Horário de Funcionamento</h2>
        </div>
        <p>Defina os dias e horários que sua loja recebe pedidos.</p>
      </header>

      <div className={styles.list}>
        {schedule.map((item, index) => (
          <div key={item.id} className={`${styles.row} ${!item.isOpen ? styles.closedRow : ''}`}>
            
            <div className={styles.dayInfo}>
              <button 
                className={`${styles.toggleBtn} ${item.isOpen ? styles.active : ''}`}
                onClick={() => toggleDay(index)}
              >
                {item.isOpen ? <Check size={14} /> : <X size={14} />}
              </button>
              <span className={styles.dayLabel}>{item.label}</span>
            </div>

            {item.isOpen ? (
              <div className={styles.times}>
                <div className={styles.timeGroup}>
                  <label>Abre</label>
                  <input 
                    type="time" 
                    value={item.openTime} 
                    onChange={e => updateTime(index, 'openTime', e.target.value)} 
                  />
                </div>
                <span className={styles.separator}>até</span>
                <div className={styles.timeGroup}>
                  <label>Fecha</label>
                  <input 
                    type="time" 
                    value={item.closeTime} 
                    onChange={e => updateTime(index, 'closeTime', e.target.value)} 
                  />
                </div>
              </div>
            ) : (
              <span className={styles.closedBadge}>Fechado</span>
            )}
          </div>
        ))}
      </div>

      <footer className={styles.footer}>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className={styles.saveBtn}
          style={{ opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {saving ? <Loader2 size={18} className={styles.spin} /> : <Save size={18} />}
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </footer>
    </div>
  );
}
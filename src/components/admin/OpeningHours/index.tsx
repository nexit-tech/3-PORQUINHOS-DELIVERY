'use client';

import { useState } from 'react';
import { DaySchedule } from '@/types/settings';
import { Clock, Check, X } from 'lucide-react';
import styles from './styles.module.css';

// Estado inicial mockado (Padrão: Aberto das 18h às 23h)
const INITIAL_SCHEDULE: DaySchedule[] = [
  { day: 'seg', label: 'Segunda-feira', isOpen: true, openTime: '18:00', closeTime: '23:00' },
  { day: 'ter', label: 'Terça-feira', isOpen: true, openTime: '18:00', closeTime: '23:00' },
  { day: 'qua', label: 'Quarta-feira', isOpen: true, openTime: '18:00', closeTime: '23:00' },
  { day: 'qui', label: 'Quinta-feira', isOpen: true, openTime: '18:00', closeTime: '23:00' },
  { day: 'sex', label: 'Sexta-feira', isOpen: true, openTime: '18:00', closeTime: '00:00' },
  { day: 'sab', label: 'Sábado', isOpen: true, openTime: '18:00', closeTime: '00:00' },
  { day: 'dom', label: 'Domingo', isOpen: true, openTime: '17:00', closeTime: '23:00' },
];

export default function OpeningHours() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(INITIAL_SCHEDULE);

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

  const handleSave = () => {
    console.log("Horários Salvos:", schedule);
    alert("Horário de funcionamento atualizado!");
  };

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
          <div key={item.day} className={`${styles.row} ${!item.isOpen ? styles.closedRow : ''}`}>
            
            {/* Toggle Dia */}
            <div className={styles.dayInfo}>
              <button 
                className={`${styles.toggleBtn} ${item.isOpen ? styles.active : ''}`}
                onClick={() => toggleDay(index)}
              >
                {item.isOpen ? <Check size={14} /> : <X size={14} />}
              </button>
              <span className={styles.dayLabel}>{item.label}</span>
            </div>

            {/* Inputs de Hora (Só aparecem se aberto) */}
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
        <button onClick={handleSave} className={styles.saveBtn}>Salvar Alterações</button>
      </footer>
    </div>
  );
}
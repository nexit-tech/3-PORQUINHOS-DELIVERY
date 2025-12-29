// src/components/client/ClosedStoreModal/index.tsx
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, XCircle } from 'lucide-react';
import styles from './styles.module.css';
import { supabase } from '@/services/supabase';

interface ClosedStoreModalProps {
  currentDay: string;
}

export default function ClosedStoreModal({ currentDay }: ClosedStoreModalProps) {
  const [mounted, setMounted] = useState(false);
  const [nextOpenDay, setNextOpenDay] = useState<string>('');
  const [nextOpenTime, setNextOpenTime] = useState<string>('');

  useEffect(() => {
    setMounted(true);
    fetchNextOpenDay();
  }, []);

  const fetchNextOpenDay = async () => {
    try {
      // Busca todos os dias que estão abertos
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('is_open', true)
        .order('day_of_week', { ascending: true });

      if (error || !data || data.length === 0) return;

      // Mapeia os dias
      const dayOrder = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
      const currentIndex = dayOrder.indexOf(currentDay);

      // Procura o próximo dia aberto
      let nextDay = null;
      for (let i = 1; i <= 7; i++) {
        const checkIndex = (currentIndex + i) % 7;
        const checkDay = dayOrder[checkIndex];
        const foundDay = data.find(d => d.day_of_week === checkDay);
        
        if (foundDay) {
          nextDay = foundDay;
          break;
        }
      }

      if (nextDay) {
        const dayLabels: Record<string, string> = {
          'dom': 'Domingo',
          'seg': 'Segunda-feira',
          'ter': 'Terça-feira',
          'qua': 'Quarta-feira',
          'qui': 'Quinta-feira',
          'sex': 'Sexta-feira',
          'sab': 'Sábado'
        };
        
        setNextOpenDay(dayLabels[nextDay.day_of_week]);
        setNextOpenTime(nextDay.open_time.slice(0, 5));
      }
    } catch (error) {
      console.error('Erro ao buscar próximo dia:', error);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.iconBox}>
          <XCircle size={64} />
        </div>
        
        <h2>Loja Fechada</h2>
        <p className={styles.message}>
          Desculpe, não estamos aceitando pedidos no momento.
        </p>

        {nextOpenDay && (
          <div className={styles.infoBox}>
            <Clock size={20} />
            <div>
              <strong>Próximo Horário:</strong>
              <p>{nextOpenDay} às {nextOpenTime}</p>
            </div>
          </div>
        )}

        <p className={styles.footer}>
          Volte em breve! 🍕❤️
        </p>
      </div>
    </div>,
    document.body
  );
}
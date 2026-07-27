// src/hooks/useStoreStatus.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/services/supabase';
import {
  isStoreOpen,
  storeDayKey,
  getNextOpening,
  DAY_LABELS,
  type DayHours,
  type DayKey,
} from '@/lib/storeHours';

export function useStoreStatus() {
  const [isOpen, setIsOpen] = useState(true);
  const [currentDay, setCurrentDay] = useState<DayKey>(() => storeDayKey());
  const [nextOpening, setNextOpening] = useState<{ label: string; time: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Guarda a grade da semana para reavaliar o horário sem bater no banco de novo
  const scheduleRef = useRef<DayHours[]>([]);

  const evaluate = useCallback(() => {
    const schedule = scheduleRef.current;

    setCurrentDay(storeDayKey());

    // Sem grade cadastrada, assume aberto para não derrubar as vendas por engano
    if (schedule.length === 0) {
      setIsOpen(true);
      setNextOpening(null);
      return;
    }

    setIsOpen(isStoreOpen(schedule));

    const next = getNextOpening(schedule);
    setNextOpening(next ? { label: DAY_LABELS[next.dayKey], time: next.openTime } : null);
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      // Busca a semana INTEIRA: o horário que vira a meia-noite depende de ontem
      const { data, error } = await supabase.from('store_settings').select('*');

      if (error) throw error;

      scheduleRef.current = (data as DayHours[]) || [];
      evaluate();
    } catch (error) {
      console.error('Erro ao verificar status da loja:', error);
      setIsOpen(true);
    } finally {
      setLoading(false);
    }
  }, [evaluate]);

  useEffect(() => {
    fetchSchedule();

    // Reavalia a cada minuto: senão a loja "fecha" só quando alguém der F5
    const tick = setInterval(evaluate, 60_000);

    const channel = supabase
      .channel('store-status-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_settings' },
        () => {
          console.log('⏰ Horário da loja alterado!');
          fetchSchedule();
        }
      )
      .subscribe();

    return () => {
      clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [fetchSchedule, evaluate]);

  return { isOpen, currentDay, nextOpening, loading };
}

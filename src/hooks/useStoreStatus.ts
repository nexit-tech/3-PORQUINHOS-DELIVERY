// src/hooks/useStoreStatus.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';

interface StoreStatus {
  isOpen: boolean;
  currentDay: string;
  loading: boolean;
}

export function useStoreStatus(): StoreStatus {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentDay, setCurrentDay] = useState('');

  useEffect(() => {
    checkStoreStatus();
    
    // Verifica a cada 1 minuto se a loja ainda está aberta
    const interval = setInterval(checkStoreStatus, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const checkStoreStatus = async () => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Dom, 1 = Seg, 2 = Ter...
      
      // Mapeia número do dia para sigla
      const dayMap: Record<number, string> = {
        0: 'dom',
        1: 'seg',
        2: 'ter',
        3: 'qua',
        4: 'qui',
        5: 'sex',
        6: 'sab'
      };
      
      const dayKey = dayMap[dayOfWeek];
      setCurrentDay(dayKey);

      // Busca configuração do dia atual
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('day_of_week', dayKey)
        .single();

      if (error || !data) {
        console.error('Erro ao buscar horário:', error);
        setIsOpen(false);
        setLoading(false);
        return;
      }

      // Se o dia está marcado como fechado
      if (!data.is_open) {
        setIsOpen(false);
        setLoading(false);
        return;
      }

      // Verifica se está dentro do horário
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
      const openTime = data.open_time.slice(0, 5);
      const closeTime = data.close_time.slice(0, 5);

      const isWithinHours = currentTime >= openTime && currentTime <= closeTime;
      
      setIsOpen(isWithinHours);
      setLoading(false);
      
    } catch (error) {
      console.error('Erro ao verificar status da loja:', error);
      setIsOpen(false);
      setLoading(false);
    }
  };

  return { isOpen, currentDay, loading };
}
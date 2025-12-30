// src/hooks/useStoreStatus.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';

export function useStoreStatus() {
  const [isOpen, setIsOpen] = useState(true);
  const [currentDay, setCurrentDay] = useState('');
  const [loading, setLoading] = useState(true);

  const checkStoreStatus = useCallback(async () => {
    try {
      if (loading) setLoading(true); // Só mostra loading na primeira vez

      const now = new Date();
      const dayMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
      const todayKey = dayMap[now.getDay()];
      
      setCurrentDay(todayKey);

      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('day_of_week', todayKey)
        .single();

      if (error || !data) {
        console.error('Erro ao buscar horário:', error);
        setIsOpen(true);
        setLoading(false);
        return;
      }

      if (!data.is_open) {
        setIsOpen(false);
        setLoading(false);
        return;
      }

      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const [openHour, openMin] = data.open_time.split(':').map(Number);
      const [closeHour, closeMin] = data.close_time.split(':').map(Number);
      
      const openMinutes = openHour * 60 + openMin;
      const closeMinutes = closeHour * 60 + closeMin;

      if (currentTime >= openMinutes && currentTime <= closeMinutes) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }

    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setIsOpen(true);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    // Verifica imediatamente ao montar
    checkStoreStatus();
    
    // 🔥 POLLING: Verifica a cada 1 minuto (60000ms)
    const interval = setInterval(() => {
      checkStoreStatus();
    }, 60000);

    // Cleanup: limpa o intervalo quando desmontar
    return () => clearInterval(interval);
  }, [checkStoreStatus]);

  return { isOpen, currentDay, loading };
}
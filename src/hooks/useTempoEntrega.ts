// src/hooks/useTempoEntrega.ts
import { useEffect, useState } from 'react';
import { TEMPO_ENTREGA_PADRAO } from '@/lib/tempoEntrega';

/** Prazo de entrega configurado no painel, em minutos. */
export function useTempoEntrega(): number {
  const [minutos, setMinutos] = useState(TEMPO_ENTREGA_PADRAO);

  useEffect(() => {
    fetch('/api/loja/tempo-entrega', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (Number.isFinite(d?.minutes)) setMinutos(d.minutes);
      })
      // Sem a rota (ou fora do ar), fica o padrão: melhor um prazo
      // aproximado do que cronômetro nenhum
      .catch(() => {});
  }, []);

  return minutos;
}

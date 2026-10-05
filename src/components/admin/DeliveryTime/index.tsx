'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Minus, Plus, Save, Timer } from 'lucide-react';
import { getBotSetting, setBotSetting } from '@/services/botSettings';
import { normalizarMinutos, TEMPO_ENTREGA_KEY, TEMPO_ENTREGA_PADRAO } from '@/lib/tempoEntrega';
import styles from './styles.module.css';

const ATALHOS = [30, 40, 50, 60, 90];

// Prazo que a loja promete. Vira o cronômetro da tela "Pedido realizado" e a
// previsão da mensagem de WhatsApp "pedido aceito".
export default function DeliveryTime() {
  const [minutos, setMinutos] = useState(TEMPO_ENTREGA_PADRAO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBotSetting(TEMPO_ENTREGA_KEY)
      .then((valor) => setMinutos(normalizarMinutos(valor)))
      .catch((erro) => console.error('Erro ao ler o tempo de entrega:', erro))
      .finally(() => setLoading(false));
  }, []);

  const ajustar = (delta: number) => setMinutos((m) => Math.min(240, Math.max(5, m + delta)));

  const salvar = async () => {
    setSaving(true);
    try {
      await setBotSetting(TEMPO_ENTREGA_KEY, { minutes: minutos });
      toast.success(`Tempo de entrega: ${minutos} min`);
    } catch (erro) {
      console.error(erro);
      toast.error('Não consegui salvar o tempo de entrega');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spin} size={24} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <p className={styles.help}>
        O cliente vê um cronômetro regressivo a partir da hora em que fez o pedido, e a
        mensagem de pedido aceito no WhatsApp informa o horário previsto.
      </p>

      <div className={styles.stepper}>
        <button type="button" onClick={() => ajustar(-5)} aria-label="Menos 5 minutos">
          <Minus size={20} />
        </button>
        <div className={styles.valor}>
          <Timer size={22} />
          <input
            type="number"
            min={5}
            max={240}
            value={minutos}
            onChange={(e) => setMinutos(Number(e.target.value) || 0)}
            onBlur={() => setMinutos((m) => normalizarMinutos(m))}
            aria-label="Minutos"
          />
          <span>min</span>
        </div>
        <button type="button" onClick={() => ajustar(5)} aria-label="Mais 5 minutos">
          <Plus size={20} />
        </button>
      </div>

      <div className={styles.atalhos}>
        {ATALHOS.map((a) => (
          <button
            key={a}
            type="button"
            className={a === minutos ? styles.atalhoAtivo : undefined}
            onClick={() => setMinutos(a)}
          >
            {a} min
          </button>
        ))}
      </div>

      <button type="button" className={styles.salvar} onClick={salvar} disabled={saving}>
        {saving ? <Loader2 className={styles.spin} size={18} /> : <Save size={18} />}
        Salvar
      </button>
    </div>
  );
}

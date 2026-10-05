'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Timer } from 'lucide-react';
import styles from './styles.module.css';

interface Props {
  /** Quando o pedido foi feito (ISO). O prazo conta daí. */
  inicio: string;
  minutos: number;
  status?: string;
  retirada?: boolean;
  variante?: 'grande' | 'compacto';
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

function formatar(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${doisDigitos(m)}:${doisDigitos(s)}` : `${doisDigitos(m)}:${doisDigitos(s)}`;
}

const RAIO = 88;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

/**
 * Cronômetro regressivo do prazo de entrega.
 *
 * Conta a partir da hora do pedido, não da hora em que a tela abriu: quem
 * recarrega a página ou volta depois vê o tempo que realmente falta.
 */
export default function CronometroEntrega({
  inicio,
  minutos,
  status,
  retirada = false,
  variante = 'grande',
}: Props) {
  // null até montar no navegador: o relógio do servidor e o do cliente
  // diferem, e renderizar a hora dos dois quebraria a hidratação
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    setAgora(Date.now());
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(relogio);
  }, []);

  if (status === 'CANCELED') return null;

  const finalizado = status === 'COMPLETED';
  const prazo = minutos * 60_000;
  const fim = new Date(inicio).getTime() + prazo;
  const restante = agora === null ? prazo : fim - agora;
  const esgotado = restante <= 0;
  const fracao = Math.min(1, Math.max(0, restante / prazo));

  const rotulo = retirada ? 'para ficar pronto' : 'para chegar';
  const avisoEsgotado = retirada
    ? 'Já deve estar pronto! Pode vir buscar.'
    : 'Está chegando! Se demorar, fale com a gente.';

  if (variante === 'compacto') {
    if (finalizado) return null;

    return (
      <div className={`${styles.compacto} ${esgotado ? styles.compactoEsgotado : ''}`}>
        <Timer size={16} />
        {esgotado ? (
          <span>{avisoEsgotado}</span>
        ) : (
          <span>
            <strong className={styles.digitos}>{formatar(restante)}</strong> {rotulo}
          </span>
        )}
      </div>
    );
  }

  if (finalizado) {
    return (
      <div className={styles.finalizado}>
        <CheckCircle2 size={28} />
        <span>{retirada ? 'Pedido retirado' : 'Pedido entregue'}. Bom apetite!</span>
      </div>
    );
  }

  return (
    <div className={styles.grande} role="timer" aria-live="off">
      <svg viewBox="0 0 200 200" className={styles.anel} aria-hidden="true">
        <circle cx="100" cy="100" r={RAIO} className={styles.trilho} />
        <circle
          cx="100"
          cy="100"
          r={RAIO}
          className={styles.progresso}
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={CIRCUNFERENCIA * (1 - fracao)}
        />
      </svg>

      <div className={styles.centro}>
        <span className={`${styles.tempo} ${styles.digitos}`}>
          {formatar(restante)}
        </span>
        <span className={styles.legenda}>{esgotado ? 'a qualquer momento' : rotulo}</span>
      </div>

      {esgotado && <p className={styles.aviso}>{avisoEsgotado}</p>}
    </div>
  );
}

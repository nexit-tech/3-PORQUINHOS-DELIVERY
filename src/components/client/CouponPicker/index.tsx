'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ticket, ChevronRight, Check, X, Loader2, Lock } from 'lucide-react';
import { supabase } from '@/services/supabase';
import type { AvailableCoupon } from '@/types/coupon';
import { formatMoney } from '@/types/coupon';
import styles from './styles.module.css';

export interface AppliedCoupon {
  code: string;
  discount: number;
}

interface Props {
  subtotal: number;
  deliveryFee: number;
  phone: string;
  deliveryType: 'delivery' | 'pickup';
  applied: AppliedCoupon | null;
  onApply: (coupon: AppliedCoupon | null) => void;
}

export default function CouponPicker({
  subtotal, deliveryFee, phone, deliveryType, applied, onApply,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [list, setList] = useState<AvailableCoupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('list_available_coupons', {
        p_subtotal: subtotal,
        p_delivery_fee: deliveryFee,
        p_phone: phone,
        p_delivery_type: deliveryType,
      });
      if (error) throw error;
      setList((data as AvailableCoupon[]) || []);
    } catch (e) {
      console.error('Erro ao listar cupons:', e);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [subtotal, deliveryFee, phone, deliveryType]);

  // Trava o scroll do fundo enquanto a folha está aberta
  useEffect(() => {
    if (!open) return;

    loadCoupons();
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onEsc);

    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', onEsc);
    };
  }, [open, loadCoupons]);

  /**
   * Revalida o cupom já aplicado sempre que o pedido muda.
   *
   * Sem isto o cliente aplicaria "R$ 10 acima de R$ 50", removeria um item e
   * ficaria vendo o desconto numa tela que o banco vai recusar no fechamento.
   */
  useEffect(() => {
    if (!applied) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.rpc('evaluate_coupon', {
        p_code: applied.code,
        p_subtotal: subtotal,
        p_delivery_fee: deliveryFee,
        p_phone: phone,
        p_delivery_type: deliveryType,
      });

      if (cancelled) return;

      const res = Array.isArray(data) ? data[0] : data;

      if (error || !res?.valid) {
        setError(res?.reason || 'O cupom não vale mais para este pedido');
        onApply(null);
        return;
      }

      if (Number(res.discount) !== applied.discount) {
        onApply({ code: applied.code, discount: Number(res.discount) });
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, deliveryFee, deliveryType, phone]);

  const applyCode = async (code: string) => {
    if (!code.trim()) return;
    setChecking(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('evaluate_coupon', {
        p_code: code,
        p_subtotal: subtotal,
        p_delivery_fee: deliveryFee,
        p_phone: phone,
        p_delivery_type: deliveryType,
      });
      if (error) throw error;

      const res = Array.isArray(data) ? data[0] : data;

      if (!res?.valid) {
        setError(res?.reason || 'Cupom inválido');
        return;
      }

      onApply({ code: res.code, discount: Number(res.discount) });
      setManualCode('');
      setOpen(false);
    } catch (e) {
      console.error(e);
      setError('Não foi possível validar o cupom agora');
    } finally {
      setChecking(false);
    }
  };

  const disponiveis = list.filter((c) => c.qualifies).length;

  // ---- Folha que sobe por cima de tudo ----
  // O rodapé desta tela é fixo. Um dropdown inline ficava escondido atrás
  // dele assim que a lista passava de um item, e nenhum ajuste de padding
  // resolve isso para uma lista de tamanho variável.
  // A folha vai para o document.body, fora da árvore do layout da loja.
  // Sem a classe .loja aqui, nenhum token de loja.css existe dentro dela.
  const sheet = (
    <div
      className={`loja ${styles.sheetOverlay}`}
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className={styles.sheet} role="dialog" aria-label="Cupons de desconto">
        <div className={styles.sheetGrip} />

        <header className={styles.sheetHeader}>
          <div>
            <h3>Cupons de desconto</h3>
            <span>
              {loading
                ? 'Buscando...'
                : disponiveis > 0
                  ? `${disponiveis} disponível${disponiveis > 1 ? 'eis' : ''} para este pedido`
                  : 'Nenhum liberado para este pedido ainda'}
            </span>
          </div>
          <button type="button" onClick={() => setOpen(false)} className={styles.sheetClose}>
            <X size={22} />
          </button>
        </header>

        <div className={styles.manualRow}>
          <input
            value={manualCode}
            onChange={(e) => { setManualCode(e.target.value.toUpperCase()); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && applyCode(manualCode)}
            placeholder="DIGITE O CÓDIGO"
            className={styles.manualInput}
            maxLength={24}
          />
          <button
            type="button"
            className={styles.manualBtn}
            onClick={() => applyCode(manualCode)}
            disabled={checking || !manualCode.trim()}
          >
            {checking ? <Loader2 size={16} className={styles.spin} /> : 'Aplicar'}
          </button>
        </div>

        {error && <div className={styles.errorBox}><X size={14} /> {error}</div>}

        <div className={styles.sheetBody}>
          {loading ? (
            <div className={styles.listState}>
              <Loader2 size={20} className={styles.spin} /> Buscando cupons...
            </div>
          ) : list.length === 0 ? (
            <div className={styles.listState}>Nenhum cupom disponível no momento.</div>
          ) : (
            <ul className={styles.list}>
              {list.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    className={`${styles.item} ${!c.qualifies ? styles.itemBlocked : ''}`}
                    disabled={!c.qualifies || checking}
                    onClick={() => applyCode(c.code)}
                  >
                    <span className={styles.itemIcon}>
                      {c.qualifies ? <Ticket size={18} /> : <Lock size={16} />}
                    </span>

                    <div className={styles.itemLeft}>
                      <span className={styles.itemCode}>{c.code}</span>
                      <span className={styles.itemDesc}>
                        {c.description ||
                          (c.discount_type === 'FREE_DELIVERY'
                            ? 'Frete grátis'
                            : c.discount_type === 'PERCENT'
                              ? `${Number(c.discount_value)}% de desconto`
                              : `${formatMoney(c.discount_value)} de desconto`)}
                      </span>
                      {/* Em vez de sumir com o cupom, mostra quanto falta */}
                      {!c.qualifies && c.missing_amount > 0 && (
                        <span className={styles.itemMissing}>
                          Faltam {formatMoney(c.missing_amount)} no pedido
                        </span>
                      )}
                      {!c.qualifies && c.missing_amount <= 0 && c.reason && (
                        <span className={styles.itemMissing}>{c.reason}</span>
                      )}
                    </div>

                    {c.qualifies && (
                      <span className={styles.itemValue}>-{formatMoney(c.discount)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  if (applied) {
    return (
      <div className={styles.appliedBox}>
        <div className={styles.appliedInfo}>
          <div className={styles.appliedIcon}><Check size={16} /></div>
          <div className={styles.appliedText}>
            <strong>{applied.code}</strong>
            <span>Você economizou {formatMoney(applied.discount)}</span>
          </div>
        </div>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={() => { onApply(null); setError(null); }}
        >
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        <span className={styles.triggerIcon}><Ticket size={18} /></span>
        <span className={styles.triggerText}>
          <strong>Tem um cupom?</strong>
          <small>Ver descontos disponíveis</small>
        </span>
        <ChevronRight size={18} className={styles.chevron} />
      </button>

      {error && !open && (
        <div className={styles.errorBox}><X size={14} /> {error}</div>
      )}

      {mounted && open && createPortal(sheet, document.body)}
    </div>
  );
}

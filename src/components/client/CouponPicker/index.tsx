'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ticket, ChevronDown, Check, X, Loader2, Lock } from 'lucide-react';
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
  const [list, setList] = useState<AvailableCoupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (open) loadCoupons();
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

  if (applied) {
    return (
      <div className={styles.appliedBox}>
        <div className={styles.appliedInfo}>
          <div className={styles.appliedIcon}><Check size={16} /></div>
          <div>
            <strong>{applied.code}</strong>
            <span>Você economizou {formatMoney(applied.discount)}</span>
          </div>
        </div>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={() => { onApply(null); setError(null); }}
        >
          Remover
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)}>
        <div className={styles.triggerLeft}>
          <Ticket size={20} />
          <span>Tem um cupom de desconto?</span>
        </div>
        <ChevronDown size={20} className={open ? styles.chevronUp : styles.chevron} />
      </button>

      {error && (
        <div className={styles.errorBox}>
          <X size={14} /> {error}
        </div>
      )}

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.manualRow}>
            <input
              value={manualCode}
              onChange={(e) => { setManualCode(e.target.value.toUpperCase()); setError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && applyCode(manualCode)}
              placeholder="Digite o código"
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
                    <div className={styles.itemLeft}>
                      <span className={styles.itemCode}>
                        {!c.qualifies && <Lock size={11} />} {c.code}
                      </span>
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
      )}
    </div>
  );
}

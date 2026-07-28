'use client';

import { useState } from 'react';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';
import type { Coupon, CouponDiscountType } from '@/types/coupon';
import { formatMoney } from '@/types/coupon';
import { dateToEndOfDayBRT, dateToStartOfDayBRT, isoToDateInput } from '@/hooks/useCoupons';
import styles from './styles.module.css';

interface Props {
  coupon: Coupon | null;
  onClose: () => void;
  onSave: (payload: Partial<Coupon> & { id?: string }) => Promise<boolean>;
}

export default function CouponModal({ coupon, onClose, onSave }: Props) {
  const [code, setCode] = useState(coupon?.code || '');
  const [description, setDescription] = useState(coupon?.description || '');
  const [type, setType] = useState<CouponDiscountType>(coupon?.discount_type || 'PERCENT');
  const [value, setValue] = useState(String(coupon?.discount_value ?? 10));
  const [cap, setCap] = useState(coupon?.max_discount_value ? String(coupon.max_discount_value) : '15');
  const [minOrder, setMinOrder] = useState(String(coupon?.min_order_value ?? 0));
  const [startsAt, setStartsAt] = useState(isoToDateInput(coupon?.starts_at));
  const [expiresAt, setExpiresAt] = useState(isoToDateInput(coupon?.expires_at));
  const [maxUses, setMaxUses] = useState(coupon?.max_uses ? String(coupon.max_uses) : '');
  const [perPhone, setPerPhone] = useState(coupon?.max_uses_per_phone ? String(coupon.max_uses_per_phone) : '1');
  const [isPublic, setIsPublic] = useState(coupon?.is_public ?? true);
  const [active, setActive] = useState(coupon?.active ?? true);
  const [saving, setSaving] = useState(false);

  const num = (v: string) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!code.trim()) return alert('Informe o código do cupom.');
    if (type === 'PERCENT' && !cap.trim()) {
      return alert('Cupom percentual precisa de um teto em reais. Sem isso, um pedido grande vira um desconto enorme.');
    }

    setSaving(true);
    const ok = await onSave({
      id: coupon?.id,
      code: code.trim().toUpperCase(),
      description: description.trim(),
      discount_type: type,
      discount_value: type === 'FREE_DELIVERY' ? 0 : num(value),
      max_discount_value: type === 'PERCENT' ? num(cap) : null,
      min_order_value: num(minOrder),
      starts_at: dateToStartOfDayBRT(startsAt),
      expires_at: dateToEndOfDayBRT(expiresAt),
      max_uses: maxUses.trim() ? Math.trunc(num(maxUses)) : null,
      max_uses_per_phone: perPhone.trim() ? Math.trunc(num(perPhone)) : null,
      is_public: isPublic,
      active,
    });
    setSaving(false);
    if (ok) onClose();
  };

  // Prévia: mostra ao dono o pior caso antes de salvar
  const preview = () => {
    if (type === 'FREE_DELIVERY') return 'O cliente não paga a taxa de entrega.';
    if (type === 'PERCENT') {
      const exemplo = Math.max(num(minOrder), 100);
      const bruto = (exemplo * num(value)) / 100;
      const final = Math.min(bruto, num(cap) || bruto);
      return `Num pedido de ${formatMoney(exemplo)}, desconta ${formatMoney(final)}${
        bruto > final ? ' (limitado pelo teto)' : ''
      }.`;
    }
    return `Desconta ${formatMoney(num(value))} do subtotal.`;
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>{coupon ? 'Editar cupom' : 'Novo cupom'}</h2>
          <button type="button" onClick={onClose} className={styles.closeBtn}><X size={22} /></button>
        </header>

        <form onSubmit={handleSubmit} className={styles.body}>
          <div className={styles.row}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label>Código *</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PIZZA20"
                className={styles.codeInput}
                maxLength={24}
              />
              <small>O cliente digita isso. Salvo sempre em maiúsculas.</small>
            </div>
            <div className={styles.field} style={{ flex: 2 }}>
              <label>Descrição</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="20% de desconto na primeira pizza"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Tipo de desconto</label>
            <div className={styles.typeGroup}>
              {(['PERCENT', 'FIXED', 'FREE_DELIVERY'] as CouponDiscountType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.typeBtn} ${type === t ? styles.typeActive : ''}`}
                  onClick={() => setType(t)}
                >
                  {t === 'PERCENT' ? 'Porcentagem' : t === 'FIXED' ? 'Valor fixo' : 'Frete grátis'}
                </button>
              ))}
            </div>
          </div>

          {type !== 'FREE_DELIVERY' && (
            <div className={styles.row}>
              <div className={styles.field}>
                <label>{type === 'PERCENT' ? 'Porcentagem (%)' : 'Valor do desconto (R$)'}</label>
                <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
              </div>

              {type === 'PERCENT' && (
                <div className={styles.field}>
                  <label>Desconto máximo (R$) *</label>
                  <input value={cap} onChange={(e) => setCap(e.target.value)} inputMode="decimal" />
                </div>
              )}
            </div>
          )}

          {type === 'PERCENT' && (
            <div className={styles.warnBox}>
              <AlertTriangle size={16} />
              <span>
                O teto é obrigatório. Sem ele, um pedido de festa de R$ 800 com 20% viraria
                R$ 160 de desconto.
              </span>
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Pedido mínimo (R$)</label>
              <input value={minOrder} onChange={(e) => setMinOrder(e.target.value)} inputMode="decimal" />
              <small>0 = sem mínimo</small>
            </div>
            <div className={styles.field}>
              <label>Limite de usos</label>
              <input
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                inputMode="numeric"
                placeholder="ilimitado"
              />
              <small>Em branco = sem limite</small>
            </div>
            <div className={styles.field}>
              <label>Usos por telefone</label>
              <input
                value={perPhone}
                onChange={(e) => setPerPhone(e.target.value)}
                inputMode="numeric"
                placeholder="ilimitado"
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Válido a partir de</label>
              <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Válido até</label>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              <small>Vale o dia inteiro</small>
            </div>
          </div>

          <div className={styles.toggles}>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              <div>
                <strong>Mostrar na lista do cliente</strong>
                <small>Desmarque para cupom secreto: só funciona digitando o código.</small>
              </div>
            </label>

            <label className={styles.checkRow}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <div>
                <strong>Cupom ativo</strong>
                <small>Desmarque para desligar na hora, sem apagar.</small>
              </div>
            </label>
          </div>

          <div className={styles.previewBox}>
            <span className={styles.previewLabel}>Como fica</span>
            <p>{preview()}</p>
          </div>

          <footer className={styles.footer}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? <Loader2 size={18} className={styles.spin} /> : <Save size={18} />}
              {saving ? 'Salvando...' : 'Salvar cupom'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

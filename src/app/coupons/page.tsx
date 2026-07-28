'use client';

import { useState } from 'react';
import {
  Ticket, PlusCircle, Loader2, Power, Pencil, Trash2, EyeOff, Users, TrendingDown,
} from 'lucide-react';
import { useCoupons } from '@/hooks/useCoupons';
import CouponModal from '@/components/admin/CouponModal';
import type { Coupon } from '@/types/coupon';
import { describeDiscount, formatMoney } from '@/types/coupon';
import { STORE_TZ } from '@/lib/storeHours';
import styles from './page.module.css';

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: STORE_TZ });
}

/** Por que o cupom não está valendo agora — o dono precisa ver isso de relance. */
function statusOf(c: Coupon): { label: string; tone: 'ok' | 'off' | 'warn' } {
  if (!c.active) return { label: 'Desativado', tone: 'off' };

  const now = Date.now();
  if (c.starts_at && new Date(c.starts_at).getTime() > now) {
    return { label: `Começa ${formatDate(c.starts_at)}`, tone: 'warn' };
  }
  if (c.expires_at && new Date(c.expires_at).getTime() < now) {
    return { label: 'Expirado', tone: 'off' };
  }
  if (c.max_uses !== null && c.used_count >= c.max_uses) {
    return { label: 'Esgotado', tone: 'off' };
  }
  return { label: 'Ativo', tone: 'ok' };
}

export default function CouponsPage() {
  const { coupons, stats, loading, saveCoupon, toggleActive, deleteCoupon } = useCoupons();
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openNew = () => { setEditing(null); setIsOpen(true); };
  const openEdit = (c: Coupon) => { setEditing(c); setIsOpen(true); };

  const totalGiven = Object.values(stats).reduce((acc, s) => acc + s.total_discount, 0);
  const totalUses = Object.values(stats).reduce((acc, s) => acc + s.redemptions, 0);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spin} size={40} />
        <p>Carregando cupons...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Cupons</h1>
          <p>Crie descontos e acompanhe quanto cada um está custando.</p>
        </div>
        <button className={styles.newBtn} onClick={openNew}>
          <PlusCircle size={20} /> Novo cupom
        </button>
      </header>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}><Ticket size={14} /> Cupons cadastrados</span>
          <strong>{coupons.length}</strong>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}><Users size={14} /> Vezes utilizados</span>
          <strong>{totalUses}</strong>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}><TrendingDown size={14} /> Desconto concedido</span>
          <strong className={styles.kpiMoney}>{formatMoney(totalGiven)}</strong>
        </div>
      </div>

      {coupons.length === 0 ? (
        <div className={styles.empty}>
          <Ticket size={56} />
          <h2>Nenhum cupom ainda</h2>
          <p>Crie o primeiro e ele aparece na hora do fechamento do pedido.</p>
          <button className={styles.newBtn} onClick={openNew}>
            <PlusCircle size={20} /> Criar cupom
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {coupons.map((c) => {
            const st = statusOf(c);
            const s = stats[c.id];
            const usage = c.max_uses ? `${c.used_count}/${c.max_uses}` : `${c.used_count}`;

            return (
              <div key={c.id} className={`${styles.card} ${!c.active ? styles.cardOff : ''}`}>
                <div className={styles.cardTop}>
                  <div className={styles.codeBox}>
                    <span className={styles.code}>{c.code}</span>
                    {!c.is_public && (
                      <span className={styles.secret} title="Não aparece na lista do cliente">
                        <EyeOff size={12} /> secreto
                      </span>
                    )}
                  </div>
                  <span className={`${styles.status} ${styles[st.tone]}`}>{st.label}</span>
                </div>

                <p className={styles.discount}>{describeDiscount(c)}</p>
                {c.description && <p className={styles.desc}>{c.description}</p>}

                <ul className={styles.rules}>
                  {c.min_order_value > 0 && (
                    <li>Pedido mínimo de {formatMoney(c.min_order_value)}</li>
                  )}
                  {c.expires_at && <li>Vale até {formatDate(c.expires_at)}</li>}
                  {c.starts_at && <li>A partir de {formatDate(c.starts_at)}</li>}
                  {c.max_uses !== null && <li>Limite de {c.max_uses} usos</li>}
                  {c.max_uses_per_phone !== null && (
                    <li>{c.max_uses_per_phone}x por telefone</li>
                  )}
                </ul>

                <div className={styles.metrics}>
                  <div>
                    <span>Usos</span>
                    <strong>{usage}</strong>
                  </div>
                  <div>
                    <span>Desconto dado</span>
                    <strong className={styles.kpiMoney}>
                      {formatMoney(s?.total_discount || 0)}
                    </strong>
                  </div>
                </div>

                <div className={styles.actions}>
                  <button
                    className={`${styles.toggleBtn} ${c.active ? styles.on : styles.off}`}
                    onClick={() => toggleActive(c)}
                    title={c.active ? 'Desativar' : 'Ativar'}
                  >
                    <Power size={15} /> {c.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button className={styles.iconBtn} onClick={() => openEdit(c)} title="Editar">
                    <Pencil size={15} />
                  </button>
                  <button
                    className={`${styles.iconBtn} ${styles.danger}`}
                    onClick={() => deleteCoupon(c)}
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isOpen && (
        <CouponModal
          coupon={editing}
          onClose={() => setIsOpen(false)}
          onSave={saveCoupon}
        />
      )}
    </div>
  );
}

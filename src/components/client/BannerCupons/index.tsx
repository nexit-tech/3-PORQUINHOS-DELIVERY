'use client';

import { useEffect, useState } from 'react';
import { Ticket, ChevronRight } from 'lucide-react';
import { supabase } from '@/services/supabase';
import type { AvailableCoupon } from '@/types/coupon';
import styles from './styles.module.css';

/**
 * Faixa de cupons no topo do cardápio.
 *
 * Mostra cupons REAIS, vindos de list_available_coupons — a mesma RPC do
 * seletor no checkout, que é liberada para `anon`. Não inventa oferta:
 * se a loja não tiver cupom público ativo, a faixa simplesmente não
 * aparece, em vez de anunciar um desconto que não existe.
 *
 * Aqui o subtotal vai como 0 de propósito. Nesse ponto o cliente ainda
 * não montou carrinho, então `qualifies` não interessa — a faixa é
 * vitrine, e quem valida de verdade é o create_order.
 */
export default function BannerCupons() {
  const [cupons, setCupons] = useState<AvailableCoupon[]>([]);

  useEffect(() => {
    let vivo = true;

    supabase
      .rpc('list_available_coupons', { p_subtotal: 0, p_delivery_fee: 0 })
      .then(({ data, error }) => {
        if (!vivo || error || !Array.isArray(data)) return;
        setCupons(data as AvailableCoupon[]);
      });

    return () => {
      vivo = false;
    };
  }, []);

  if (cupons.length === 0) return null;

  const rotulo = (c: AvailableCoupon) => {
    if (c.discount_type === 'FREE_DELIVERY') return 'Frete grátis';
    if (c.discount_type === 'PERCENT') return `${Math.round(c.discount_value)}% OFF`;
    return `${c.discount_value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })} OFF`;
  };

  const minimo = (c: AvailableCoupon) =>
    c.min_order_value > 0
      ? `Acima de ${c.min_order_value.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })}`
      : 'Sem valor mínimo';

  return (
    <section className={styles.faixa} aria-label="Cupons disponíveis">
      <div className={styles.cabecalho}>
        <h2>
          <Ticket size={16} /> Cupons de hoje
        </h2>
        <span className={styles.dica}>
          use no checkout <ChevronRight size={13} />
        </span>
      </div>

      <div className={styles.trilho}>
        {cupons.map((c) => (
          <article key={c.code} className={styles.cupom}>
            <div className={styles.selo}>{rotulo(c)}</div>
            <div className={styles.info}>
              <strong>{c.code}</strong>
              <small>{c.description || minimo(c)}</small>
            </div>
            {/* Recorte de bilhete: os dois semicírculos nas laterais. */}
            <span className={`${styles.recorte} ${styles.recorteEsq}`} aria-hidden="true" />
            <span className={`${styles.recorte} ${styles.recorteDir}`} aria-hidden="true" />
          </article>
        ))}
      </div>
    </section>
  );
}

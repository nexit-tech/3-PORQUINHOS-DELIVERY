// src/hooks/useCoupons.ts
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/services/supabase';
import type { Coupon } from '@/types/coupon';
import { STORE_TZ } from '@/lib/storeHours';

export interface CouponStats {
  coupon_id: string;
  redemptions: number;
  total_discount: number;
}

/**
 * Converte "2026-08-15" (input type=date) para o FIM daquele dia no fuso da
 * loja.
 *
 * Sem isso o cupom morreria às 21h do dia 14: um date puro vira meia-noite
 * UTC, que é 21:00 do dia anterior em Brasília. O dono marca 15/08 esperando
 * que valha o dia 15 inteiro.
 */
export function dateToEndOfDayBRT(date: string | null | undefined): string | null {
  if (!date) return null;
  return `${date}T23:59:59.999-03:00`;
}

/** Começo do dia, para a data inicial. */
export function dateToStartOfDayBRT(date: string | null | undefined): string | null {
  if (!date) return null;
  return `${date}T00:00:00.000-03:00`;
}

/** timestamptz do banco -> "YYYY-MM-DD" para preencher o input type=date. */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d);
}

export function useCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<Record<string, CouponStats>>({});
  const [loading, setLoading] = useState(true);

  const fetchCoupons = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('active', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons((data as Coupon[]) || []);

      // Métricas: quantas vezes usou e quanto deu de desconto
      const { data: redemptions } = await supabase
        .from('coupon_redemptions')
        .select('coupon_id, discount_amount, is_active');

      const agg: Record<string, CouponStats> = {};
      (redemptions || []).forEach((r: any) => {
        if (!r.is_active) return;
        if (!agg[r.coupon_id]) {
          agg[r.coupon_id] = { coupon_id: r.coupon_id, redemptions: 0, total_discount: 0 };
        }
        agg[r.coupon_id].redemptions += 1;
        agg[r.coupon_id].total_discount += Number(r.discount_amount);
      });
      setStats(agg);
    } catch (error) {
      console.error('Erro ao buscar cupons:', error);
      toast.error('Não foi possível carregar os cupons.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  async function saveCoupon(payload: Partial<Coupon> & { id?: string }) {
    try {
      const body = {
        code: payload.code,
        description: payload.description || null,
        discount_type: payload.discount_type,
        discount_value: payload.discount_value ?? 0,
        max_discount_value: payload.max_discount_value ?? null,
        min_order_value: payload.min_order_value ?? 0,
        starts_at: payload.starts_at ?? null,
        expires_at: payload.expires_at ?? null,
        max_uses: payload.max_uses ?? null,
        max_uses_per_phone: payload.max_uses_per_phone ?? null,
        is_public: payload.is_public ?? true,
        active: payload.active ?? true,
      };

      const { error } = payload.id
        ? await supabase.from('coupons').update(body).eq('id', payload.id)
        : await supabase.from('coupons').insert(body);

      if (error) throw error;

      toast.success(payload.id ? 'Cupom atualizado!' : 'Cupom criado!');
      await fetchCoupons();
      return true;
    } catch (error: any) {
      console.error('Erro ao salvar cupom:', error);

      // Traduz as violações de constraint para algo que o dono entenda
      const msg: string = error?.message || '';
      if (msg.includes('coupons_code_unique')) {
        toast.error('Já existe um cupom com esse código.');
      } else if (msg.includes('coupons_percent_range')) {
        toast.error('Cupom percentual precisa de um valor entre 1 e 100 e de um teto em reais.');
      } else if (msg.includes('coupons_fixed_positive')) {
        toast.error('O valor do desconto precisa ser maior que zero.');
      } else if (msg.includes('coupons_window_coherent')) {
        toast.error('A data final precisa ser depois da data inicial.');
      } else {
        toast.error('Erro ao salvar o cupom.');
      }
      return false;
    }
  }

  async function toggleActive(coupon: Coupon) {
    // Otimista: o dono espera resposta imediata no botão de pânico
    setCoupons((prev) =>
      prev.map((c) => (c.id === coupon.id ? { ...c, active: !c.active } : c))
    );

    const { error } = await supabase
      .from('coupons')
      .update({ active: !coupon.active })
      .eq('id', coupon.id);

    if (error) {
      console.error(error);
      toast.error('Erro ao alterar o cupom.');
      fetchCoupons();
      return;
    }

    toast.success(!coupon.active ? 'Cupom ativado' : 'Cupom desativado');
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!confirm(`Excluir o cupom ${coupon.code}? Essa ação não pode ser desfeita.`)) return;

    const { error } = await supabase.from('coupons').delete().eq('id', coupon.id);

    if (error) {
      console.error(error);
      toast.error('Não foi possível excluir. Se o cupom já foi usado, prefira desativá-lo.');
      return;
    }

    toast.success('Cupom excluído');
    fetchCoupons();
  }

  return { coupons, stats, loading, fetchCoupons, saveCoupon, toggleActive, deleteCoupon };
}

// src/types/coupon.ts
export type CouponDiscountType = 'PERCENT' | 'FIXED' | 'FREE_DELIVERY';

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  max_discount_value: number | null;
  min_order_value: number;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  max_uses_per_phone: number | null;
  is_public: boolean;
  active: boolean;
  created_at: string;
}

/** Uma linha do dropdown do checkout (vem de list_available_coupons). */
export interface AvailableCoupon {
  code: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_value: number;
  expires_at: string | null;
  qualifies: boolean;
  reason: string | null;
  discount: number;
  missing_amount: number;
}

/** Resultado de evaluate_coupon. */
export interface CouponEvaluation {
  valid: boolean;
  reason: string | null;
  coupon_id: string | null;
  code: string | null;
  discount: number;
}

export const DISCOUNT_TYPE_LABEL: Record<CouponDiscountType, string> = {
  PERCENT: 'Percentual',
  FIXED: 'Valor fixo',
  FREE_DELIVERY: 'Frete grátis',
};

export const formatMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

/** "20% (máx. R$ 15,00)" — usado no admin e no dropdown do cliente. */
export function describeDiscount(c: {
  discount_type: CouponDiscountType;
  discount_value: number;
  max_discount_value?: number | null;
}): string {
  if (c.discount_type === 'FREE_DELIVERY') return 'Frete grátis';

  if (c.discount_type === 'PERCENT') {
    const cap = c.max_discount_value ? ` (máx. ${formatMoney(c.max_discount_value)})` : '';
    return `${Number(c.discount_value)}% de desconto${cap}`;
  }

  return `${formatMoney(c.discount_value)} de desconto`;
}

-- =====================================================================
-- 03b - get_orders_by_phone: "Meus Pedidos" do cliente
-- =====================================================================
-- Separada do 04 de propósito: este arquivo só CRIA função (aditivo e
-- seguro de rodar a qualquer momento), enquanto o 04 mexe em políticas e
-- tranca o acesso — esse sim precisa ser sincronizado com o deploy.
--
-- Por que existe: hoje a tela de histórico faz
--   supabase.from('orders').select('*').eq('customer_phone', ...)
-- Como o filtro é do lado do cliente, qualquer visitante podia trocar o
-- filtro e baixar a base inteira de nome + telefone + endereço. Depois do
-- 04, `anon` perde o SELECT direto em `orders` e passa a usar esta função,
-- que só devolve os pedidos do telefone informado.
--
-- Os casts explícitos são obrigatórios: RETURNS TABLE exige tipo exato, e
-- no banco real `orders.status` é um ENUM (order_status), não text.
-- =====================================================================

-- DROP antes: mudar as colunas do RETURNS TABLE é mudar o tipo de retorno,
-- e o Postgres recusa isso num CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.get_orders_by_phone(text, boolean);

CREATE OR REPLACE FUNCTION public.get_orders_by_phone(
  p_phone       text,
  p_only_active boolean DEFAULT true
)
RETURNS TABLE (
  id               bigint,
  customer_name    text,
  customer_phone   text,
  customer_address text,
  payment_method   text,
  status           text,
  subtotal         numeric,
  total            numeric,
  delivery_fee     numeric,
  discount         numeric,
  coupon_code      text,
  created_at       timestamptz,
  updated_at       timestamptz,
  items            jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    o.id::bigint,
    o.customer_name::text,
    o.customer_phone::text,
    o.customer_address::text,
    o.payment_method::text,
    o.status::text,
    COALESCE(o.subtotal, o.total - COALESCE(o.delivery_fee, 0))::numeric,
    o.total::numeric,
    o.delivery_fee::numeric,
    COALESCE(o.discount, 0)::numeric,
    o.coupon_code::text,
    o.created_at::timestamptz,
    o.updated_at::timestamptz,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',           oi.id,
            'product_name', oi.product_name,
            'quantity',     oi.quantity,
            'unit_price',   oi.unit_price,
            'total_price',  oi.total_price,
            'observation',  oi.observation
          )
        )
        FROM order_items oi
        WHERE oi.order_id = o.id
      ),
      '[]'::jsonb
    ) AS items
  FROM orders o
  -- Mesma canonicalização usada no limite por cupom: máscara e DDI 55 têm
  -- que cair no mesmo cliente
  WHERE public.normalize_phone(o.customer_phone) = public.normalize_phone(p_phone)
    AND (NOT p_only_active OR o.status::text NOT IN ('COMPLETED', 'CANCELED'))
  ORDER BY o.created_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_by_phone(text, boolean) TO anon, authenticated;

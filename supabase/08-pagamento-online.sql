-- =====================================================================
-- 08 - Pagamento online (InfinitePay Checkout)
-- =====================================================================
-- O sistema nasceu "pagar na entrega": orders.status significava só o
-- andamento na cozinha, e dinheiro era problema do entregador.
--
-- Com pagamento online isso deixa de fechar, porque passam a existir
-- estados que o status sozinho não representa:
--
--   pago mas ainda não aceito       (tem que ir pra cozinha)
--   aceito mas não pago             (NÃO pode ir pra cozinha)
--   criado e abandonado no checkout (não é venda, não é cancelamento)
--
-- Por isso o pagamento vira um EIXO SEPARADO. `status` continua sendo o
-- andamento do preparo; `payment_status` responde "o dinheiro entrou?".
--
-- Regra que sustenta o resto: pedido com payment_status = 'AWAITING'
-- NÃO É PEDIDO AINDA. Ele não aparece no painel e não conta no faturamento.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Colunas de pagamento
-- ---------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'ON_DELIVERY';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_transaction_nsu text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_receipt_url text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method_detail text;   -- 'pix' | 'credit_card'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_amount_cents integer; -- o que a operadora confirmou
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_requested_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_paid_at timestamptz;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_ck;
ALTER TABLE orders ADD  CONSTRAINT orders_payment_status_ck CHECK (
  payment_status IN ('ON_DELIVERY', 'AWAITING', 'PAID', 'FAILED', 'EXPIRED')
);

-- Os 464 pedidos antigos são todos "pagar na entrega"
UPDATE orders SET payment_status = 'ON_DELIVERY' WHERE payment_status IS NULL;

-- A transação da operadora é única: é a trava contra confirmar duas vezes
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_transaction_uidx
  ON orders (payment_transaction_nsu) WHERE payment_transaction_nsu IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders (payment_status);


-- ---------------------------------------------------------------------
-- create_order() com escolha do fluxo de pagamento
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_order(text, text, text, text, text, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_address text,
  p_payment_method   text,
  p_delivery_type    text,
  p_neighborhood     text,
  p_items            jsonb,
  p_coupon_code      text DEFAULT NULL,
  -- 'on_delivery' mantém o comportamento antigo.
  -- 'online' cria o pedido em AWAITING: ele não vale nada até o dinheiro entrar.
  p_payment_flow     text DEFAULT 'on_delivery'
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id     bigint;
  v_delivery_fee numeric := 0;
  v_subtotal     numeric := 0;
  v_discount     numeric := 0;
  v_item         jsonb;
  v_product      record;
  v_extras       numeric;
  v_unit_price   numeric;
  v_total_price  numeric;
  v_qty          integer;
  v_sent_opts    integer;
  v_found_opts   integer;
  v_coupon       record;
  v_claimed      uuid;
  v_phone_digits text;
  v_used_phone   integer;
  v_limit_phone  integer;
  v_coupon_id    uuid := NULL;
  v_coupon_code  text := NULL;
  v_pay_status   text;
BEGIN
  IF p_customer_name IS NULL OR btrim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Informe o nome do cliente';
  END IF;

  IF p_customer_phone IS NULL OR btrim(p_customer_phone) = '' THEN
    RAISE EXCEPTION 'Informe o telefone do cliente';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sem itens';
  END IF;

  IF p_payment_flow NOT IN ('on_delivery', 'online') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;

  IF NOT public.is_store_open() THEN
    RAISE EXCEPTION 'A loja está fechada no momento';
  END IF;

  v_pay_status   := CASE WHEN p_payment_flow = 'online' THEN 'AWAITING' ELSE 'ON_DELIVERY' END;
  v_phone_digits := public.normalize_phone(p_customer_phone);

  IF p_delivery_type = 'delivery' THEN
    SELECT fee INTO v_delivery_fee
      FROM delivery_zones
     WHERE neighborhood = p_neighborhood AND active = true
     LIMIT 1;

    IF v_delivery_fee IS NULL THEN
      RAISE EXCEPTION 'Não entregamos no bairro %', p_neighborhood;
    END IF;
  ELSE
    v_delivery_fee := 0;
  END IF;

  INSERT INTO orders (
    customer_name, customer_phone, customer_address,
    payment_method, delivery_fee, subtotal, discount, total, status,
    payment_status, payment_requested_at
  )
  VALUES (
    p_customer_name, p_customer_phone, p_customer_address,
    p_payment_method, v_delivery_fee, 0, 0, 0, 'PENDING',
    v_pay_status,
    CASE WHEN p_payment_flow = 'online' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 0);

    IF v_qty < 1 OR v_qty > 99 THEN
      RAISE EXCEPTION 'Quantidade inválida: %', v_qty;
    END IF;

    SELECT id, name, price INTO v_product
      FROM products
     WHERE id::text = v_item->>'product_id'
       AND active IS DISTINCT FROM false;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto indisponível no momento';
    END IF;

    SELECT COALESCE(sum(co.price), 0), count(*) INTO v_extras, v_found_opts
      FROM complement_options co
      JOIN product_complements pc ON pc.group_id = co.group_id
     WHERE pc.product_id::text = v_product.id::text
       AND co.is_active IS DISTINCT FROM false
       AND co.id::text IN (
         SELECT value FROM jsonb_array_elements_text(COALESCE(v_item->'option_ids', '[]'::jsonb))
       );

    SELECT count(*) INTO v_sent_opts
      FROM jsonb_array_elements_text(COALESCE(v_item->'option_ids', '[]'::jsonb));

    IF v_found_opts <> v_sent_opts THEN
      RAISE EXCEPTION 'O cardápio foi atualizado. Atualize a página e monte o pedido novamente.';
    END IF;

    v_unit_price  := v_product.price + v_extras;
    v_total_price := v_unit_price * v_qty;
    v_subtotal    := v_subtotal + v_total_price;

    INSERT INTO order_items (
      order_id, product_id, product_name, quantity,
      unit_price, total_price, observation, customizations
    )
    VALUES (
      v_order_id, v_product.id, v_product.name, v_qty,
      v_unit_price, v_total_price,
      NULLIF(v_item->>'observation', ''),
      COALESCE(v_item->'customizations', '{}'::jsonb)
    );
  END LOOP;

  v_subtotal := ROUND(v_subtotal, 2);

  IF public.normalize_coupon_code(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon
      FROM public.evaluate_coupon(
        p_coupon_code, v_subtotal, v_delivery_fee, p_customer_phone, p_delivery_type
      );

    IF NOT v_coupon.valid THEN
      RAISE EXCEPTION '%', v_coupon.reason;
    END IF;

    UPDATE coupons
       SET used_count = used_count + 1
     WHERE id = v_coupon.coupon_id
       AND active
       AND (max_uses IS NULL OR used_count < max_uses)
    RETURNING id INTO v_claimed;

    IF v_claimed IS NULL THEN
      RAISE EXCEPTION 'Este cupom esgotou';
    END IF;

    SELECT c.max_uses_per_phone INTO v_limit_phone FROM coupons c WHERE c.id = v_claimed;

    IF v_limit_phone IS NOT NULL AND v_phone_digits <> '' THEN
      SELECT count(*) INTO v_used_phone
        FROM coupon_redemptions r
       WHERE r.coupon_id = v_claimed AND r.is_active AND r.customer_phone = v_phone_digits;

      IF v_used_phone >= v_limit_phone THEN
        RAISE EXCEPTION 'Você já usou este cupom';
      END IF;
    END IF;

    v_discount    := v_coupon.discount;
    v_coupon_id   := v_coupon.coupon_id;
    v_coupon_code := v_coupon.code;

    INSERT INTO coupon_redemptions (coupon_id, order_id, customer_phone, discount_amount)
    VALUES (v_claimed, v_order_id, v_phone_digits, v_discount);
  END IF;

  UPDATE orders
     SET subtotal    = v_subtotal,
         discount    = v_discount,
         coupon_id   = v_coupon_id,
         coupon_code = v_coupon_code,
         total       = GREATEST(ROUND(v_subtotal + v_delivery_fee - v_discount, 2), 0)
   WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order(
  text, text, text, text, text, text, jsonb, text, text
) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- get_order_for_payment(): o servidor monta a cobrança a partir DAQUI
-- ---------------------------------------------------------------------
-- Nunca a partir do que o navegador mandar. É o mesmo princípio do
-- create_order: valor é assunto do banco.
CREATE OR REPLACE FUNCTION public.get_order_for_payment(p_order_id bigint)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'id',             o.id,
    'customer_name',  o.customer_name,
    'customer_phone', o.customer_phone,
    'status',         o.status::text,
    'payment_status', o.payment_status,
    'subtotal',       o.subtotal,
    'delivery_fee',   o.delivery_fee,
    'discount',       o.discount,
    'coupon_code',    o.coupon_code,
    'total',          o.total,
    'total_cents',    ROUND(o.total * 100)::int,
    'items',          COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'product_name', oi.product_name,
        'quantity',     oi.quantity,
        'total_price',  oi.total_price
      ) ORDER BY oi.id)
      FROM order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM orders o
  WHERE o.id = p_order_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_for_payment(bigint) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- mark_order_paid(): o único caminho para um pedido virar PAGO
-- ---------------------------------------------------------------------
-- Idempotente e com conferência de valor.
--
-- O webhook da InfinitePay não vem assinado, então ele é apenas um AVISO.
-- Quem chama esta função é o servidor, DEPOIS de confirmar com o
-- payment_check da operadora. Mesmo assim, o valor é reconferido aqui:
-- confiar em um número só porque veio do backend é como o total do pedido
-- vinha do navegador antes.
CREATE OR REPLACE FUNCTION public.mark_order_paid(
  p_order_id        bigint,
  p_transaction_nsu text,
  p_amount_cents    integer,
  p_capture_method  text DEFAULT NULL,
  p_receipt_url     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o            record;
  v_expected   integer;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Pedido não encontrado');
  END IF;

  -- Já confirmado: responde sucesso sem fazer nada.
  -- O webhook é reenviado quando a resposta não é 200, então chegar duas
  -- vezes é o caso normal, não a exceção.
  IF o.payment_status = 'PAID' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'order_id', o.id);
  END IF;

  IF o.payment_status NOT IN ('AWAITING', 'FAILED', 'EXPIRED') THEN
    RETURN jsonb_build_object('ok', false, 'reason',
      'Pedido não está aguardando pagamento (' || o.payment_status || ')');
  END IF;

  v_expected := ROUND(o.total * 100)::int;

  IF p_amount_cents IS DISTINCT FROM v_expected THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'Valor divergente',
      'expected_cents', v_expected,
      'received_cents', p_amount_cents
    );
  END IF;

  UPDATE orders
     SET payment_status         = 'PAID',
         payment_provider       = 'infinitepay',
         payment_transaction_nsu = p_transaction_nsu,
         payment_amount_cents   = p_amount_cents,
         payment_method_detail  = p_capture_method,
         payment_receipt_url    = p_receipt_url,
         payment_paid_at        = now(),
         -- Pago é pedido de verdade: entra na fila como qualquer outro
         status                 = CASE WHEN o.status = 'CANCELED' THEN o.status ELSE 'PENDING' END,
         updated_at             = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

-- Só o servidor (service_role) chama. Nunca o navegador: senão qualquer um
-- marcaria o próprio pedido como pago.
REVOKE ALL ON FUNCTION public.mark_order_paid(bigint, text, integer, text, text) FROM anon, authenticated, public;


-- ---------------------------------------------------------------------
-- expire_abandoned_orders(): limpa carrinho que virou pedido e sumiu
-- ---------------------------------------------------------------------
-- Quem abre o checkout da operadora e desiste deixa um pedido AWAITING
-- para sempre — e, se usou cupom, segurando um uso que não vai voltar.
-- Marcar como CANCELED dispara o trigger que devolve o cupom.
CREATE OR REPLACE FUNCTION public.expire_abandoned_orders(p_minutes integer DEFAULT 45)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expirados AS (
    UPDATE orders
       SET payment_status = 'EXPIRED',
           status         = 'CANCELED',
           updated_at     = now()
     WHERE payment_status = 'AWAITING'
       AND payment_requested_at < now() - make_interval(mins => p_minutes)
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM expirados;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_abandoned_orders(integer) FROM anon, authenticated, public;


-- ---------------------------------------------------------------------
-- Ajuste no histórico do cliente
-- ---------------------------------------------------------------------
-- O cliente precisa enxergar o pedido dele mesmo antes de pagar (é como
-- ele volta pro pagamento se fechar a aba no meio).
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
  payment_status   text,
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
    o.payment_status::text,
    COALESCE(o.subtotal, o.total - COALESCE(o.delivery_fee, 0))::numeric,
    o.total::numeric,
    o.delivery_fee::numeric,
    COALESCE(o.discount, 0)::numeric,
    o.coupon_code::text,
    o.created_at::timestamptz,
    o.updated_at::timestamptz,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id, 'product_name', oi.product_name, 'quantity', oi.quantity,
        'unit_price', oi.unit_price, 'total_price', oi.total_price,
        'observation', oi.observation
      ))
      FROM order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  FROM orders o
  WHERE public.normalize_phone(o.customer_phone) = public.normalize_phone(p_phone)
    AND (NOT p_only_active OR o.status::text NOT IN ('COMPLETED', 'CANCELED'))
  ORDER BY o.created_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_by_phone(text, boolean) TO anon, authenticated;

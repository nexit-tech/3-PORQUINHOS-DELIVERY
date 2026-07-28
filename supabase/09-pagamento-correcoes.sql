-- =====================================================================
-- 09 - Correções da revisão adversarial do fluxo de pagamento
-- =====================================================================
-- Cada bloco abaixo fecha um furo concreto encontrado na revisão.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. VAZAMENTO: get_order_for_payment estava aberta para anon
-- ---------------------------------------------------------------------
-- A função é SECURITY DEFINER, recebe um id SEQUENCIAL e devolve nome,
-- telefone, endereço, itens e total. Com o GRANT para anon, um laço de
-- 1 a 5000 raspava a base inteira de clientes — exatamente o buraco que
-- o 04-rls-pedidos.sql tinha fechado.
--
-- Quem usa a função é só o servidor, com service_role. O GRANT era grátis.
REVOKE ALL ON FUNCTION public.get_order_for_payment(bigint) FROM anon, authenticated, PUBLIC;


-- ---------------------------------------------------------------------
-- 2. Auditoria de pagamento
-- ---------------------------------------------------------------------
-- Sem isto não há como investigar "o cliente diz que pagou": a única
-- pista era console.error no log do Railway.
CREATE TABLE IF NOT EXISTS payment_attempts (
  id              bigserial PRIMARY KEY,
  order_id        bigint REFERENCES orders(id) ON DELETE CASCADE,
  transaction_nsu text,
  amount_cents    integer,
  paid            boolean,
  outcome         text,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_attempts_order_idx ON payment_attempts (order_id, created_at DESC);

ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_attempts_admin ON payment_attempts;
CREATE POLICY payment_attempts_admin ON payment_attempts FOR SELECT
  TO authenticated USING (true);


-- ---------------------------------------------------------------------
-- 3. Pedido pago que acabou cancelado precisa GRITAR
-- ---------------------------------------------------------------------
-- Antes: o dinheiro entrava, o pedido sumia do painel (filtra CANCELED),
-- sumia do financeiro (só COMPLETED), sumia do histórico do cliente, e
-- o cupom era devolvido. Ninguém ficava sabendo que havia dinheiro preso.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_needs_refund boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_conflict_reason text;

CREATE INDEX IF NOT EXISTS orders_needs_refund_idx
  ON orders (payment_needs_refund) WHERE payment_needs_refund;

-- Cancelar um pedido JÁ PAGO, por qualquer caminho, levanta a bandeira
CREATE OR REPLACE FUNCTION public.flag_refund_on_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'CANCELED'
     AND OLD.status IS DISTINCT FROM 'CANCELED'
     AND NEW.payment_status = 'PAID' THEN
    NEW.payment_needs_refund   := true;
    NEW.payment_conflict_reason := COALESCE(NEW.payment_conflict_reason,
      'Pedido cancelado depois de pago — verificar estorno');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_flag_refund_trg ON orders;
CREATE TRIGGER orders_flag_refund_trg
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION public.flag_refund_on_cancel();


-- ---------------------------------------------------------------------
-- 4. mark_order_paid: distingue falha permanente de temporária,
--    registra tudo e nunca engole um pagamento
-- ---------------------------------------------------------------------
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
  o          record;
  v_expected integer;
  v_nsu      text := btrim(COALESCE(p_transaction_nsu, ''));
  v_outra    bigint;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO payment_attempts(order_id, transaction_nsu, amount_cents, paid, outcome, reason)
    VALUES (NULL, v_nsu, p_amount_cents, true, 'REJECTED', 'Pedido não encontrado');
    RETURN jsonb_build_object('ok', false, 'permanent', true, 'reason', 'Pedido não encontrado');
  END IF;

  -- Já pago. Só é "reenvio do webhook" se for a MESMA transação; uma
  -- transação diferente significa que o cliente pagou duas vezes, e isso
  -- não pode ser descartado em silêncio.
  IF o.payment_status = 'PAID' THEN
    IF o.payment_transaction_nsu IS DISTINCT FROM v_nsu THEN
      UPDATE orders
         SET payment_needs_refund    = true,
             payment_conflict_reason = 'Segundo pagamento recebido para o mesmo pedido — verificar devolução'
       WHERE id = o.id;

      INSERT INTO payment_attempts(order_id, transaction_nsu, amount_cents, paid, outcome, reason)
      VALUES (o.id, v_nsu, p_amount_cents, true, 'DUPLICATE', 'Pedido já estava pago com outra transação');

      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'order_id', o.id);
    END IF;

    RETURN jsonb_build_object('ok', true, 'already', true, 'order_id', o.id);
  END IF;

  -- A mesma transação não pode pagar dois pedidos
  SELECT id INTO v_outra FROM orders
   WHERE payment_transaction_nsu = v_nsu AND id <> o.id LIMIT 1;

  IF v_outra IS NOT NULL THEN
    INSERT INTO payment_attempts(order_id, transaction_nsu, amount_cents, paid, outcome, reason)
    VALUES (o.id, v_nsu, p_amount_cents, true, 'REJECTED',
            'Transação já usada no pedido ' || v_outra);
    RETURN jsonb_build_object('ok', false, 'permanent', true, 'reason', 'Transação já utilizada');
  END IF;

  IF o.payment_status NOT IN ('AWAITING', 'FAILED', 'EXPIRED') THEN
    INSERT INTO payment_attempts(order_id, transaction_nsu, amount_cents, paid, outcome, reason)
    VALUES (o.id, v_nsu, p_amount_cents, true, 'REJECTED',
            'payment_status = ' || o.payment_status);
    RETURN jsonb_build_object('ok', false, 'permanent', true,
      'reason', 'Pedido não está aguardando pagamento');
  END IF;

  v_expected := ROUND(o.total * 100)::int;

  IF p_amount_cents IS DISTINCT FROM v_expected THEN
    -- Divergência é definitiva: reenviar não muda o valor. Marca FAILED
    -- para o pedido aparecer na tela de pagamentos em vez de sumir.
    UPDATE orders
       SET payment_status          = 'FAILED',
           payment_conflict_reason = 'Valor divergente: cobrado ' || COALESCE(p_amount_cents::text,'?')
                                     || ' esperado ' || v_expected
     WHERE id = o.id;

    INSERT INTO payment_attempts(order_id, transaction_nsu, amount_cents, paid, outcome, reason)
    VALUES (o.id, v_nsu, p_amount_cents, true, 'MISMATCH',
            'Esperado ' || v_expected || ' recebido ' || COALESCE(p_amount_cents::text,'null'));

    RETURN jsonb_build_object('ok', false, 'permanent', true, 'reason', 'Valor divergente',
      'expected_cents', v_expected, 'received_cents', p_amount_cents);
  END IF;

  UPDATE orders
     SET payment_status          = 'PAID',
         payment_provider        = 'infinitepay',
         payment_transaction_nsu = v_nsu,
         payment_amount_cents    = p_amount_cents,
         payment_method_detail   = p_capture_method,
         payment_receipt_url     = COALESCE(p_receipt_url, o.payment_receipt_url),
         payment_paid_at         = now(),
         -- Cancelado antes de o pagamento chegar (expiração ou recusa da
         -- loja): o dinheiro entrou mesmo assim. Reabre se a expiração foi
         -- automática, e marca conflito se foi a loja que recusou.
         status = CASE
                    WHEN o.status = 'CANCELED' AND o.payment_status = 'EXPIRED' THEN 'PENDING'
                    ELSE o.status
                  END,
         payment_needs_refund = (o.status = 'CANCELED' AND o.payment_status <> 'EXPIRED'),
         payment_conflict_reason = CASE
            WHEN o.status = 'CANCELED' AND o.payment_status <> 'EXPIRED'
              THEN 'Pagamento chegou depois de a loja cancelar — verificar estorno'
            WHEN NOT public.is_store_open()
              THEN 'Pago com a loja fechada — confirmar com o cliente'
            ELSE NULL
          END,
         updated_at = now()
   WHERE id = p_order_id;

  INSERT INTO payment_attempts(order_id, transaction_nsu, amount_cents, paid, outcome, reason)
  VALUES (o.id, v_nsu, p_amount_cents, true, 'PAID', NULL);

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_order_paid(bigint, text, integer, text, text)
  FROM anon, authenticated, PUBLIC;


-- ---------------------------------------------------------------------
-- 5. Cupom FIXED que zera o total travava o pedido
-- ---------------------------------------------------------------------
-- Retirada no local (frete 0) + cupom de valor maior que o subtotal =
-- total R$ 0,00. O pedido já estava gravado e o uso do cupom já queimado
-- quando o criar-link recusava com "Pedido sem valor a cobrar".
CREATE OR REPLACE FUNCTION public.evaluate_coupon(
  p_code          text,
  p_subtotal      numeric,
  p_delivery_fee  numeric DEFAULT 0,
  p_phone         text    DEFAULT NULL,
  p_delivery_type text    DEFAULT 'delivery'
)
RETURNS TABLE (
  valid       boolean,
  reason      text,
  coupon_id   uuid,
  code        text,
  discount    numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  c            coupons%ROWTYPE;
  v_code       text := public.normalize_coupon_code(p_code);
  v_subtotal   numeric := COALESCE(p_subtotal, 0);
  v_fee        numeric := COALESCE(p_delivery_fee, 0);
  v_disc       numeric := 0;
  v_used_phone integer;
BEGIN
  IF v_code = '' THEN
    RETURN QUERY SELECT false, 'Informe um código de cupom'::text, NULL::uuid, NULL::text, 0::numeric;
    RETURN;
  END IF;

  SELECT * INTO c FROM coupons WHERE coupons.code = v_code;

  -- Mensagem única para "não existe" e "não está valendo": mensagens
  -- diferentes transformam esta função num oráculo para descobrir código
  -- de cupom secreto por força bruta.
  IF NOT FOUND
     OR NOT c.active
     OR (c.starts_at  IS NOT NULL AND now() < c.starts_at)
     OR (c.expires_at IS NOT NULL AND now() > c.expires_at) THEN
    RETURN QUERY SELECT false, 'Cupom inválido ou expirado'::text, NULL::uuid, v_code, 0::numeric;
    RETURN;
  END IF;

  IF c.max_uses IS NOT NULL AND c.used_count >= c.max_uses THEN
    RETURN QUERY SELECT false, 'Este cupom esgotou'::text, c.id, c.code, 0::numeric;
    RETURN;
  END IF;

  IF v_subtotal < c.min_order_value THEN
    RETURN QUERY SELECT false,
      ('Pedido mínimo de ' || to_char(c.min_order_value, 'FM999G999D00') ||
       ' para usar este cupom (faltam ' ||
       to_char(c.min_order_value - v_subtotal, 'FM999G999D00') || ')')::text,
      c.id, c.code, 0::numeric;
    RETURN;
  END IF;

  -- Só conta resgate de pedido que virou pedido de verdade: quem abandonou
  -- o próprio checkout não pode ficar impedido de refazer
  IF c.max_uses_per_phone IS NOT NULL AND public.normalize_phone(p_phone) <> '' THEN
    SELECT count(*) INTO v_used_phone
      FROM coupon_redemptions r
      JOIN orders o ON o.id = r.order_id
     WHERE r.coupon_id = c.id
       AND r.is_active
       AND o.payment_status NOT IN ('AWAITING', 'EXPIRED', 'FAILED')
       AND r.customer_phone = public.normalize_phone(p_phone);

    IF v_used_phone >= c.max_uses_per_phone THEN
      RETURN QUERY SELECT false, 'Você já usou este cupom'::text, c.id, c.code, 0::numeric;
      RETURN;
    END IF;
  END IF;

  IF c.discount_type = 'FREE_DELIVERY' THEN
    IF p_delivery_type <> 'delivery' OR v_fee <= 0 THEN
      RETURN QUERY SELECT false,
        'Este cupom é de frete grátis e só vale para entrega'::text, c.id, c.code, 0::numeric;
      RETURN;
    END IF;
    v_disc := v_fee;

  ELSIF c.discount_type = 'PERCENT' THEN
    v_disc := ROUND(v_subtotal * c.discount_value / 100.0, 2);
    IF c.max_discount_value IS NOT NULL THEN
      v_disc := LEAST(v_disc, c.max_discount_value);
    END IF;
    v_disc := LEAST(v_disc, v_subtotal);

  ELSE
    v_disc := LEAST(c.discount_value, v_subtotal);
  END IF;

  v_disc := GREATEST(ROUND(v_disc, 2), 0);

  IF v_disc <= 0 THEN
    RETURN QUERY SELECT false, 'Este cupom não gera desconto neste pedido'::text,
      c.id, c.code, 0::numeric;
    RETURN;
  END IF;

  -- Um pedido de R$ 0,00 não tem como ser cobrado online e trava o fluxo
  IF (v_subtotal + v_fee - v_disc) <= 0 THEN
    RETURN QUERY SELECT false,
      'Este cupom cobre o pedido inteiro. Adicione mais um item para usá-lo.'::text,
      c.id, c.code, 0::numeric;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text, c.id, c.code, v_disc;
END $$;

GRANT EXECUTE ON FUNCTION public.evaluate_coupon(text, numeric, numeric, text, text)
  TO anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. Bairro duplicado deixava o frete não-determinístico
-- ---------------------------------------------------------------------
-- create_order faz SELECT fee ... LIMIT 1 sem ORDER BY: com o bairro
-- cadastrado duas vezes, o frete mudava de pedido para pedido.
CREATE UNIQUE INDEX IF NOT EXISTS delivery_zones_neighborhood_uidx
  ON delivery_zones (neighborhood) WHERE active;


-- ---------------------------------------------------------------------
-- 7. create_order: valida delivery_type e expira abandonados
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_order(text, text, text, text, text, text, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_address text,
  p_payment_method   text,
  p_delivery_type    text,
  p_neighborhood     text,
  p_items            jsonb,
  p_coupon_code      text DEFAULT NULL,
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
  v_address      text;
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

  -- Antes isto não era validado: QUALQUER valor diferente de 'delivery'
  -- caía no ramo de retirada e zerava o frete. Dava para pedir entrega
  -- com endereço completo e frete R$ 0,00 chamando a RPC direto.
  IF p_delivery_type NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'Tipo de entrega inválido';
  END IF;

  IF NOT public.is_store_open() THEN
    RAISE EXCEPTION 'A loja está fechada no momento';
  END IF;

  -- Autolimpeza: sem isso, carrinho abandonado no checkout segura o uso do
  -- cupom para sempre, porque o cron que faria isso nunca foi agendado
  PERFORM public.expire_abandoned_orders(45);

  v_pay_status   := CASE WHEN p_payment_flow = 'online' THEN 'AWAITING' ELSE 'ON_DELIVERY' END;
  v_phone_digits := public.normalize_phone(p_customer_phone);

  IF p_delivery_type = 'delivery' THEN
    SELECT fee INTO v_delivery_fee
      FROM delivery_zones
     WHERE neighborhood = p_neighborhood AND active = true
     ORDER BY id
     LIMIT 1;

    IF v_delivery_fee IS NULL THEN
      RAISE EXCEPTION 'Não entregamos no bairro %', p_neighborhood;
    END IF;

    v_address := p_customer_address;
  ELSE
    v_delivery_fee := 0;
    -- Endereço vem do navegador. Em retirada ele é ignorado, senão o
    -- recibo sai dizendo ENTREGA com frete zero.
    v_address := 'RETIRADA NO LOCAL';
  END IF;

  INSERT INTO orders (
    customer_name, customer_phone, customer_address,
    payment_method, delivery_fee, subtotal, discount, total, status,
    payment_status, payment_requested_at
  )
  VALUES (
    p_customer_name, p_customer_phone, v_address,
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
     WHERE id::text = v_item->>'product_id' AND active IS DISTINCT FROM false;

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
        JOIN orders o ON o.id = r.order_id
       WHERE r.coupon_id = v_claimed
         AND r.is_active
         AND o.payment_status NOT IN ('AWAITING', 'EXPIRED', 'FAILED')
         AND r.customer_phone = v_phone_digits;

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

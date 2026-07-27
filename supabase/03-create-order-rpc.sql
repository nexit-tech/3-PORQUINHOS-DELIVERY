-- =====================================================================
-- 03 - create_order: criação de pedido atômica e com preço confiável
-- =====================================================================
-- Resolve DOIS problemas de uma vez:
--
-- 1. ATOMICIDADE: o checkout fazia insert em `orders` e depois insert em
--    `order_items`. Se o segundo falhasse, sobrava um pedido PENDING sem
--    itens — e o painel já tinha apitado.
--
-- 2. PREÇO: o total era calculado no navegador e enviado pronto. Dava para
--    abrir o DevTools e fechar um pedido de R$ 0,01. Agora o banco recalcula
--    tudo a partir de `products` e `complement_options`, e a taxa de entrega
--    sai de `delivery_zones` — o cliente não manda valor nenhum.
-- =====================================================================


-- ---------------------------------------------------------------------
-- is_store_open(): mesma regra do front (src/lib/storeHours.ts)
-- Trata horário que vira a meia-noite (17:30 -> 01:00) e usa o fuso de SP,
-- não o do servidor.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_store_open(p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_days      text[] := ARRAY['dom','seg','ter','qua','qui','sex','sab'];
  v_local     timestamp;
  v_dow       int;
  v_minutes   int;
  v_row       record;
  v_open      int;
  v_close     int;
  v_count     int;
BEGIN
  SELECT count(*) INTO v_count FROM store_settings;

  -- Sem grade cadastrada: não bloqueia venda (mesmo comportamento do front)
  IF v_count = 0 THEN
    RETURN true;
  END IF;

  v_local   := p_now AT TIME ZONE 'America/Sao_Paulo';
  v_dow     := EXTRACT(dow FROM v_local)::int;  -- 0 = domingo
  v_minutes := EXTRACT(hour FROM v_local)::int * 60 + EXTRACT(minute FROM v_local)::int;

  -- Janela que começou HOJE
  SELECT * INTO v_row FROM store_settings WHERE day_of_week = v_days[v_dow + 1];

  IF FOUND AND v_row.is_open AND v_row.open_time IS NOT NULL AND v_row.close_time IS NOT NULL THEN
    v_open  := EXTRACT(hour FROM v_row.open_time::time)::int * 60
             + EXTRACT(minute FROM v_row.open_time::time)::int;
    v_close := EXTRACT(hour FROM v_row.close_time::time)::int * 60
             + EXTRACT(minute FROM v_row.close_time::time)::int;

    IF v_close > v_open THEN
      IF v_minutes >= v_open AND v_minutes < v_close THEN RETURN true; END IF;
    ELSE
      -- Vira a meia-noite: hoje fica aberto de open até 23:59
      IF v_minutes >= v_open THEN RETURN true; END IF;
    END IF;
  END IF;

  -- Janela de ONTEM que atravessou a meia-noite
  SELECT * INTO v_row FROM store_settings WHERE day_of_week = v_days[((v_dow + 6) % 7) + 1];

  IF FOUND AND v_row.is_open AND v_row.open_time IS NOT NULL AND v_row.close_time IS NOT NULL THEN
    v_open  := EXTRACT(hour FROM v_row.open_time::time)::int * 60
             + EXTRACT(minute FROM v_row.open_time::time)::int;
    v_close := EXTRACT(hour FROM v_row.close_time::time)::int * 60
             + EXTRACT(minute FROM v_row.close_time::time)::int;

    IF v_close <= v_open AND v_minutes < v_close THEN RETURN true; END IF;
  END IF;

  RETURN false;
END;
$$;


-- ---------------------------------------------------------------------
-- create_order(): único caminho pelo qual o cliente cria pedido
-- ---------------------------------------------------------------------
-- p_items é um array assim:
--   [{ "product_id": "uuid",
--      "quantity": 2,
--      "observation": "Pizza 1: Calabresa\nObs: sem cebola",
--      "option_ids": ["uuid", "uuid"],
--      "customizations": [...] }]
--
-- Repare que NÃO existe campo de preço na entrada. É de propósito.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_address text,
  p_payment_method   text,
  p_delivery_type    text,
  p_neighborhood     text,
  p_items            jsonb
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
  v_item         jsonb;
  v_product      record;
  v_extras       numeric;
  v_unit_price   numeric;
  v_total_price  numeric;
  v_qty          integer;
BEGIN
  -- 1. Validações básicas
  IF p_customer_name IS NULL OR btrim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Informe o nome do cliente';
  END IF;

  IF p_customer_phone IS NULL OR btrim(p_customer_phone) = '' THEN
    RAISE EXCEPTION 'Informe o telefone do cliente';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sem itens';
  END IF;

  IF NOT public.is_store_open() THEN
    RAISE EXCEPTION 'A loja está fechada no momento';
  END IF;

  -- 2. Taxa de entrega SEMPRE do banco
  IF p_delivery_type = 'delivery' THEN
    SELECT fee INTO v_delivery_fee
      FROM delivery_zones
     WHERE neighborhood = p_neighborhood
       AND active = true
     LIMIT 1;

    IF v_delivery_fee IS NULL THEN
      RAISE EXCEPTION 'Não entregamos no bairro %', p_neighborhood;
    END IF;
  ELSE
    v_delivery_fee := 0;
  END IF;

  -- 3. Cria o cabeçalho com total zerado (fechado no final)
  INSERT INTO orders (
    customer_name, customer_phone, customer_address,
    payment_method, delivery_fee, total, status
  )
  VALUES (
    p_customer_name, p_customer_phone, p_customer_address,
    p_payment_method, v_delivery_fee, 0, 'PENDING'
  )
  RETURNING id INTO v_order_id;

  -- 4. Itens, com preço recalculado
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 0);

    IF v_qty < 1 OR v_qty > 99 THEN
      RAISE EXCEPTION 'Quantidade inválida: %', v_qty;
    END IF;

    -- Comparação por TEXTO de propósito: assim a função funciona com `id`
    -- sendo uuid, text ou bigint. Com `= (...)::uuid` bastava a coluna ter
    -- outro tipo para tudo estourar.
    SELECT id, name, price INTO v_product
      FROM products
     WHERE id::text = v_item->>'product_id'
       AND active IS DISTINCT FROM false;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto indisponível no momento';
    END IF;

    -- Só soma opções que pertencem MESMO a este produto e estão ativas.
    -- Assim não dá para colar o id de um adicional de outro produto.
    SELECT COALESCE(sum(co.price), 0) INTO v_extras
      FROM complement_options co
      JOIN product_complements pc ON pc.group_id = co.group_id
     WHERE pc.product_id::text = v_product.id::text
       AND co.is_active IS DISTINCT FROM false
       AND co.id::text IN (
         SELECT value
           FROM jsonb_array_elements_text(COALESCE(v_item->'option_ids', '[]'::jsonb))
       );

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

  -- 5. Fecha o total
  UPDATE orders
     SET total = v_subtotal + v_delivery_fee
   WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

-- Qualquer erro acima desfaz o pedido inteiro: função plpgsql roda em
-- uma transação, então não sobra pedido sem itens.

GRANT EXECUTE ON FUNCTION public.create_order(
  text, text, text, text, text, text, jsonb
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_store_open(timestamptz) TO anon, authenticated;

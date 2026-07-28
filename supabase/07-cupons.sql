-- =====================================================================
-- 07 - Sistema de cupons de desconto
-- =====================================================================
-- Invariante única, válida para todo pedido:
--
--     total = subtotal + delivery_fee - discount
--
-- com discount SEMPRE >= 0 e:
--   PERCENT / FIXED  -> discount <= subtotal      (nunca desconta o frete)
--   FREE_DELIVERY    -> discount  = delivery_fee  (só o frete)
--
-- Por que o desconto não incide sobre o frete: a loja paga o entregador de
-- qualquer jeito. "Frete grátis" é um TIPO de cupom, não um desconto sobre
-- o pedido.
--
-- O cliente manda apenas o CÓDIGO do cupom. Nunca o valor. Mesma filosofia
-- do create_order original, que recalcula preço de produto a partir das
-- tabelas — cupom é exatamente onde aquele bug de "pedido de R$ 0,01"
-- voltaria a aparecer.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_discount_type') THEN
    CREATE TYPE coupon_discount_type AS ENUM ('PERCENT', 'FIXED', 'FREE_DELIVERY');
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- coupons
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Guardado sempre em CAIXA ALTA e sem espaços (ver normalize_coupon_code)
  code               text NOT NULL,
  description        text,

  discount_type      coupon_discount_type NOT NULL,

  -- PERCENT: 1 a 100. FIXED: reais. FREE_DELIVERY: ignorado.
  discount_value     numeric(10,2) NOT NULL DEFAULT 0,

  -- Teto em reais para cupom percentual. Sem isso, "20% OFF" num pedido de
  -- festa de R$ 780 vira R$ 156 de desconto e come o lucro do dia.
  max_discount_value numeric(10,2),

  -- "cupom para quem gastou mais de X reais"
  min_order_value    numeric(10,2) NOT NULL DEFAULT 0,

  -- Validade. NULL = sem limite daquele lado.
  starts_at          timestamptz,
  expires_at         timestamptz,

  -- "cupons que expiram por número de usos"
  max_uses           integer,
  used_count         integer NOT NULL DEFAULT 0,

  -- Limite por telefone. Atenção: o telefone é digitado pelo próprio
  -- cliente e não é verificado, então isto reduz o reuso preguiçoso
  -- (a maioria dos casos reais), mas NÃO é barreira contra quem quer
  -- burlar. Quem protege de verdade é o max_uses.
  max_uses_per_phone integer,

  -- true  = aparece na listagem do checkout
  -- false = cupom secreto, só funciona digitando o código
  is_public          boolean NOT NULL DEFAULT true,

  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT coupons_code_unique UNIQUE (code),
  -- Teto obrigatório em cupom percentual. É a trava que impede o pior
  -- cenário: "20% OFF" pensado para um pedido de R$ 60 encontra uma festa de
  -- R$ 780 e vira R$ 156 de desconto numa margem fina.
  CONSTRAINT coupons_percent_range CHECK (
    discount_type <> 'PERCENT'
    OR (discount_value > 0 AND discount_value <= 100 AND max_discount_value IS NOT NULL)
  ),
  CONSTRAINT coupons_cap_positive CHECK (
    max_discount_value IS NULL OR max_discount_value > 0
  ),
  CONSTRAINT coupons_fixed_positive CHECK (
    discount_type <> 'FIXED' OR discount_value > 0
  ),
  CONSTRAINT coupons_min_order_positive CHECK (min_order_value >= 0),
  CONSTRAINT coupons_max_uses_positive CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT coupons_per_phone_positive CHECK (max_uses_per_phone IS NULL OR max_uses_per_phone > 0),
  CONSTRAINT coupons_used_count_positive CHECK (used_count >= 0),
  CONSTRAINT coupons_window_coherent CHECK (
    starts_at IS NULL OR expires_at IS NULL OR expires_at > starts_at
  )
);

CREATE INDEX IF NOT EXISTS coupons_code_idx ON coupons (code);
CREATE INDEX IF NOT EXISTS coupons_active_idx ON coupons (active, is_public);

-- CREATE TABLE IF NOT EXISTS não revalida constraints em tabela que já
-- existe, então elas são reaplicadas aqui para o script ser idempotente.
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_percent_range;
ALTER TABLE coupons ADD  CONSTRAINT coupons_percent_range CHECK (
  discount_type <> 'PERCENT'
  OR (discount_value > 0 AND discount_value <= 100 AND max_discount_value IS NOT NULL)
);

ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_cap_positive;
ALTER TABLE coupons ADD  CONSTRAINT coupons_cap_positive CHECK (
  max_discount_value IS NULL OR max_discount_value > 0
);


-- ---------------------------------------------------------------------
-- coupon_redemptions: histórico e verdade sobre quem usou
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id       uuid   NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  order_id        bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Só dígitos, para a contagem por telefone não ser furada pela máscara:
  -- "(22) 99815-1575" e "22998151575" têm que contar como o mesmo cliente.
  customer_phone  text NOT NULL,

  discount_amount numeric(10,2) NOT NULL,

  -- false quando o pedido é cancelado (o uso é devolvido ao cupom)
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Um cupom por pedido
  CONSTRAINT coupon_redemptions_one_per_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_phone_idx
  ON coupon_redemptions (coupon_id, customer_phone) WHERE is_active;


-- ---------------------------------------------------------------------
-- Colunas novas em orders
-- ---------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal    numeric(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount    numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id   uuid REFERENCES coupons(id) ON DELETE SET NULL;
-- Snapshot do código: se o dono renomear ou apagar o cupom depois, o pedido
-- antigo continua contando a verdade do que foi aplicado.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;

-- Preenche o subtotal dos 464 pedidos antigos. Antes de cupom existir,
-- subtotal era sempre total - frete.
UPDATE orders
   SET subtotal = ROUND(total - COALESCE(delivery_fee, 0), 2)
 WHERE subtotal IS NULL;


-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
-- Canonicaliza o telefone para contagem por cliente.
--
-- Tira o DDI 55 quando sobra um número brasileiro plausível: sem isso,
-- "5522998151575" e "(22) 99815-1575" contariam como duas pessoas, e o
-- limite por telefone seria furado só pela formatação (o Electron do balcão
-- grava diferente da web).
--
-- NÃO acrescenta o nono dígito em número de 10: em Arraial ainda há fixo de
-- 10 dígitos, e a heurística fundiria clientes diferentes.
CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
           WHEN d ~ '^55[0-9]{10,11}$' THEN substr(d, 3)
           ELSE d
         END
  FROM (SELECT regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g') AS d) s;
$$;

CREATE OR REPLACE FUNCTION public.normalize_coupon_code(p_code text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT upper(regexp_replace(COALESCE(p_code, ''), '\s', '', 'g'));
$$;

-- Mantém o código sempre normalizado, não importa como o admin digitou
CREATE OR REPLACE FUNCTION public.coupons_normalize_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.code := public.normalize_coupon_code(NEW.code);
  IF NEW.code = '' THEN
    RAISE EXCEPTION 'O código do cupom não pode ficar em branco';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS coupons_normalize_code_trg ON coupons;
CREATE TRIGGER coupons_normalize_code_trg
  BEFORE INSERT OR UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION public.coupons_normalize_code();


-- ---------------------------------------------------------------------
-- evaluate_coupon(): a regra, num lugar só
-- ---------------------------------------------------------------------
-- Usada TANTO pela tela (para mostrar o desconto antes de fechar) QUANTO
-- pelo create_order (que é quem vale). Duplicar essa lógica em JavaScript
-- seria a forma mais rápida de a tela e o banco discordarem.
--
-- Não decide sobre max_uses: esse é resolvido por UPDATE atômico na hora
-- de gravar, senão duas pessoas passam juntas no último uso.
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

  -- coupons.code qualificado de propósito: os nomes do RETURNS TABLE viram
  -- variáveis no escopo do plpgsql, então "WHERE code = v_code" seria
  -- ambíguo entre a coluna e o parâmetro de saída `code`.
  SELECT * INTO c FROM coupons WHERE coupons.code = v_code;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Cupom não encontrado'::text, NULL::uuid, v_code, 0::numeric;
    RETURN;
  END IF;

  IF NOT c.active THEN
    RETURN QUERY SELECT false, 'Este cupom não está mais disponível'::text, c.id, c.code, 0::numeric;
    RETURN;
  END IF;

  IF c.starts_at IS NOT NULL AND now() < c.starts_at THEN
    RETURN QUERY SELECT false,
      ('Este cupom só vale a partir de ' ||
       to_char(c.starts_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'))::text,
      c.id, c.code, 0::numeric;
    RETURN;
  END IF;

  IF c.expires_at IS NOT NULL AND now() > c.expires_at THEN
    RETURN QUERY SELECT false, 'Este cupom expirou'::text, c.id, c.code, 0::numeric;
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

  IF c.max_uses_per_phone IS NOT NULL AND public.normalize_phone(p_phone) <> '' THEN
    SELECT count(*) INTO v_used_phone
      FROM coupon_redemptions r
     WHERE r.coupon_id = c.id
       AND r.is_active
       AND r.customer_phone = public.normalize_phone(p_phone);

    IF v_used_phone >= c.max_uses_per_phone THEN
      RETURN QUERY SELECT false, 'Você já usou este cupom'::text, c.id, c.code, 0::numeric;
      RETURN;
    END IF;
  END IF;

  -- ---- cálculo ----
  IF c.discount_type = 'FREE_DELIVERY' THEN
    IF p_delivery_type <> 'delivery' OR v_fee <= 0 THEN
      RETURN QUERY SELECT false,
        'Este cupom é de frete grátis e só vale para entrega'::text,
        c.id, c.code, 0::numeric;
      RETURN;
    END IF;
    v_disc := v_fee;

  ELSIF c.discount_type = 'PERCENT' THEN
    v_disc := ROUND(v_subtotal * c.discount_value / 100.0, 2);
    IF c.max_discount_value IS NOT NULL THEN
      v_disc := LEAST(v_disc, c.max_discount_value);
    END IF;
    v_disc := LEAST(v_disc, v_subtotal);   -- nunca passa do subtotal

  ELSE -- FIXED
    v_disc := LEAST(c.discount_value, v_subtotal);
  END IF;

  v_disc := GREATEST(ROUND(v_disc, 2), 0);

  IF v_disc <= 0 THEN
    RETURN QUERY SELECT false, 'Este cupom não gera desconto neste pedido'::text,
      c.id, c.code, 0::numeric;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text, c.id, c.code, v_disc;
END $$;

GRANT EXECUTE ON FUNCTION public.evaluate_coupon(text, numeric, numeric, text, text)
  TO anon, authenticated;


-- ---------------------------------------------------------------------
-- list_available_coupons(): alimenta o dropdown do checkout
-- ---------------------------------------------------------------------
-- Passa por função (e não por SELECT direto) de propósito: assim o cupom
-- SECRETO (is_public = false) nunca aparece na listagem, mas continua
-- funcionando se o cliente digitar o código.
--
-- Devolve também os que ainda não qualificam, com quanto falta — é o que
-- transforma "cupom sumido" em "faltam R$ 12,00 para usar".
CREATE OR REPLACE FUNCTION public.list_available_coupons(
  p_subtotal      numeric DEFAULT 0,
  p_delivery_fee  numeric DEFAULT 0,
  p_phone         text    DEFAULT NULL,
  p_delivery_type text    DEFAULT 'delivery'
)
RETURNS TABLE (
  code            text,
  description     text,
  discount_type   text,
  discount_value  numeric,
  min_order_value numeric,
  expires_at      timestamptz,
  qualifies       boolean,
  reason          text,
  discount        numeric,
  missing_amount  numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    c.code::text,
    c.description::text,
    c.discount_type::text,
    c.discount_value::numeric,
    c.min_order_value::numeric,
    c.expires_at::timestamptz,
    e.valid                                        AS qualifies,
    e.reason::text,
    e.discount::numeric,
    GREATEST(c.min_order_value - COALESCE(p_subtotal, 0), 0)::numeric AS missing_amount
  FROM coupons c
  CROSS JOIN LATERAL public.evaluate_coupon(
    c.code, p_subtotal, p_delivery_fee, p_phone, p_delivery_type
  ) e
  WHERE c.active
    AND c.is_public
    AND (c.starts_at  IS NULL OR now() >= c.starts_at)
    AND (c.expires_at IS NULL OR now() <= c.expires_at)
    AND (c.max_uses   IS NULL OR c.used_count < c.max_uses)
  ORDER BY e.valid DESC, e.discount DESC, c.min_order_value ASC
  LIMIT 30;
$$;

GRANT EXECUTE ON FUNCTION public.list_available_coupons(numeric, numeric, text, text)
  TO anon, authenticated;


-- ---------------------------------------------------------------------
-- Cancelar pedido devolve o uso do cupom
-- ---------------------------------------------------------------------
-- É o que o dono espera intuitivamente: cupom de 10 usos, um pedido
-- cancelado, sobram 10 e não 9.
CREATE OR REPLACE FUNCTION public.sync_coupon_on_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.coupon_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'CANCELED' AND OLD.status IS DISTINCT FROM 'CANCELED' THEN
    UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = NEW.coupon_id;
    UPDATE coupon_redemptions SET is_active = false WHERE order_id = NEW.id;

  ELSIF OLD.status = 'CANCELED' AND NEW.status IS DISTINCT FROM 'CANCELED' THEN
    -- Pedido reaberto: consome de novo
    UPDATE coupons SET used_count = used_count + 1 WHERE id = NEW.coupon_id;
    UPDATE coupon_redemptions SET is_active = true WHERE order_id = NEW.id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_sync_coupon_trg ON orders;
CREATE TRIGGER orders_sync_coupon_trg
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_coupon_on_order_status();


-- ---------------------------------------------------------------------
-- create_order() com cupom
-- ---------------------------------------------------------------------
-- DROP antes do CREATE: mudar a quantidade de parâmetros criaria uma
-- SOBRECARGA, e o PostgREST não saberia qual chamar.
DROP FUNCTION IF EXISTS public.create_order(text, text, text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_address text,
  p_payment_method   text,
  p_delivery_type    text,
  p_neighborhood     text,
  p_items            jsonb,
  p_coupon_code      text DEFAULT NULL
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
  -- Escalares separados: o UPDATE final não pode ler campos de v_coupon,
  -- porque num pedido SEM cupom o record fica sem atribuição e o plpgsql
  -- lança "record v_coupon is not assigned yet".
  v_coupon_id    uuid := NULL;
  v_coupon_code  text := NULL;
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

  v_phone_digits := public.normalize_phone(p_customer_phone);

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

  -- 3. Cabeçalho com totais zerados (fechados no final)
  INSERT INTO orders (
    customer_name, customer_phone, customer_address,
    payment_method, delivery_fee, subtotal, discount, total, status
  )
  VALUES (
    p_customer_name, p_customer_phone, p_customer_address,
    p_payment_method, v_delivery_fee, 0, 0, 0, 'PENDING'
  )
  RETURNING id INTO v_order_id;

  -- 4. Itens, com preço recalculado a partir do catálogo
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
      RAISE EXCEPTION
        'O cardápio foi atualizado. Atualize a página e monte o pedido novamente.';
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

  -- 5. Cupom
  IF public.normalize_coupon_code(p_coupon_code) <> '' THEN

    SELECT * INTO v_coupon
      FROM public.evaluate_coupon(
        p_coupon_code, v_subtotal, v_delivery_fee, p_customer_phone, p_delivery_type
      );

    IF NOT v_coupon.valid THEN
      -- A mensagem vem pronta e em português da evaluate_coupon
      RAISE EXCEPTION '%', v_coupon.reason;
    END IF;

    -- Reserva atômica do uso.
    -- Não é SELECT-decide-UPDATE: o UPDATE condicional resolve num passo só
    -- a corrida de duas pessoas fechando pedido no último uso do cupom.
    -- E o lock que ele pega na linha serializa a contagem por telefone logo
    -- abaixo, de graça.
    UPDATE coupons
       SET used_count = used_count + 1
     WHERE id = v_coupon.coupon_id
       AND active
       AND (max_uses IS NULL OR used_count < max_uses)
    RETURNING id INTO v_claimed;

    IF v_claimed IS NULL THEN
      RAISE EXCEPTION 'Este cupom esgotou';
    END IF;

    -- Recontagem por telefone DEPOIS do claim, já protegida pelo lock que
    -- o UPDATE acima pegou na linha do cupom
    SELECT c.max_uses_per_phone INTO v_limit_phone FROM coupons c WHERE c.id = v_claimed;

    IF v_limit_phone IS NOT NULL AND v_phone_digits <> '' THEN
      SELECT count(*) INTO v_used_phone
        FROM coupon_redemptions r
       WHERE r.coupon_id = v_claimed
         AND r.is_active
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

  -- 6. Fecha os totais.  total = subtotal + frete - desconto
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
  text, text, text, text, text, text, jsonb, text
) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
-- coupons e coupon_redemptions: leitura e escrita SÓ do admin logado.
-- O cliente anônimo nunca lê estas tabelas direto — ele passa pelas
-- funções SECURITY DEFINER acima, que é o que impede alguém de baixar a
-- lista de cupons secretos ou descobrir códigos por força bruta.
ALTER TABLE coupons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coupons_admin ON coupons;
CREATE POLICY coupons_admin ON coupons FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS coupon_redemptions_admin ON coupon_redemptions;
CREATE POLICY coupon_redemptions_admin ON coupon_redemptions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

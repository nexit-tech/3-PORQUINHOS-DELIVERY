-- =====================================================================
-- 10 - A loja aceita SOMENTE pagamento pelo site
-- =====================================================================
-- Não existe mais "pagar na entrega": nem Pix ou cartão na maquininha do
-- entregador, nem dinheiro. Todo pedido nasce em AWAITING e só vira
-- pedido de verdade quando o dinheiro entra.
--
-- Por que isto não é só mudança de tela:
--
-- A tela de pagamento agora oferece uma opção só, mas ela roda no
-- navegador do cliente — território dele. O create_order continua
-- aceitando p_payment_flow = 'on_delivery', então bastaria abrir o
-- console e chamar a RPC com esse valor para gerar um pedido que cai na
-- cozinha com payment_status = 'ON_DELIVERY'. Comida de graça, pelo
-- mesmo caminho que o 04 e o 09 fecharam para preço e frete.
--
-- Optei por um trigger em vez de reescrever o create_order inteiro: a
-- função tem ~200 linhas e duplicá-la aqui só para trocar uma validação
-- criaria duas versões para manter em sincronia. O trigger pega QUALQUER
-- caminho de INSERT, inclusive os que ainda não existem.
--
-- ⚠️ CONSEQUÊNCIA OPERACIONAL: com isto aplicado, se a InfinitePay ficar
--    fora do ar a loja não registra pedido nenhum. Não há plano B de
--    "anota e cobra na entrega". Para reverter temporariamente:
--
--      DROP TRIGGER orders_somente_pagamento_online ON orders;
--
--    e voltar as opções na tela de checkout.
--
-- Os 468 pedidos antigos são ON_DELIVERY e continuam intactos: o trigger
-- é BEFORE INSERT, não mexe em linha que já existe nem em UPDATE.
-- =====================================================================


CREATE OR REPLACE FUNCTION public.exigir_pagamento_online()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payment_status = 'ON_DELIVERY' THEN
    -- Mensagem em português: ela sobe pela RPC e chega ao alert() do
    -- cliente sem tradução no meio do caminho.
    RAISE EXCEPTION 'Esta loja aceita apenas pagamento pelo site.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_somente_pagamento_online ON orders;

CREATE TRIGGER orders_somente_pagamento_online
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.exigir_pagamento_online();


-- =====================================================================
-- COMO TESTAR
-- =====================================================================
-- Deve FALHAR ("Esta loja aceita apenas pagamento pelo site"):
--   SELECT create_order('Teste','11999999999','Rua X','Dinheiro','pickup',
--                       NULL,'[{"product_id":"<id>","quantity":1}]'::jsonb,
--                       NULL,'on_delivery');
--
-- Deve PASSAR:
--   ... o mesmo, trocando o último parâmetro para 'online'
--
-- E os pedidos antigos continuam lá:
--   SELECT count(*) FROM orders WHERE payment_status = 'ON_DELIVERY';  -- 468
-- =====================================================================

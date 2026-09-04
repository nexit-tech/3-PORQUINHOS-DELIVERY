-- =====================================================================
-- 12 - A loja volta a aceitar DINHEIRO na entrega/retirada
-- =====================================================================
-- Substitui a regra da 10 ("somente pagamento pelo site"). Agora existem
-- dois caminhos:
--
--   online      -> payment_status = 'AWAITING', vira 'PAID' quando a
--                  InfinitePay confirma. A cozinha só vê depois disso.
--   dinheiro    -> payment_status = 'ON_DELIVERY', cai na cozinha na hora
--                  e o entregador cobra na porta.
--
-- POR QUE O TRIGGER CONTINUA EXISTINDO
--
-- O checkout roda no navegador do cliente. Se o create_order aceitasse
-- ON_DELIVERY para qualquer forma de pagamento, bastaria abrir o console
-- e chamar a RPC com p_payment_flow = 'on_delivery' e p_payment_method =
-- 'Pix' para gerar um pedido que a cozinha produz achando que o
-- entregador vai cobrar na maquininha — que ninguém vai levar. O trigger
-- da 10 fechava isso recusando TODO ON_DELIVERY; agora ele recusa todo
-- ON_DELIVERY que não seja dinheiro.
--
-- Dinheiro é o único que se sustenta sozinho: quem recebe é o entregador,
-- em espécie, sem depender de maquininha, chave Pix ou de a operadora
-- estar de pé. Para liberar Pix/cartão na entrega de novo, é aqui que se
-- mexe (e a tela do checkout precisa oferecer a opção).
--
-- CONSEQUÊNCIA OPERACIONAL (o oposto da que a 10 trouxe): com isto
-- aplicado, InfinitePay fora do ar NÃO para mais a loja — o checkout cai
-- para dinheiro e o pedido entra igual.
--
-- Pedidos existentes não são tocados: BEFORE INSERT não olha UPDATE nem
-- linha antiga.
-- =====================================================================


-- O nome antigo mentia depois desta mudança. Some com ele antes de criar
-- o novo, senão os dois ficam ativos na mesma tabela.
DROP TRIGGER IF EXISTS orders_somente_pagamento_online ON orders;
DROP FUNCTION IF EXISTS public.exigir_pagamento_online();


CREATE OR REPLACE FUNCTION public.validar_forma_de_pagamento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payment_status = 'ON_DELIVERY'
     AND COALESCE(NEW.payment_method, '') !~* '^\s*dinheiro' THEN
    -- Mensagem em português: ela sobe pela RPC e chega ao alert() do
    -- cliente sem tradução no meio do caminho.
    RAISE EXCEPTION 'Pagamento na entrega só em dinheiro. As outras formas são pelo site.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_forma_de_pagamento ON orders;

CREATE TRIGGER orders_forma_de_pagamento
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_forma_de_pagamento();


-- =====================================================================
-- COMO TESTAR
-- =====================================================================
-- Deve PASSAR (é o caminho novo):
--   SELECT create_order('Teste','11999999999','Rua X','Dinheiro - Sem troco',
--                       'pickup',NULL,'[{"product_id":"<id>","quantity":1}]'::jsonb,
--                       NULL,'on_delivery');
--
-- Deve FALHAR ("Pagamento na entrega só em dinheiro"):
--   ... o mesmo, trocando o payment_method para 'Pix'
--
-- Deve PASSAR (não mudou nada no online):
--   ... trocando o último parâmetro para 'online'
-- =====================================================================

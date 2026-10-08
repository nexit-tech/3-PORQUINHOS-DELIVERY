-- =====================================================================
-- 16 - Cartão na entrega (maquininha)
-- =====================================================================
-- A 12 só aceitava DINHEIRO na entrega, porque na época a loja não tinha
-- maquininha com o entregador. Agora tem (08/10/2026): o atendente do
-- WhatsApp oferece "cartão na entrega" e grava o pedido com a forma
-- "Cartão na entrega (maquininha)".
--
-- Continua recusado: Pix "na entrega" (Pix é na chave ou pelo link, com
-- comprovante/confirmação) e qualquer texto que não comece com dinheiro
-- ou cartão.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.validar_forma_de_pagamento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payment_status = 'ON_DELIVERY'
     AND COALESCE(NEW.payment_method, '') !~* '^\s*(dinheiro|cart[aã]o)' THEN
    -- Mensagem em português: ela sobe pela RPC e chega ao cliente sem
    -- tradução no meio do caminho.
    RAISE EXCEPTION 'Pagamento na entrega só em dinheiro ou cartão. Pix é pela chave ou pelo link.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

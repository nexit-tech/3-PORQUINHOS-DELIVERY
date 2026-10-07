-- =====================================================================
-- 15 - Pix direto na chave da loja, conferido pela IA
-- =====================================================================
-- Pelo WhatsApp o cliente pode pagar com Pix na chave da loja (sem a taxa
-- da operadora). O pedido nasce em AWAITING, igual ao pagamento online:
-- invisível para a cozinha até o comprovante ser aprovado. Quem aprova é o
-- servidor (src/lib/bot/pix.ts): a IA lê o comprovante e o código confere
-- valor, recebedor, data/hora e se o comprovante já foi usado.
--
-- ⚠️ Decisão da loja (07/10/2026): aprovado pela IA, o pedido segue sem
-- conferência humana. A IA NÃO vê o extrato do banco — um comprovante
-- falso bem feito passa. O que fica guardado aqui serve para auditar.
-- =====================================================================

-- O que a IA leu e por que aprovou/recusou, junto de cada tentativa
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS provider     text;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS receipt_path text;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS detalhe      jsonb;

-- ---------------------------------------------------------------------
-- mark_order_paid_pix: mesma regra do mark_order_paid (valor exato, uma
-- transação não paga dois pedidos, pedido reaberto se tinha expirado),
-- só que gravando que foi Pix na chave e onde está o comprovante.
--
-- p_transaction_id é o ID da transação (E2E) lido do comprovante; sem ele,
-- o hash do arquivo. É com isso que o mesmo comprovante não paga dois
-- pedidos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_order_paid_pix(
  p_order_id       bigint,
  p_transaction_id text,
  p_amount_cents   integer,
  p_receipt_path   text,
  p_detalhe        jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  r := public.mark_order_paid(p_order_id, p_transaction_id, p_amount_cents, 'pix', p_receipt_path);

  IF COALESCE((r->>'ok')::boolean, false)
     AND NOT COALESCE((r->>'already')::boolean, false)
     AND NOT COALESCE((r->>'duplicate')::boolean, false) THEN
    UPDATE orders SET payment_provider = 'pix_manual' WHERE id = p_order_id;
  END IF;

  -- A tentativa que o mark_order_paid acabou de registrar
  UPDATE payment_attempts
     SET provider = 'pix_manual', receipt_path = p_receipt_path, detalhe = p_detalhe
   WHERE id = (SELECT max(id) FROM payment_attempts WHERE order_id = p_order_id);

  RETURN r;
END;
$$;

-- Só o servidor. Se o anônimo pudesse chamar, qualquer um marcava pedido
-- como pago mandando um número de transação inventado.
REVOKE ALL ON FUNCTION public.mark_order_paid_pix(bigint, text, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid_pix(bigint, text, integer, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------
-- Bucket PRIVADO para os comprovantes. Tem nome, CPF parcial e banco do
-- cliente: não pode ser público como o das fotos de produto. O painel abre
-- por link assinado (expira).
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS comprovantes_admin_le ON storage.objects;
CREATE POLICY comprovantes_admin_le
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'comprovantes');

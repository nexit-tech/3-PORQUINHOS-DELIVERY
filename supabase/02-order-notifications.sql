-- =====================================================================
-- 02 - order_notifications: trava contra notificação duplicada
-- =====================================================================
-- Contexto: o listener realtime que dispara o WhatsApp roda dentro do
-- navegador, em TODO painel aberto. Com o painel aberto no PC do balcão e
-- no celular, o cliente recebia a mesma mensagem duas vezes.
--
-- Esta tabela é uma "reserva": cada painel tenta inserir (pedido, status).
-- A primary key composta garante que só o primeiro consegue; os outros
-- levam unique_violation (23505) e desistem em silêncio.
-- =====================================================================

CREATE TABLE IF NOT EXISTS order_notifications (
  order_id   bigint      NOT NULL,
  status     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, status)
);

COMMENT ON TABLE order_notifications IS
  'Trava de idempotência: garante 1 notificação por (pedido, status), mesmo com vários painéis abertos.';

-- Limpeza: registros com mais de 30 dias não servem para nada
CREATE INDEX IF NOT EXISTS order_notifications_created_at_idx
  ON order_notifications (created_at);

-- =====================================================================
-- RLS: o painel usa a anon key, então precisa poder inserir e ler
-- =====================================================================
ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;

-- Só o admin logado. Se ficasse aberta para `anon`, qualquer pessoa poderia
-- inserir (pedido, 'PREPARING') antes da loja aceitar e assim IMPEDIR que o
-- cliente recebesse a mensagem de confirmação — a trava viraria uma arma.
DROP POLICY IF EXISTS order_notifications_insert ON order_notifications;
DROP POLICY IF EXISTS order_notifications_select ON order_notifications;

DROP POLICY IF EXISTS order_notifications_admin ON order_notifications;
CREATE POLICY order_notifications_admin
  ON order_notifications FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

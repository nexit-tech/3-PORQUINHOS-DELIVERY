-- =====================================================================
-- 14 - bot_conversas: memória do atendente do WhatsApp
-- =====================================================================
-- O bot (ChatGPT) atende pelo WhatsApp, monta o carrinho e fecha o pedido.
-- Ele precisa lembrar do que já foi conversado e do que está no carrinho
-- entre uma mensagem e outra. Em memória isso sumiria a cada deploy, no
-- meio de um pedido.
--
-- Uma linha por telefone (só dígitos, com DDI). `mensagens` guarda só o
-- texto trocado (cliente e bot), não as chamadas de ferramenta: o cardápio
-- e os preços são lidos de novo do banco a cada resposta, então nada velho
-- fica preso no histórico.
--
-- RLS ligada. Quem escreve é o servidor (service_role). O admin logado lê
-- e apaga pela página Atendente IA; o visitante não vê nada.
-- =====================================================================

CREATE TABLE IF NOT EXISTS bot_conversas (
  phone         text        PRIMARY KEY,
  nome          text,
  mensagens     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  carrinho      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bot_conversas_atualizado_em_idx ON bot_conversas (atualizado_em);

ALTER TABLE bot_conversas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON bot_conversas FROM anon;

DROP POLICY IF EXISTS bot_conversas_admin_le ON bot_conversas;
DROP POLICY IF EXISTS bot_conversas_admin ON bot_conversas;
CREATE POLICY bot_conversas_admin
  ON bot_conversas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE bot_conversas IS
  'Histórico e carrinho do atendente de WhatsApp, por telefone. Escrita só pelo servidor.';

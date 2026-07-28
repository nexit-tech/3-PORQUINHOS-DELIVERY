-- =====================================================================
-- 01 - bot_settings: conferência (nada a corrigir no banco)
-- =====================================================================
-- Este arquivo foi escrito assumindo que `key` não tinha constraint de
-- unicidade e que a tabela tinha linhas duplicadas. A inspeção do banco
-- real mostrou que a suposição estava ERRADA:
--
--   bot_settings PRIMARY KEY (id)      <- uuid
--   bot_settings UNIQUE      (key)     <- já existe
--   e nenhuma chave duplicada
--
-- O bug do painel era outro, e pior: `.upsert({ key, value })` sem
-- onConflict faz o PostgREST resolver o conflito pela PRIMARY KEY (`id`).
-- Como o código não mandava `id`, o Postgres gerava um uuid novo, não
-- havia conflito de PK, e o INSERT batia na UNIQUE de `key` — erro 23505.
--
-- Ou seja: o botão "Aceite Automático" NUNCA salvou. Toda vez caía no
-- catch e mostrava "Erro ao salvar configuração. Tente novamente."
--
-- A correção é só no código (src/services/botSettings.ts, que faz UPDATE
-- e só insere se a chave não existir). Não há DDL a aplicar aqui.
-- =====================================================================

-- Confirma que continua tudo certo (esperado: 4 chaves, 1 linha cada)
SELECT key, jsonb_pretty(value) AS value
  FROM bot_settings
 ORDER BY key;

-- Garante que as chaves usadas pelo sistema existam.
-- Aqui o ON CONFLICT (key) funciona porque a constraint existe de verdade.
INSERT INTO bot_settings (key, value)
VALUES
  ('is_bot_active',      '{"enabled": true}'::jsonb),
  ('auto_accept_orders', '{"enabled": false}'::jsonb),
  ('pause_message',      '{"text": "⏸️ Atendimento humano ativado. Aguarde, em breve te responderemos!"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

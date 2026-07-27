-- =====================================================================
-- 01 - bot_settings: remover duplicatas e garantir 1 linha por chave
-- =====================================================================
-- Contexto: o painel usava .upsert({ key, value }) sem onConflict.
-- Como `key` não tem constraint de unicidade, cada clique no botão de
-- "Aceite Automático" inseria uma linha NOVA, e depois o .single() da
-- leitura quebrava com "multiple (or no) rows returned".
--
-- O código já foi corrigido (src/services/botSettings.ts), mas as linhas
-- duplicadas que já estão no banco precisam ser limpas.
-- =====================================================================

-- 1. Confere o estrago antes de mexer (rode sozinho primeiro se quiser ver)
--    SELECT key, count(*) FROM bot_settings GROUP BY key HAVING count(*) > 1;

-- 2. Mantém apenas a linha mais recente de cada chave
DELETE FROM bot_settings a
USING bot_settings b
WHERE a.key = b.key
  AND a.ctid < b.ctid;

-- 3. Impede que volte a acontecer
ALTER TABLE bot_settings
  ADD CONSTRAINT bot_settings_key_unique UNIQUE (key);

-- 4. Garante que as chaves usadas pelo sistema existam
INSERT INTO bot_settings (key, value)
VALUES
  ('is_bot_active',      '{"enabled": true}'::jsonb),
  ('auto_accept_orders', '{"enabled": false}'::jsonb),
  ('pause_message',      '{"text": "⏸️ Atendimento humano ativado. Aguarde, em breve te responderemos!"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Confere
SELECT key, value FROM bot_settings ORDER BY key;

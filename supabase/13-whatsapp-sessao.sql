-- =====================================================================
-- 13 - whatsapp_auth: sessão do WhatsApp conectado por QR Code
-- =====================================================================
-- O servidor fala com o WhatsApp direto (biblioteca Baileys), sem Evolution
-- API nem Z-API no meio. Depois que o QR Code é lido, o WhatsApp entrega um
-- conjunto de chaves de criptografia que precisa ser guardado: sem ele, todo
-- restart pediria um QR novo.
--
-- Por que no banco e não em arquivo: o disco do Railway é apagado a cada
-- deploy. Em arquivo, cada deploy desconectaria o WhatsApp da loja.
--
-- Uma linha por chave. `session` separa sessões diferentes (produção x um
-- teste local), para um não derrubar o outro.
--
-- ⚠️ Estas chaves equivalem a estar logado no WhatsApp da loja. RLS ligada e
-- NENHUMA política: só a service_role (o servidor) lê e escreve. Nem o admin
-- logado no painel enxerga.
-- =====================================================================

CREATE TABLE IF NOT EXISTS whatsapp_auth (
  session    text        NOT NULL,
  id         text        NOT NULL,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session, id)
);

ALTER TABLE whatsapp_auth ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON whatsapp_auth FROM anon, authenticated;

COMMENT ON TABLE whatsapp_auth IS
  'Credenciais da sessão do WhatsApp (Baileys). Só a service_role acessa. Apagar as linhas de uma sessão = desconectar.';

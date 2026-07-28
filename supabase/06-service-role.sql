-- =====================================================================
-- 06 - Checklist da service_role (não é SQL para rodar, é conferência)
-- =====================================================================
-- Depois da RLS do 04, as tabelas do bot só aceitam `authenticated`.
-- As rotas /api/webhook e /api/cron rodam no servidor, sem usuário logado,
-- então precisam da service_role para continuar funcionando.
--
-- A service_role IGNORA RLS por definição no Supabase — não precisa de
-- policy nenhuma. O que precisa é da variável de ambiente.
--
-- 1. Pegue a chave:
--    Painel do Supabase -> Settings -> API -> service_role (secret)
--
-- 2. Coloque no .env do servidor (Railway), NUNCA com prefixo NEXT_PUBLIC_,
--    senão ela vai parar dentro do bundle JavaScript:
--
--      SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
--
-- 3. Confirme que ela NÃO aparece no navegador. Com o app rodando:
--      grep -r "service_role" .next/static/    -> não pode achar nada
--
-- O código avisa no log se a variável estiver faltando
-- (src/lib/supabaseAdmin.ts).
-- =====================================================================


-- =====================================================================
-- REALTIME: quais tabelas precisam estar publicadas
-- =====================================================================
-- O painel depende de Realtime para o pedido aparecer sozinho na tela.
-- Se a tabela não estiver na publication, nada chega e o painel só
-- atualiza no refresh lento de segurança.
--
-- Confira o que já está publicado:
SELECT tablename
  FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime'
 ORDER BY tablename;

-- Se faltar alguma, adicione (não dá erro se já estiver lá em versões
-- recentes; se der, é porque já está publicada):
-- ALTER PUBLICATION supabase_realtime ADD TABLE orders;
-- ALTER PUBLICATION supabase_realtime ADD TABLE products;
-- ALTER PUBLICATION supabase_realtime ADD TABLE categories;
-- ALTER PUBLICATION supabase_realtime ADD TABLE complement_options;
-- ALTER PUBLICATION supabase_realtime ADD TABLE store_settings;
-- ALTER PUBLICATION supabase_realtime ADD TABLE bot_notifications;

-- Importante: Realtime RESPEITA RLS. Como `anon` não tem política de
-- SELECT em `orders`, o cliente na loja não recebe esses eventos — por
-- isso a tela "Meus Pedidos" usa polling (src/hooks/useOrders.ts) e não
-- Realtime. Isso é intencional, não é esquecimento.


-- Confere quais tabelas estão com RLS ligada
SELECT
  tablename,
  rowsecurity AS rls_ligada
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;


-- Lista as políticas criadas
SELECT
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

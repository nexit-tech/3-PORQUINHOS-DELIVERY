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

-- =====================================================================
-- 05 - Criar o usuário admin do painel
-- =====================================================================
-- RODE ESTE ARQUIVO ANTES DO 04.
--
-- A tela de login do painel pede só a senha (ADMIN_PASSWORD do .env), mas por
-- baixo quem autentica é este usuário do Supabase Auth: é ele que dá ao banco
-- a informação de "esta pessoa é o admin" — sem ele, a RLS do 04 bloqueia o
-- painel inteiro.
-- =====================================================================


-- ---------------------------------------------------------------------
-- OPÇÃO A (recomendada): pelo painel do Supabase
-- ---------------------------------------------------------------------
-- Authentication -> Users -> Add user
--   Email:    admin@3porquinhos.com.br   (ou o que preferir)
--   Password: uma senha forte
--   ✅ Marque "Auto Confirm User" — sem isso o login falha com
--      "Email not confirmed", porque a instância self-hosted provavelmente
--      não tem SMTP configurado.
--
-- Depois coloque no .env:
--   ADMIN_EMAIL=admin@3porquinhos.com.br    <- o painel autentica este usuário
--   ADMIN_PASSWORD=...                      <- só o app desktop usa
--
-- A senha do painel é a DESTE usuário, definida aqui. A tela pede só a senha
-- (o e-mail sai do ADMIN_EMAIL) e manda para o Auth. Trocar ADMIN_PASSWORD no
-- .env não troca a senha do painel: troque aqui, em Authentication -> Users.


-- ---------------------------------------------------------------------
-- OPÇÃO B: por SQL, se preferir
-- ---------------------------------------------------------------------
-- Troque o e-mail e a senha antes de rodar.

-- A extensão pgcrypto é necessária para gerar o hash da senha
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@3porquinhos.com.br',            -- <<< TROQUE
  crypt('TROQUE_ESTA_SENHA', gen_salt('bf')),  -- <<< TROQUE
  now(),                                  -- já confirmado, sem precisar de e-mail
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
)
ON CONFLICT (email) DO NOTHING;


-- ---------------------------------------------------------------------
-- Fechar o cadastro público
-- ---------------------------------------------------------------------
-- Importante: no painel do Supabase, em Authentication -> Providers -> Email,
-- DESLIGUE "Enable Sign Ups". Senão qualquer pessoa cria uma conta e vira
-- `authenticated` — o que, com as políticas do 04, dá acesso total ao painel.


-- ---------------------------------------------------------------------
-- Conferir
-- ---------------------------------------------------------------------
SELECT email, email_confirmed_at, created_at
  FROM auth.users
 ORDER BY created_at DESC;

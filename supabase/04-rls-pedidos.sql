-- =====================================================================
-- 04 - RLS completa (exige o admin autenticado via Supabase Auth)
-- =====================================================================
-- LEIA E EXECUTE O 05 ANTES DE RODAR ESTE ARQUIVO.
--
-- Situação anterior: painel e loja usavam a mesma anon key, que está no
-- bundle JavaScript e qualquer visitante lê no DevTools. O banco não tinha
-- como distinguir admin de cliente, então tudo ficava aberto: dava para
-- listar nome/telefone/endereço de todos os clientes, mexer em preço, apagar
-- produto e fechar pedido de R$ 0,01.
--
-- Agora o painel faz login no Supabase Auth, então o banco enxerga dois
-- papéis distintos:
--
--   anon           -> visitante da loja (/pedido). Só LÊ o cardápio.
--   authenticated  -> admin logado. Faz tudo.
--
-- ⚠️ ORDEM: rode 05-admin-user.sql, confirme que consegue entrar no painel
--    com o novo login, e SÓ ENTÃO rode este arquivo. Se rodar antes, o
--    painel para de gravar até você criar o usuário.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASSO 0: derrubar as políticas permissivas que já existem
-- ---------------------------------------------------------------------
-- Sem isto, tudo abaixo é decorativo. O banco já tem políticas assim:
--
--   orders          "Acesso total público orders"    FOR ALL TO public USING (true)
--   order_items     "Acesso total público items"     FOR ALL TO public USING (true)
--   store_settings  "Escrita admin store_settings"   FOR ALL TO public USING (true)
--
-- Políticas do Postgres são somadas com OR: basta UMA liberar para o
-- acesso passar. Como os nomes são diferentes dos que este arquivo cria,
-- um "DROP POLICY IF EXISTS <meu_nome>" não encostaria nelas, e a RLS
-- continuaria escancarada — só que parecendo fechada.
--
-- Então: apaga TODAS as políticas das tabelas que este arquivo gerencia,
-- seja qual for o nome, e recria do zero logo abaixo.
DO $$
DECLARE
  r record;
  managed text[] := ARRAY[
    'products', 'categories', 'complement_groups', 'complement_options',
    'product_complements', 'delivery_zones', 'store_settings',
    'bot_settings', 'bot_paused_numbers', 'bot_notifications',
    'orders', 'order_items'
  ];
BEGIN
  FOR r IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = ANY(managed)
  LOOP
    RAISE NOTICE 'Removendo política antiga: % em %', r.policyname, r.tablename;
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- Helper: leitura pública, escrita só para quem está logado
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
  -- Cardápio e configurações que a loja precisa LER sem estar logada
  public_read_tables text[] := ARRAY[
    'products',
    'categories',
    'complement_groups',
    'complement_options',
    'product_complements',
    'delivery_zones',
    'store_settings'
  ];
BEGIN
  FOREACH t IN ARRAY public_read_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_public_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (true)',
      t || '_public_read', t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_write', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || '_admin_write', t
    );
  END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- Tabelas só do painel: nem leitura para anônimo
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
  admin_only_tables text[] := ARRAY[
    'bot_settings',
    'bot_paused_numbers',
    'bot_notifications'
  ];
BEGIN
  FOREACH t IN ARRAY admin_only_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || '_admin_all', t
    );
  END LOOP;
END $$;

-- Atenção: /api/webhook e /api/cron rodam no servidor com a anon key e
-- precisam ler bot_settings e escrever em bot_paused_numbers/bot_notifications.
-- Como as políticas acima só liberam para `authenticated`, essas rotas
-- passam a precisar da service_role. Veja o 06-service-role.sql.


-- ---------------------------------------------------------------------
-- orders: leitura do próprio pedido, escrita só do painel
-- ---------------------------------------------------------------------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- O admin logado vê tudo
DROP POLICY IF EXISTS orders_admin_read ON orders;
CREATE POLICY orders_admin_read
  ON orders FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS orders_admin_update ON orders;
CREATE POLICY orders_admin_update
  ON orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- O cliente anônimo NÃO lista pedidos direto. Ele usa a função
-- get_orders_by_phone() abaixo, que devolve só os pedidos do telefone dele.
-- Antes, qualquer um baixava a base inteira de nome + telefone + endereço.

-- INSERT/DELETE: sem política para ninguém.
-- Criar pedido passa só por create_order() (SECURITY DEFINER).


-- ---------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_admin_read ON order_items;
CREATE POLICY order_items_admin_read
  ON order_items FOR SELECT
  TO authenticated
  USING (true);

-- A função get_orders_by_phone() foi movida para 03b-get-orders-by-phone.sql:
-- lá ela pode ser aplicada antes do deploy, porque só cria função e não
-- tranca acesso nenhum. Aqui ficam apenas as políticas.


-- =====================================================================
-- COMO TESTAR DEPOIS DE RODAR
-- =====================================================================
-- 1. Entrar no painel com o e-mail/senha criados no 05  -> tem que funcionar
-- 2. Editar um produto no painel                        -> tem que funcionar
-- 3. Fazer um pedido em /pedido (sem estar logado)       -> tem que funcionar
-- 4. Ver "Meus Pedidos" em /pedido/historico             -> tem que funcionar
--
-- E os buracos que fecharam, testando no console em /pedido (deslogado):
--   await supabase.from('orders').select('*')
--     -> deve voltar lista VAZIA (antes voltava a base inteira de clientes)
--   await supabase.from('products').update({ price: 0 }).eq('id', '<id>')
--     -> deve falhar
--   await supabase.from('orders').insert({ total: 0.01, status: 'PENDING' })
--     -> deve falhar
-- =====================================================================

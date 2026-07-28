-- =====================================================================
-- 00 - Realtime: publicar as tabelas do cardápio
-- =====================================================================
-- A inspeção do banco mostrou que a publication `supabase_realtime` tinha
-- apenas:
--
--   orders, order_items, store_settings, bot_notifications, bot_settings
--
-- Faltavam products, categories e complement_options — justamente as que
-- o cardápio escuta. Enquanto o código fazia polling de 15 em 15 segundos
-- isso não aparecia; depois da troca por Realtime, o cardápio ficaria
-- parado até o refresh lento de segurança (5 min).
--
-- São 11 produtos e 36 bairros: o custo em WAL é irrelevante.
-- =====================================================================

DO $$
DECLARE
  t text;
  faltando text[] := ARRAY['products', 'categories', 'complement_options'];
BEGIN
  FOREACH t IN ARRAY faltando LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Publicada no Realtime: %', t;
    ELSE
      RAISE NOTICE 'Já estava publicada: %', t;
    END IF;
  END LOOP;
END $$;

-- Confere o resultado
SELECT tablename
  FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime'
 ORDER BY tablename;

-- =====================================================================
-- 11 - Produtos mais vendidos (vitrine da loja)
-- =====================================================================
-- O cardápio passa a destacar as mais vendidas num carrossel. O ranking
-- sai de order_items, que o 04 fechou para `anon` — e com razão: a
-- tabela liga produto a pedido, e pedido tem nome, telefone e endereço.
--
-- Por isso a função é SECURITY DEFINER e devolve SÓ O AGREGADO: id, nome,
-- foto, preço e quantidade vendida. Nenhuma coluna de orders atravessa.
-- Saber que a Pizza Suprema vendeu 40 não expõe quem comprou.
--
-- Pedido não pago e cancelado ficam de fora: carrinho abandonado em
-- AWAITING não é venda, e cancelado deixou de ser.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.top_produtos(p_limite integer DEFAULT 3)
RETURNS TABLE (
  id          uuid,
  name        text,
  description text,
  price       numeric,
  image_url   text,
  vendidos    bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.price,
    p.image_url,
    COALESCE(SUM(oi.quantity), 0)::bigint AS vendidos
  FROM products p
  JOIN order_items oi ON oi.product_id = p.id
  JOIN orders      o  ON o.id = oi.order_id
  WHERE p.active
    AND o.payment_status <> 'AWAITING'
    AND o.status <> 'CANCELED'
  GROUP BY p.id, p.name, p.description, p.price, p.image_url
  ORDER BY vendidos DESC, p.name ASC
  -- Teto fixo: o limite vem do navegador e sem isto daria para pedir a
  -- lista inteira de produtos numa chamada só.
  LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 3), 10));
$$;

REVOKE ALL ON FUNCTION public.top_produtos(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.top_produtos(integer) TO anon, authenticated;

-- Sem este índice o ranking varre order_items inteira a cada visita.
CREATE INDEX IF NOT EXISTS order_items_produto_idx ON order_items (product_id);

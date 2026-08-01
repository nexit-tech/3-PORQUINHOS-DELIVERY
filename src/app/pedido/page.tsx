// src/app/pedido/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, UtensilsCrossed, Plus, Clock, X } from 'lucide-react';
import styles from './page.module.css';
import ProductModal from '@/components/client/ProductModal';
import StoreClosedAlert from '@/components/client/StoreClosedAlert';
import NexitFooter from '@/components/client/NexitFooter';
import MaisVendidas from '@/components/client/MaisVendidas';
import { supabase } from '@/services/supabase';
import { useProducts } from '@/hooks/useProducts';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { Product } from '@/types/product';

export default function PedidoHome() {
  const { products, categories, isLoading } = useProducts();
  const { isOpen, loading: storeLoading } = useStoreStatus();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showClosedAlert, setShowClosedAlert] = useState(false);
  // Ids dos campeões de venda, para o selo "MAIS VENDIDA". Vem da mesma
  // RPC do carrossel — nenhum produto é eleito destaque no chute.
  const [topIds, setTopIds] = useState<string[]>([]);

  useEffect(() => {
    let vivo = true;
    supabase.rpc('top_produtos', { p_limite: 3 }).then(({ data }) => {
      if (vivo && Array.isArray(data)) setTopIds(data.map((p: any) => p.id));
    });
    return () => {
      vivo = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (!products) return [];

    return products.filter((prod) => {
      if (!prod.active) return false;

      const matchesSearch = prod.name.toLowerCase().includes(searchTerm.toLowerCase());
      const prodCatId = prod.categoryId || (prod as any).category_id;
      const matchesCategory = selectedCategoryId === 'all' || prodCatId === selectedCategoryId;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategoryId]);

  /**
   * Cardápio dividido em uma fileira por categoria.
   *
   * Só vale sem filtro: com categoria escolhida ou busca ativa o cliente
   * já restringiu, e aí a lista corrida é melhor — ela mostra tudo de uma
   * vez, sem obrigar a deslizar para descobrir o que existe.
   */
  const fileiras = useMemo(() => {
    if (selectedCategoryId !== 'all' || searchTerm) return [];

    return categories
      .map((cat) => ({
        categoria: cat,
        itens: filteredProducts.filter(
          (p) => (p.categoryId || (p as any).category_id) === cat.id
        ),
      }))
      .filter((f) => f.itens.length > 0);
  }, [categories, filteredProducts, selectedCategoryId, searchTerm]);

  const emFileiras = fileiras.length > 0;

  const handleProductClick = (product: Product) => {
    if (!isOpen) {
      setShowClosedAlert(true);
      return;
    }

    setSelectedProduct(product);
  };

  const moeda = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <main className={styles.container}>
      <div className={styles.coluna}>
        {/* Só a busca no topo. A capa laranja com saudação saiu: ocupava um
            terço da primeira tela para dizer o que o cliente já sabia (em
            que loja está) e empurrava a comida para baixo da dobra. */}
        <header className={styles.buscaFaixa}>
          <div className={styles.busca}>
            <Search size={19} />
            <input
              type="text"
              placeholder="O que vamos comer hoje?"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Buscar no cardápio"
            />
            {searchTerm && (
              <button
                className={styles.limparBusca}
                onClick={() => setSearchTerm('')}
                aria-label="Limpar busca"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </header>

        {!storeLoading && !isOpen && (
          <div className={styles.avisoFechado}>
            <Clock size={18} />
            <span>
              Estamos fechados agora — dá pra montar o pedido, mas ele só entra
              quando abrirmos.
            </span>
          </div>
        )}

        {/* Some só durante a busca: ali o cliente digitou um item
            específico e a vitrine empurraria o resultado para baixo.
            Trocar de categoria não esconde mais — o destaque da casa
            continua à vista. */}
        {!searchTerm && (
          <MaisVendidas
            onEscolher={(id) => {
              const p = products?.find((x) => x.id === id);
              if (p) handleProductClick(p);
            }}
          />
        )}

        <nav className={styles.categorias} aria-label="Categorias">
          <div className={styles.trilho}>
            <button
              className={`${styles.chip} ${selectedCategoryId === 'all' ? styles.chipAtivo : ''}`}
              onClick={() => setSelectedCategoryId('all')}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`${styles.chip} ${selectedCategoryId === cat.id ? styles.chipAtivo : ''}`}
                onClick={() => setSelectedCategoryId(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </nav>

        <section className={styles.feed}>

          {isLoading || storeLoading ? (
            <div className={styles.grade}>
              {/* Esqueleto em vez de spinner: a página já nasce com a forma
                  final, então nada pula de lugar quando os dados chegam. */}
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={styles.esqueleto}>
                  <div className={styles.esqueletoFoto} />
                  <div className={styles.esqueletoLinha} />
                  <div className={`${styles.esqueletoLinha} ${styles.curta}`} />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className={styles.vazio}>
              <div className={styles.vazioIcone}>
                <UtensilsCrossed size={30} />
              </div>
              <strong>Nada por aqui</strong>
              <p>
                {searchTerm
                  ? `Não achamos nada com "${searchTerm}".`
                  : 'Esta categoria está sem itens no momento.'}
              </p>
              {searchTerm && (
                <button className={styles.vazioBotao} onClick={() => setSearchTerm('')}>
                  Ver o cardápio todo
                </button>
              )}
            </div>
          ) : emFileiras ? (
            /* Uma fileira deslizante por categoria. */
            <div className={styles.fileiras}>
              {fileiras.map((f) => (
                <section key={f.categoria.id} className={styles.fileira}>
                  <div className={styles.fileiraTopo}>
                    <h3>{f.categoria.name}</h3>
                    {/* Página dedicada da categoria, não filtro na mesma
                        tela: assim o voltar do celular funciona e o link
                        pode ser compartilhado. */}
                    <Link
                      href={`/pedido/categoria/${f.categoria.id}`}
                      className={styles.verTudo}
                    >
                      ver todos
                    </Link>
                  </div>

                  <div className={styles.fileiraTrilho}>
                    {f.itens.map((prod, index) => (
                      <CardProduto
                        key={prod.id}
                        prod={prod}
                        index={index}
                        variante="fileira"
                        onAbrir={handleProductClick}
                        moeda={moeda}
                        destaque={topIds.includes(prod.id) ? 'MAIS VENDIDA' : null}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className={styles.grade}>
              {filteredProducts.map((prod, index) => (
                <CardProduto
                  key={prod.id}
                  prod={prod}
                  index={index}
                  variante="lista"
                  onAbrir={handleProductClick}
                  moeda={moeda}
                  destaque={topIds.includes(prod.id) ? 'MAIS VENDIDA' : null}
                />
              ))}
            </div>
          )}

          <NexitFooter />
        </section>
      </div>

      {selectedProduct && isOpen && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}

      {showClosedAlert && <StoreClosedAlert onClose={() => setShowClosedAlert(false)} />}
    </main>
  );
}

/**
 * Card de produto em duas formas:
 *  - "lista"   linha horizontal, foto 1:1 à esquerda (cardápio filtrado)
 *  - "fileira" cartão vertical estreito, para o carrossel por categoria
 *
 * O mesmo componente nas duas para não haver dois lugares mostrando preço
 * de formas diferentes.
 */
function CardProduto({
  prod,
  index,
  variante,
  onAbrir,
  moeda,
  destaque,
}: {
  prod: Product;
  index: number;
  variante: 'lista' | 'fileira';
  onAbrir: (p: Product) => void;
  moeda: (v: number) => string;
  destaque?: string | null;
}) {
  const naFileira = variante === 'fileira';

  return (
    <article
      className={naFileira ? styles.cardFileira : styles.card}
      onClick={() => onAbrir(prod)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAbrir(prod);
        }
      }}
    >
      <div className={naFileira ? styles.fotoFileira : styles.foto}>
        {destaque && <span className={styles.selo}>{destaque}</span>}
        {prod.image ? (
          <Image
            src={prod.image}
            alt={prod.name}
            fill
            sizes={naFileira ? '170px' : '120px'}
            className={styles.fotoImg}
            priority={index < 3}
            quality={78}
          />
        ) : (
          <div className={styles.fotoVazia}>
            <UtensilsCrossed size={24} />
          </div>
        )}
      </div>

      <div className={naFileira ? styles.conteudoFileira : styles.conteudo}>
        <h3 className={styles.nome}>{prod.name}</h3>
        {prod.description && <p className={styles.descricao}>{prod.description}</p>}

        <div className={styles.base}>
          <span className={styles.preco}>{moeda(prod.price)}</span>
          <span className={styles.botao} aria-hidden="true">
            <Plus size={17} strokeWidth={2.9} />
          </span>
        </div>
      </div>
    </article>
  );
}

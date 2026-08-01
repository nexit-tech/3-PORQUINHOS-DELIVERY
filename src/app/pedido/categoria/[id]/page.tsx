'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Plus, UtensilsCrossed } from 'lucide-react';
import ProductModal from '@/components/client/ProductModal';
import StoreClosedAlert from '@/components/client/StoreClosedAlert';
import NexitFooter from '@/components/client/NexitFooter';
import { useProducts } from '@/hooks/useProducts';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { Product } from '@/types/product';
import styles from '../../page.module.css';

/**
 * Categoria inteira, aberta pelo "ver todos" das fileiras do cardápio.
 *
 * Reaproveita o CSS do cardápio de propósito: card de produto que muda de
 * aparência conforme a tela vira duas verdades para manter em sincronia.
 */
export default function CategoriaPage() {
  const { id } = useParams<{ id: string }>();
  const { products, categories, isLoading } = useProducts();
  const { isOpen, loading: storeLoading } = useStoreStatus();

  const [selecionado, setSelecionado] = useState<Product | null>(null);
  const [avisoFechado, setAvisoFechado] = useState(false);

  const categoria = categories.find((c) => c.id === id);

  const itens = useMemo(() => {
    if (!products) return [];
    return products.filter(
      (p) => p.active && (p.categoryId || (p as any).category_id) === id
    );
  }, [products, id]);

  const abrir = (p: Product) => {
    if (!isOpen) {
      setAvisoFechado(true);
      return;
    }
    setSelecionado(p);
  };

  const moeda = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <main className={styles.container}>
      <div className={styles.coluna}>
        <header className={styles.buscaFaixa} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/pedido" className={styles.voltarCategoria} aria-label="Voltar ao cardápio">
            <ArrowLeft size={20} />
          </Link>
          <h1 className={styles.tituloCategoria}>
            {categoria?.name || 'Categoria'}
          </h1>
        </header>

        <section className={styles.feed}>
          {isLoading || storeLoading ? (
            <div className={styles.grade}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={styles.esqueleto}>
                  <div className={styles.esqueletoFoto} />
                  <div className={styles.esqueletoLinha} />
                </div>
              ))}
            </div>
          ) : itens.length === 0 ? (
            <div className={styles.vazio}>
              <div className={styles.vazioIcone}>
                <UtensilsCrossed size={30} />
              </div>
              <strong>Nada por aqui</strong>
              <p>Esta categoria está sem itens no momento.</p>
              <Link href="/pedido" className={styles.vazioBotao}>
                Ver o cardápio todo
              </Link>
            </div>
          ) : (
            <div className={styles.grade}>
              {itens.map((prod, index) => (
                <article
                  key={prod.id}
                  className={styles.card}
                  onClick={() => abrir(prod)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      abrir(prod);
                    }
                  }}
                >
                  <div className={styles.foto}>
                    {prod.image ? (
                      <Image
                        src={prod.image}
                        alt={prod.name}
                        fill
                        sizes="120px"
                        className={styles.fotoImg}
                        priority={index < 4}
                        quality={78}
                      />
                    ) : (
                      <div className={styles.fotoVazia}>
                        <UtensilsCrossed size={24} />
                      </div>
                    )}
                  </div>

                  <div className={styles.conteudo}>
                    <h3 className={styles.nome}>{prod.name}</h3>
                    {prod.description && (
                      <p className={styles.descricao}>{prod.description}</p>
                    )}
                    <div className={styles.base}>
                      <span className={styles.preco}>{moeda(prod.price)}</span>
                      <span className={styles.botao} aria-hidden="true">
                        <Plus size={17} strokeWidth={2.9} />
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <NexitFooter />
        </section>
      </div>

      {selecionado && isOpen && (
        <ProductModal product={selecionado} onClose={() => setSelecionado(null)} />
      )}
      {avisoFechado && <StoreClosedAlert onClose={() => setAvisoFechado(false)} />}
    </main>
  );
}

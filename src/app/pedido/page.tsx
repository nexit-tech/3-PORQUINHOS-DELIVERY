// src/app/pedido/page.tsx
'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Search, ShoppingBag } from 'lucide-react';
import styles from './page.module.css';
import ProductModal from '@/components/client/ProductModal';
import ClosedStoreModal from '@/components/client/ClosedStoreModal';
import { useProducts } from '@/hooks/useProducts';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { Product } from '@/types/product';

export default function PedidoHome() {
  const { products, categories, isLoading } = useProducts();
  const { isOpen, currentDay, loading: storeLoading } = useStoreStatus();
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // 🔥 FILTRA PRODUTOS: Remove inativos E verifica se loja está aberta
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products.filter(prod => {
      // 🔥 NOVA REGRA: Só mostra produtos ativos
      if (!prod.active) return false;
      
      const matchesSearch = prod.name.toLowerCase().includes(searchTerm.toLowerCase());
      const prodCatId = prod.categoryId || (prod as any).category_id;
      const matchesCategory = selectedCategoryId === 'all' || prodCatId === selectedCategoryId;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategoryId]);

  // 🔥 MOSTRA MODAL DE LOJA FECHADA
  if (!storeLoading && !isOpen) {
    return <ClosedStoreModal currentDay={currentDay} />;
  }

  return (
    <main className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.welcome}>
          <small>Bem-vindo(a) ao</small>
          <h1>3 porquinhos delivery!</h1>
        </div>
        <div className={styles.searchBar}>
          <Search size={20} color="var(--text-light)" />
          <input 
            type="text" 
            placeholder="O que vamos comer hoje?" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
      </header>

      {/* CATEGORIAS */}
      <section className={styles.categories}>
        <div className={styles.scrollContainer}>
          <button 
            className={`${styles.catPill} ${selectedCategoryId === 'all' ? styles.catActive : ''}`} 
            onClick={() => setSelectedCategoryId('all')}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id} 
              className={`${styles.catPill} ${selectedCategoryId === cat.id ? styles.catActive : ''}`} 
              onClick={() => setSelectedCategoryId(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* LISTA DE PRODUTOS */}
      <section className={styles.feed}>
        <h2 className={styles.sectionTitle}>
          {searchTerm ? 'Resultados' : 'Destaques'}
        </h2>
        
        {isLoading || storeLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Carregando delícias...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className={styles.emptyState}>
            <ShoppingBag size={48} color="#ddd"/>
            <p>Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className={styles.productList}>
            {filteredProducts.map((prod, index) => (
              <div 
                key={prod.id} 
                className={styles.productCard} 
                onClick={() => setSelectedProduct(prod)}
              >
                <div className={styles.prodInfo}>
                  <h3>{prod.name}</h3>
                  <p>{prod.description}</p>
                  <span className={styles.price}>
                    {prod.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                
                <div className={styles.prodRight}>
                  <div className={styles.imageWrapper}>
                    {prod.image ? (
                      <Image 
                        src={prod.image} 
                        alt={prod.name}
                        fill
                        sizes="(max-width: 768px) 100px, 150px"
                        className={styles.productImage}
                        priority={index < 6} 
                        quality={65}
                      />
                    ) : (
                      <div className={styles.imgPlaceholder} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL DE PRODUTO */}
      {selectedProduct && (
        <ProductModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}
    </main>
  );
}
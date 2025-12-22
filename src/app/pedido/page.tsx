'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import styles from './page.module.css';
import ProductModal from '@/components/client/ProductModal';

// Dados Mockados
const CATEGORIES = [
  { id: 1, name: 'Lanches', active: true },
  { id: 2, name: 'Pizzas', active: false },
  { id: 3, name: 'Bebidas', active: false },
  { id: 4, name: 'Sobremesas', active: false },
];

const PRODUCTS = [
  { id: 1, name: 'X-Bacon Artesanal', desc: 'Pão brioche, burger 180g, muito bacon e cheddar.', price: 32.90 },
  { id: 2, name: 'Combo Casal', desc: '2 X-Salada + Coca 2L + Batata Frita G.', price: 65.00 },
  { id: 3, name: 'Coca Cola 350ml', desc: 'Geladinha trincando.', price: 6.00 },
  { id: 4, name: 'Pudim de Leite', desc: 'Fatia generosa do nosso pudim caseiro.', price: 12.00 },
];

export default function PedidoHome() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

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
          <input type="text" placeholder="O que vamos comer hoje?" />
        </div>
      </header>

      {/* CATEGORIAS */}
      <section className={styles.categories}>
        <div className={styles.scrollContainer}>
          {CATEGORIES.map(cat => (
            <button 
              key={cat.id} 
              className={`${styles.catPill} ${cat.active ? styles.catActive : ''}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* LISTA DE PRODUTOS */}
      <section className={styles.feed}>
        <h2 className={styles.sectionTitle}>Destaques</h2>
        
        <div className={styles.productList}>
          {PRODUCTS.map(prod => (
            <div 
              key={prod.id} 
              className={styles.productCard}
              onClick={() => setSelectedProduct(prod)} // Card inteiro clicável
            >
              <div className={styles.prodInfo}>
                <h3>{prod.name}</h3>
                <p>{prod.desc}</p>
                <span className={styles.price}>
                  {prod.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              
              <div className={styles.prodRight}>
                {/* Apenas a imagem agora, sem botão de + */}
                <div className={styles.imgPlaceholder} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODAL DO PRODUTO */}
      {selectedProduct && (
        <ProductModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}
    </main>
  );
}
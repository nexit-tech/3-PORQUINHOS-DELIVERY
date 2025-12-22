'use client';

import { useState } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { Product } from '@/types/product';
import CategorySidebar from '@/components/admin/CategorySidebar';
import ProductCard from '@/components/admin/ProductCard';
import ProductModal from '@/components/admin/ProductModal';
import CategoryModal from '@/components/admin/CategoryModal';
import styles from './page.module.css';
import { PlusCircle } from 'lucide-react';

export default function ProductsPage() {
  const { categories, products, activeCategory, setActiveCategory } = useProducts();
  
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // --- HANDLERS ---
  const handleNewProduct = () => {
    setEditingProduct(null);
    setProductModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductModalOpen(true);
  };

  const handleSaveProduct = (productData: Partial<Product>) => {
    console.log("SALVAR PRODUTO:", productData);
    setProductModalOpen(false);
  };

  const handleSaveCategory = (name: string) => {
    console.log("SALVAR CATEGORIA:", name);
    alert(`Categoria "${name}" criada!`);
  };

  return (
    <div className={styles.container}>
      <CategorySidebar 
        categories={categories} 
        activeId={activeCategory} 
        onSelect={setActiveCategory}
        onNewCategory={() => setCategoryModalOpen(true)} // <--- CONECTADO AQUI
      />

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div>
            <h1>Catálogo de Produtos</h1>
            <p>Gerencie seus itens, preços e complementos</p>
          </div>
          
          {/* BOTÃO REDUNDANTE REMOVIDO DAQUI */}
          
          <button className={styles.newBtn} onClick={handleNewProduct}>
            <PlusCircle size={20} /> Novo Produto
          </button>
        </header>

        <div className={styles.grid}>
          {products.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onEdit={handleEditProduct} 
            />
          ))}
        </div>
      </main>

      {isProductModalOpen && (
        <ProductModal 
          product={editingProduct} 
          onClose={() => setProductModalOpen(false)} 
          onSave={handleSaveProduct} 
        />
      )}

      {isCategoryModalOpen && (
        <CategoryModal 
          onClose={() => setCategoryModalOpen(false)}
          onSave={handleSaveCategory}
        />
      )}
    </div>
  );
}
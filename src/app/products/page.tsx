'use client';

import { useState } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { Product } from '@/types/product';
import CategorySidebar from '@/components/admin/CategorySidebar';
import ProductCard from '@/components/admin/ProductCard';
import ProductModal from '@/components/admin/ProductModal';
import CategoryModal from '@/components/admin/CategoryModal';
import styles from './page.module.css';
import { PlusCircle, Loader2 } from 'lucide-react';

export default function ProductsPage() {
  // Puxa tudo do Hook (agora conectado ao DB)
  const { 
    products, 
    categories, 
    activeCategory, 
    setActiveCategory, 
    saveProduct, // Função que vai no DB
    isLoading 
  } = useProducts();
  
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // FILTRO SEGURO (Evita crash se products for undefined)
  const filteredProducts = (products || []).filter(p => {
    if (activeCategory === 'all') return true;
    return p.categoryId === activeCategory;
  });

  const handleNewProduct = () => {
    setEditingProduct(null);
    setProductModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductModalOpen(true);
  };

  // SALVAR NO BANCO
  const handleSaveWrapper = async (productData: Partial<Product>) => {
    // Se for novo, garante que tem categoryId
    if (!productData.id && !productData.categoryId) {
      productData.categoryId = activeCategory === 'all' ? categories[0]?.id : activeCategory;
    }

    await saveProduct(productData);
    setProductModalOpen(false);
  };

  if (isLoading) {
    return <div className={styles.loading}><Loader2 className={styles.spinner} /> Carregando produtos...</div>;
  }

  return (
    <div className={styles.container}>
      <CategorySidebar 
        categories={categories || []} // Proteção contra null
        activeId={activeCategory} 
        onSelect={setActiveCategory}
        onNewCategory={() => setCategoryModalOpen(true)}
      />

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div>
            <h1>Catálogo</h1>
            <p>{filteredProducts.length} produtos cadastrados</p>
          </div>
          <button className={styles.newBtn} onClick={handleNewProduct}>
            <PlusCircle size={20} /> Novo Produto
          </button>
        </header>

        <div className={styles.grid}>
          {filteredProducts.length === 0 ? (
            <div className={styles.emptyState}>Nenhum produto encontrado.</div>
          ) : (
            filteredProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onEdit={handleEditProduct} 
              />
            ))
          )}
        </div>
      </main>

      {isProductModalOpen && (
        <ProductModal 
          product={editingProduct}
          existingProducts={products || []}
          onClose={() => setProductModalOpen(false)} 
          onSave={handleSaveWrapper} 
        />
      )}

      {isCategoryModalOpen && (
        <CategoryModal onClose={() => setCategoryModalOpen(false)} onSave={() => {}} />
      )}
    </div>
  );
}
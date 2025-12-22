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
  const { 
    products, 
    categories, 
    activeCategory, 
    setActiveCategory, 
    saveProduct, 
    deleteProduct,   
    addCategory, 
    deleteCategory,  
    isLoading 
  } = useProducts();
  
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // --- FILTRO DE PRODUTOS ---
  const filteredProducts = (products || []).filter(p => {
    if (activeCategory === 'all') return true;
    return (p.categoryId === activeCategory) || ((p as any).category_id === activeCategory);
  });

  const handleNewProduct = () => {
    setEditingProduct(null);
    setProductModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductModalOpen(true);
  };

  // --- SALVAR PRODUTO ---
  const handleSaveWrapper = async (productData: Partial<Product>) => {
    // Se a categoria vier vazia (ex: usuário esqueceu), tenta usar a ativa
    if (!productData.id && !productData.categoryId) {
      if (activeCategory !== 'all') {
        productData.categoryId = activeCategory;
      }
    }

    await saveProduct(productData);
    setProductModalOpen(false);
  };

  const handleSaveCategory = async (name: string) => {
    if (addCategory) {
      await addCategory(name);
      setCategoryModalOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className={styles.spinner} size={48} />
        <p>Carregando catálogo...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* SIDEBAR COM OPÇÃO DE DELETAR */}
      <CategorySidebar 
        categories={categories || []} 
        activeId={activeCategory} 
        onSelect={setActiveCategory}
        onNewCategory={() => setCategoryModalOpen(true)}
        onDeleteCategory={deleteCategory} 
      />

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div>
            <h1>Catálogo</h1>
            <p>
              {filteredProducts.length} produto(s) 
              {activeCategory !== 'all' 
                ? ` em "${categories.find(c => c.id === activeCategory)?.name || 'Categoria'}"` 
                : ' no total'}
            </p>
          </div>
          <button className={styles.newBtn} onClick={handleNewProduct}>
            <PlusCircle size={20} /> Novo Produto
          </button>
        </header>

        <div className={styles.grid}>
          {filteredProducts.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Nenhum produto encontrado nesta categoria.</p>
              {activeCategory !== 'all' && (
                <button className={styles.clearFilterBtn} onClick={() => setActiveCategory('all')}>
                  Ver todos os produtos
                </button>
              )}
            </div>
          ) : (
            filteredProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onEdit={handleEditProduct} 
                onDelete={deleteProduct} 
              />
            ))
          )}
        </div>
      </main>

      {/* MODAL DE PRODUTO (Agora recebe categories) */}
      {isProductModalOpen && (
        <ProductModal 
          product={editingProduct}
          existingProducts={products || []}
          categories={categories || []} /* <--- IMPORTANTE: Passando as categorias aqui */
          onClose={() => setProductModalOpen(false)} 
          onSave={handleSaveWrapper} 
        />
      )}

      {/* MODAL DE CATEGORIA */}
      {isCategoryModalOpen && (
        <CategoryModal 
          isOpen={isCategoryModalOpen}
          onClose={() => setCategoryModalOpen(false)} 
          onSave={handleSaveCategory} 
        />
      )}
    </div>
  );
}
// src/app/products/page.tsx
'use client';

import { useState } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { Product } from '@/types/product';
import CategorySidebar from '@/components/admin/CategorySidebar';
import ProductCard from '@/components/admin/ProductCard';
import ProductModal from '@/components/admin/ProductModal';
import CategoryModal from '@/components/admin/CategoryModal';
import ReorderModal from '@/components/admin/ReorderModal';
import styles from './page.module.css';
import { PlusCircle, Loader2, Eye, EyeOff, ArrowUpDown } from 'lucide-react';

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
    toggleProductActive,
    reorderCategories,
    reorderProducts,
    isLoading 
  } = useProducts();
  
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showInactive, setShowInactive] = useState(true);
  const [isReorderModalOpen, setReorderModalOpen] = useState<'categories' | 'products' | null>(null);

  // --- FILTRO DE PRODUTOS ---
  const filteredProducts = (products || []).filter(p => {
    const matchesCategory = activeCategory === 'all' || 
                           (p.categoryId === activeCategory) || 
                           ((p as any).category_id === activeCategory);
    
    const matchesActiveFilter = showInactive || p.active;
    
    return matchesCategory && matchesActiveFilter;
  });

  const handleNewProduct = () => {
    setEditingProduct(null);
    setProductModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductModalOpen(true);
  };

  const handleSaveWrapper = async (productData: Partial<Product>) => {
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

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    console.log('📍 handleToggleActive chamado:', { id, currentStatus });
    
    if (!toggleProductActive) {
      console.error('❌ toggleProductActive não existe no hook!');
      return;
    }

    try {
      await toggleProductActive(id, currentStatus);
    } catch (error) {
      console.error('❌ Erro ao executar toggle:', error);
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
      <CategorySidebar 
        categories={categories || []} 
        activeId={activeCategory} 
        onSelect={setActiveCategory}
        onNewCategory={() => setCategoryModalOpen(true)}
        onDeleteCategory={deleteCategory}
        onReorder={() => setReorderModalOpen('categories')}
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
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* 🔥 BOTÃO REORDENAR PRODUTOS */}
            <button 
              className={styles.reorderBtn}
              onClick={() => setReorderModalOpen('products')}
              title="Reordenar produtos"
            >
              <ArrowUpDown size={20} />
              Ordenar
            </button>

            {/* 🔥 TOGGLE PARA MOSTRAR PAUSADOS */}
            <button 
              className={styles.filterBtn}
              onClick={() => setShowInactive(!showInactive)}
              title={showInactive ? "Ocultar pausados" : "Mostrar pausados"}
            >
              {showInactive ? <Eye size={20} /> : <EyeOff size={20} />}
              {showInactive ? 'Ocultar Pausados' : 'Mostrar Pausados'}
            </button>

            <button className={styles.newBtn} onClick={handleNewProduct}>
              <PlusCircle size={20} /> Novo Produto
            </button>
          </div>
        </header>

        <div className={styles.grid}>
          {filteredProducts.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Nenhum produto encontrado.</p>
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
                onToggleActive={handleToggleActive}
              />
            ))
          )}
        </div>
      </main>

      {isProductModalOpen && (
        <ProductModal 
          product={editingProduct}
          existingProducts={products || []}
          categories={categories || []}
          onClose={() => setProductModalOpen(false)} 
          onSave={handleSaveWrapper} 
        />
      )}

      {isCategoryModalOpen && (
        <CategoryModal 
          isOpen={isCategoryModalOpen}
          onClose={() => setCategoryModalOpen(false)} 
          onSave={handleSaveCategory} 
        />
      )}

      {/* 🔥 MODAL DE REORDENAÇÃO DE PRODUTOS */}
      {isReorderModalOpen === 'products' && (
        <ReorderModal
          title="Reordenar Produtos"
          items={filteredProducts.map(p => ({ id: p.id, name: p.name }))}
          onClose={() => setReorderModalOpen(null)}
          onSave={(newOrder) => {
            console.log('💾 Salvando nova ordem de produtos:', newOrder);
            
            // 🔥 RECONSTRÓI OS PRODUTOS NA ORDEM CORRETA
            const reorderedProducts = newOrder
              .map(item => filteredProducts.find(p => p.id === item.id))
              .filter(p => p !== undefined) as Product[];
            
            console.log('📦 Produtos reordenados:', reorderedProducts.map(p => p.name));
            
            if (reorderedProducts.length === 0) {
              console.error('❌ Nenhum produto encontrado para reordenar!');
              return;
            }
            
            reorderProducts(reorderedProducts);
          }}
        />
      )}

      {/* 🔥 MODAL DE REORDENAÇÃO DE CATEGORIAS */}
      {isReorderModalOpen === 'categories' && (
        <ReorderModal
          title="Reordenar Categorias"
          items={categories.map(c => ({ id: c.id, name: c.name }))}
          onClose={() => setReorderModalOpen(null)}
          onSave={(newOrder) => {
            console.log('💾 Salvando nova ordem de categorias:', newOrder);
            
            // 🔥 RECONSTRÓI AS CATEGORIAS NA ORDEM CORRETA
            const reorderedCategories = newOrder
              .map(item => categories.find(c => c.id === item.id))
              .filter(c => c !== undefined) as any[];
            
            console.log('📂 Categorias reordenadas:', reorderedCategories.map(c => c.name));
            
            if (reorderedCategories.length === 0) {
              console.error('❌ Nenhuma categoria encontrada para reordenar!');
              return;
            }
            
            reorderCategories(reorderedCategories);
          }}
        />
      )}
    </div>
  );
}
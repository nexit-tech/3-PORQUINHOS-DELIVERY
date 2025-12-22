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
    addCategory, // <--- Certifique-se que seu hook exporta isso (adicionei na resposta anterior)
    isLoading 
  } = useProducts();
  
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // FILTRO CORRIGIDO
  const filteredProducts = (products || []).filter(p => {
    if (activeCategory === 'all') return true;
    // Compara o category_id do produto com a categoria ativa
    // Verifica ambas as notações (categoryId ou category_id) para garantir
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

  const handleSaveWrapper = async (productData: Partial<Product>) => {
    // Se for novo produto e não tiver categoria selecionada no form, usa a ativa
    if (!productData.id && !productData.categoryId && activeCategory !== 'all') {
      productData.categoryId = activeCategory;
    } else if (!productData.id && !productData.categoryId && categories.length > 0) {
      // Fallback para a primeira categoria se estiver em 'all'
      productData.categoryId = categories[0].id;
    }

    await saveProduct(productData);
    setProductModalOpen(false);
  };

  // --- AQUI ESTAVA O PROBLEMA DO MODAL DE CATEGORIA ---
  const handleSaveCategory = async (name: string) => {
    if (addCategory) {
      await addCategory(name);
      setCategoryModalOpen(false); // Fecha o modal só depois de salvar
    } else {
      alert("Função de adicionar categoria não encontrada no hook.");
    }
  };

  if (isLoading) {
    return <div className={styles.loading}><Loader2 className={styles.spinner} /> Carregando...</div>;
  }

  return (
    <div className={styles.container}>
      <CategorySidebar 
        categories={categories || []} 
        activeId={activeCategory} 
        onSelect={setActiveCategory}
        onNewCategory={() => setCategoryModalOpen(true)}
      />

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div>
            <h1>Catálogo</h1>
            <p>{filteredProducts.length} produtos nesta categoria</p>
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
        <CategoryModal 
          isOpen={isCategoryModalOpen}
          onClose={() => setCategoryModalOpen(false)} 
          onSave={handleSaveCategory} // <--- Agora passando a função correta
        />
      )}
    </div>
  );
}
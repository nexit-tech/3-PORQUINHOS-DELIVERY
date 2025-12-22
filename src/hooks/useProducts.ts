import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase'; // Ajuste se seu client estiver em outro lugar
import { Product } from '@/types/product';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]); // Tipagem relaxada para evitar erro
  const [activeCategory, setActiveCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // CARREGAR DADOS
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setIsLoading(true);
      // Busca categorias
      const { data: cats, error: catError } = await supabase.from('categories').select('*');
      if (catError) throw catError;

      // Busca produtos
      const { data: prods, error: prodError } = await supabase.from('products').select('*');
      if (prodError) throw prodError;

      setCategories(cats || []);
      setProducts(prods || []);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // SALVAR / ATUALIZAR
  async function saveProduct(product: Partial<Product>) {
    try {
      // Prepara o payload removendo campos undefined
      const payload = {
        name: product.name,
        description: product.description,
        price: product.price,
        image: product.image,
        category_id: product.categoryId, // Verifica se no banco é category_id ou categoryId
        complements: product.complements // Supabase salva JSONB direto aqui
      };

      let error;
      
      if (product.id) {
        // ATUALIZAR
        const { error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', product.id);
        error = updateError;
      } else {
        // CRIAR NOVO
        const { error: insertError } = await supabase
          .from('products')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      
      await fetchData(); // Recarrega a lista
      return { success: true };

    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      alert('Erro ao salvar no banco. Verifique o console.');
      return { success: false };
    }
  }

  // DELETAR
  async function deleteProduct(id: string) {
    if (!confirm('Tem certeza que deseja excluir?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  }

  return {
    products,
    categories,
    activeCategory,
    setActiveCategory,
    saveProduct,   // Função para salvar
    deleteProduct, // Função para deletar
    isLoading
  };
}
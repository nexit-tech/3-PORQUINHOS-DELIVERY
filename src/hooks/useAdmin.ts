import { useState } from 'react';
import { supabase } from '@/services/supabase';

export function useAdmin() {
  const [loading, setLoading] = useState(false);

  // --- CATEGORIAS ---
  const createCategory = async (name: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('categories').insert([{ name }]);
      if (error) throw error;
      alert('Categoria criada com sucesso!');
      return true;
    } catch (error) {
      console.error(error);
      alert('Erro ao criar categoria.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Tem certeza? Isso pode afetar produtos dessa categoria.')) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) alert('Erro ao deletar.');
  };

  // --- GRUPOS DE COMPLEMENTOS ---
  const createComplementGroup = async (data: { name: string; min: number; max: number; options: any[] }) => {
    setLoading(true);
    try {
      // 1. Criar o Grupo
      const { data: groupData, error: groupError } = await supabase
        .from('complement_groups')
        .insert([{ 
          name: data.name, 
          min_selection: data.min, 
          max_selection: data.max 
        }])
        .select()
        .single();

      if (groupError) throw groupError;

      // 2. Criar as Opções vinculadas ao Grupo
      if (data.options.length > 0) {
        const optionsToInsert = data.options.map(opt => ({
          group_id: groupData.id,
          name: opt.name,
          price: opt.price
        }));

        const { error: optError } = await supabase
          .from('complement_options')
          .insert(optionsToInsert);

        if (optError) throw optError;
      }

      alert('Grupo de complementos criado!');
      return true;
    } catch (error) {
      console.error(error);
      alert('Erro ao criar grupo.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // --- PRODUTOS ---
  const createProduct = async (product: any, selectedGroupIds: string[]) => {
    setLoading(true);
    try {
      // 1. Criar Produto
      const { data: newProduct, error: prodError } = await supabase
        .from('products')
        .insert([{
          name: product.name,
          description: product.description,
          price: parseFloat(product.price),
          category_id: product.categoryId,
          image_url: product.image
        }])
        .select()
        .single();

      if (prodError) throw prodError;

      // 2. Vincular Grupos de Complementos (se houver)
      if (selectedGroupIds.length > 0) {
        const links = selectedGroupIds.map(groupId => ({
          product_id: newProduct.id,
          group_id: groupId
        }));

        const { error: linkError } = await supabase
          .from('product_complements')
          .insert(links);

        if (linkError) throw linkError;
      }

      alert('Produto criado com sucesso!');
      return true;
    } catch (error) {
      console.error(error);
      alert('Erro ao criar produto.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    createCategory,
    deleteCategory,
    createComplementGroup,
    createProduct
  };
}
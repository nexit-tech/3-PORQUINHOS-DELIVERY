import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { Product, ComplementGroup } from '@/types/product';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setIsLoading(true);
      
      // 1. Busca Categorias
      const { data: cats } = await supabase.from('categories').select('*');
      setCategories(cats || []);

      // 2. Busca Produtos com TODAS as relações (Grupos e Opções)
      // Essa query é complexa: entra em product_complements, pega o grupo, e pega as opções do grupo
      const { data: rawProducts, error } = await supabase
        .from('products')
        .select(`
          *,
          product_complements (
            complement_groups (
              id,
              name,
              min_selection,
              max_selection,
              complement_options (
                id,
                name,
                price
              )
            )
          )
        `);

      if (error) throw error;

      // 3. Formata os dados para o Front-End (Mapper)
      const formattedProducts: Product[] = rawProducts.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        image: p.image_url || p.image, // Garante compatibilidade
        category_id: p.category_id,
        active: p.active,
        complements: p.product_complements.map((pc: any) => ({
          id: pc.complement_groups.id,
          name: pc.complement_groups.name,
          min: pc.complement_groups.min_selection,
          max: pc.complement_groups.max_selection,
          options: pc.complement_groups.complement_options || []
        }))
      }));

      setProducts(formattedProducts);

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveProduct(product: Partial<Product>) {
    try {
      // A. Salva/Atualiza o Produto Principal
      const productPayload = {
        name: product.name,
        description: product.description,
        price: product.price,
        image_url: product.image,
        category_id: product.category_id,
        active: product.active !== undefined ? product.active : true
      };

      let productId = product.id;
      let error;

      if (productId) {
        const { error: upError } = await supabase.from('products').update(productPayload).eq('id', productId);
        error = upError;
      } else {
        const { data: newProd, error: inError } = await supabase.from('products').insert(productPayload).select().single();
        productId = newProd?.id;
        error = inError;
      }

      if (error) throw error;
      if (!productId) throw new Error("Falha ao obter ID do produto");

      // B. Gerenciar os Complementos (Aqui é o pulo do gato!)
      // Se houver complementos para salvar
      if (product.complements) {
        
        // 1. Limpa relações antigas desse produto (estratégia simples: remove vínculos e recria)
        // Nota: Isso não deleta os grupos, apenas desvincula do produto atual para revincular corretamente.
        await supabase.from('product_complements').delete().eq('product_id', productId);

        for (const group of product.complements) {
          let groupId = group.id;

          // Se for grupo NOVO (ID temporário do React)
          if (groupId.startsWith('new_') || groupId.startsWith('imported_')) {
            const { data: newGroup } = await supabase.from('complement_groups').insert({
              name: group.name,
              min_selection: group.min,
              max_selection: group.max
            }).select().single();
            
            if (newGroup) groupId = newGroup.id;
          } else {
            // Se for grupo EXISTENTE, atualiza os dados dele
            await supabase.from('complement_groups').update({
              name: group.name,
              min_selection: group.min,
              max_selection: group.max
            }).eq('id', groupId);
          }

          // 2. Vincula Produto <-> Grupo
          await supabase.from('product_complements').insert({
            product_id: productId,
            group_id: groupId
          });

          // 3. Salva as Opções do Grupo
          // Remove opções antigas desse grupo (cuidado: se o grupo for compartilhado, isso afeta outros produtos. 
          // Assumindo uso exclusivo ou edição consciente).
          // Para segurança, deletamos e recriamos as opções.
          await supabase.from('complement_options').delete().eq('group_id', groupId);

          const optionsPayload = group.options.map(opt => ({
            group_id: groupId,
            name: opt.name,
            price: opt.price
          }));

          if (optionsPayload.length > 0) {
            await supabase.from('complement_options').insert(optionsPayload);
          }
        }
      }

      await fetchData(); // Recarrega tudo atualizado
      return { success: true };

    } catch (error) {
      console.error('Erro crítico ao salvar:', error);
      alert('Erro ao salvar. Veja o console.');
      return { success: false };
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Tem certeza?')) return;
    // O banco deve ter CASCADE configurado, mas por via das dúvidas:
    await supabase.from('product_complements').delete().eq('product_id', id);
    await supabase.from('products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  return {
    products,
    categories,
    saveProduct,
    deleteProduct,
    isLoading,
    fetchData
  };
}
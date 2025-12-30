// src/hooks/useProducts.ts (COM ORDENAÇÃO)
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { Product, Category, ComplementGroup } from '@/types/product'; 

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const isMounted = useRef(true);

  const fetchData = useCallback(async (isBackgroundUpdate = false) => {
    try {
      if (!isBackgroundUpdate) setIsLoading(true);

      const [categoriesResponse, productsResponse] = await Promise.all([
        // 🔥 ORDENA POR 'order' AGORA (ASCENDENTE = menor primeiro)
        supabase
          .from('categories')
          .select('*')
          .order('order', { ascending: true })
          .order('created_at', { ascending: true }), // Fallback se order for igual
        
        supabase
          .from('products')
          .select(`
            *,
            product_complements (
              complement_groups (
                id,
                name,
                min_selection,
                max_selection,
                complement_options ( id, name, price, is_active )
              )
            )
          `)
          .order('order', { ascending: true }) // 🔥 ORDENA PRODUTOS TAMBÉM
          .order('created_at', { ascending: true }) // Fallback
      ]);

      if (categoriesResponse.error) throw categoriesResponse.error;
      if (productsResponse.error) throw productsResponse.error;

      if (!isMounted.current) return;

      setCategories((categoriesResponse.data as Category[]) || []);

      const formattedProducts: Product[] = (productsResponse.data || []).map((p: any) => {
        const uniqueGroupsMap = new Map();
        if (p.product_complements) {
          p.product_complements.forEach((pc: any) => {
            const group = pc.complement_groups;
            if (group && !uniqueGroupsMap.has(group.id)) {
              uniqueGroupsMap.set(group.id, {
                id: group.id,
                name: group.name,
                min: group.min_selection,
                max: group.max_selection,
                options: (group.complement_options || []).map((opt: any) => ({
                  id: opt.id,
                  name: opt.name,
                  price: opt.price,
                  active: opt.is_active !== false
                }))
              });
            }
          });
        }

        return {
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          image: p.image_url || p.image,
          active: p.active !== false,
          categoryId: p.category_id, 
          category_id: p.category_id,
          order: p.order || 0, // 🔥 INCLUI ORDER
          complements: Array.from(uniqueGroupsMap.values()) as ComplementGroup[]
        };
      });

      setProducts(formattedProducts);

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      if (isMounted.current && !isBackgroundUpdate) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchData(false);

    const intervalId = setInterval(() => {
      fetchData(true); 
    }, 15000); 

    return () => {
      isMounted.current = false;
      clearInterval(intervalId);
    };
  }, [fetchData]);

  // 🔥 REORDENAR CATEGORIAS (CORRIGIDO)
  async function reorderCategories(newOrder: Category[]) {
    try {
      console.log('📋 Reordenando categorias...', newOrder);
      
      // 🔥 ENVIA APENAS id E order (nada mais!)
      const updates = newOrder.map((cat, index) => ({
        id: cat.id,
        order: index
      }));

      console.log('📤 Payload:', updates);

      // 🔥 USA UPDATE EM VEZ DE UPSERT (mais seguro)
      for (const update of updates) {
        const { error } = await supabase
          .from('categories')
          .update({ order: update.order })
          .eq('id', update.id);

        if (error) {
          console.error('❌ Erro ao atualizar categoria:', update.id, error);
          throw error;
        }
      }

      // Atualiza o estado local
      setCategories(newOrder);
      console.log('✅ Categorias reordenadas com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao reordenar categorias:', error);
      alert('Erro ao reordenar categorias. Veja o console para detalhes.');
    }
  }

  // 🔥 REORDENAR PRODUTOS (CORRIGIDO)
  async function reorderProducts(newOrder: Product[]) {
    try {
      console.log('📋 Reordenando produtos...', newOrder);
      
      // 🔥 ENVIA APENAS id E order (nada mais!)
      const updates = newOrder.map((prod, index) => ({
        id: prod.id,
        order: index
      }));

      console.log('📤 Payload:', updates);

      // 🔥 USA UPDATE EM VEZ DE UPSERT (mais seguro)
      for (const update of updates) {
        const { error } = await supabase
          .from('products')
          .update({ order: update.order })
          .eq('id', update.id);

        if (error) {
          console.error('❌ Erro ao atualizar produto:', update.id, error);
          throw error;
        }
      }

      // Atualiza o estado local
      setProducts(newOrder);
      console.log('✅ Produtos reordenados com sucesso!');
      
      // Recarrega para garantir sincronia
      setTimeout(() => fetchData(true), 500);
    } catch (error) {
      console.error('❌ Erro ao reordenar produtos:', error);
      alert('Erro ao reordenar produtos. Veja o console para detalhes.');
    }
  }

  async function addCategory(name: string) {
    try {
      const maxOrder = categories.length > 0 
        ? Math.max(...categories.map(c => (c as any).order || 0)) 
        : 0;
      
      await supabase.from('categories').insert({ name, order: maxOrder + 1 });
      fetchData(true);
    } catch (error) { console.error(error); }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Tem certeza?')) return;
    try {
      await supabase.from('categories').delete().eq('id', id);
      if (activeCategory === id) setActiveCategory('all');
      fetchData(true);
    } catch (error) { console.error(error); }
  }

  async function toggleProductActive(id: string, currentStatus: boolean) {
    try {
      console.log('🔄 Toggle iniciado:', { id, currentStatus });
      const newStatus = !currentStatus;
      
      const { error } = await supabase
        .from('products')
        .update({ active: newStatus })
        .eq('id', id);

      if (error) {
        console.error('❌ Erro no Supabase:', error);
        throw error;
      }

      console.log('✅ Supabase atualizado com sucesso');

      setProducts(prev => prev.map(p => 
        p.id === id ? { ...p, active: newStatus } : p
      ));

      console.log(`✅ Produto ${newStatus ? 'ativado' : 'pausado'}`);
      
      setTimeout(() => fetchData(true), 500);
    } catch (error) {
      console.error('❌ Erro ao toggle active:', error);
      alert('Erro ao atualizar status do produto');
    }
  }

  async function saveProduct(product: Partial<Product>) {
    try {
      const catId = product.category_id || product.categoryId;
      const productPayload = {
        name: product.name,
        description: product.description,
        price: product.price,
        image_url: product.image,
        category_id: catId,
        active: product.active !== undefined ? product.active : true,
        order: product.order || 0
      };

      let productId = product.id;

      if (productId) {
        const { error } = await supabase.from('products').update(productPayload).eq('id', productId);
        if (error) throw error;
      } else {
        const maxOrder = products.length > 0 
          ? Math.max(...products.map(p => (p as any).order || 0)) 
          : 0;
        
        const { data, error } = await supabase.from('products').insert({
          ...productPayload,
          order: maxOrder + 1
        }).select().single();
        
        if (error) throw error;
        productId = data?.id;
      }

      if (productId && product.complements) {
        const { error: deleteError } = await supabase
          .from('product_complements')
          .delete()
          .eq('product_id', productId);
          
        if (deleteError) throw deleteError;

        const uniquePayloadGroups = new Map();
        product.complements.forEach(g => uniquePayloadGroups.set(g.id, g));
        const cleanGroups = Array.from(uniquePayloadGroups.values());

        for (const group of cleanGroups) {
          let groupId = group.id;

          const groupPayload = {
            name: group.name,
            min_selection: group.min,
            max_selection: group.max
          };

          if (groupId.toString().startsWith('new_') || groupId.toString().startsWith('imported_')) {
            const { data: newGroup } = await supabase.from('complement_groups')
              .insert(groupPayload)
              .select()
              .single();
            if (newGroup) groupId = newGroup.id;
          } else {
             await supabase.from('complement_groups')
               .update(groupPayload)
               .eq('id', groupId);
          }

          await supabase.from('product_complements').insert({
            product_id: productId,
            group_id: groupId
          });

          await supabase.from('complement_options').delete().eq('group_id', groupId);
          
          const opts = group.options.map((o: any) => ({
            group_id: groupId,
            name: o.name,
            price: o.price,
            max_quantity: 1,
            is_active: o.active !== false
          }));

          if (opts.length > 0) {
            await supabase.from('complement_options').insert(opts);
          }
        }
      }

      fetchData(true);
      return { success: true };
    } catch (error) {
      console.error('Erro crítico ao salvar:', error);
      return { success: false };
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Tem certeza?')) return;
    try {
      await supabase.from('product_complements').delete().eq('product_id', id);
      await supabase.from('products').delete().eq('id', id);
      fetchData(true);
    } catch (error) { console.error(error); }
  }

  return {
    products, 
    categories, 
    activeCategory, 
    setActiveCategory,
    saveProduct, 
    deleteProduct, 
    addCategory, 
    deleteCategory,
    toggleProductActive,
    reorderCategories, // 🔥 NOVA FUNÇÃO
    reorderProducts,   // 🔥 NOVA FUNÇÃO
    isLoading, 
    fetchData
  };
}
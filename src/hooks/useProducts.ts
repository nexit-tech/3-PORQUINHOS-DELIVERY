import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { Product, Category, ComplementGroup } from '@/types/product'; 

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Ref para controlar se o componente está montado
  const isMounted = useRef(true);

  // --- BUSCA DE DADOS (COM LIMPEZA DE DUPLICATAS) ---
  const fetchData = useCallback(async (isBackgroundUpdate = false) => {
    try {
      if (!isBackgroundUpdate) setIsLoading(true);

      const [categoriesResponse, productsResponse] = await Promise.all([
        supabase.from('categories').select('*').order('created_at', { ascending: true }),
        supabase.from('products').select(`
            *,
            product_complements (
              complement_groups (
                id,
                name,
                min_selection,
                max_selection,
                complement_options ( id, name, price )
              )
            )
          `).order('created_at', { ascending: false })
      ]);

      if (categoriesResponse.error) throw categoriesResponse.error;
      if (productsResponse.error) throw productsResponse.error;

      if (!isMounted.current) return;

      setCategories((categoriesResponse.data as Category[]) || []);

      // MAPPER + SANITIZAÇÃO (REMOVE DUPLICATAS NA LEITURA)
      const formattedProducts: Product[] = (productsResponse.data || []).map((p: any) => {
        
        // Lógica para limpar duplicatas que vieram do banco sujo
        const uniqueGroupsMap = new Map();
        if (p.product_complements) {
          p.product_complements.forEach((pc: any) => {
            const group = pc.complement_groups;
            // Se o grupo existe e ainda não foi processado, adiciona
            if (group && !uniqueGroupsMap.has(group.id)) {
              uniqueGroupsMap.set(group.id, {
                id: group.id,
                name: group.name,
                min: group.min_selection,
                max: group.max_selection,
                options: group.complement_options || []
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
          active: p.active,
          categoryId: p.category_id, 
          category_id: p.category_id,
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

  // --- EFEITO: LOAD + POLLING ---
  useEffect(() => {
    isMounted.current = true;
    fetchData(false);

    const intervalId = setInterval(() => {
      // Polling silencioso
      fetchData(true); 
    }, 15000); 

    return () => {
      isMounted.current = false;
      clearInterval(intervalId);
    };
  }, [fetchData]);

  // --- ACTIONS ---

  async function addCategory(name: string) {
    try {
      await supabase.from('categories').insert({ name });
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

  // --- SALVAMENTO BLINDADO ---
  async function saveProduct(product: Partial<Product>) {
    try {
      const catId = product.category_id || product.categoryId;
      const productPayload = {
        name: product.name,
        description: product.description,
        price: product.price,
        image_url: product.image,
        category_id: catId,
        active: product.active !== undefined ? product.active : true
      };

      let productId = product.id;

      // 1. Salva ou Cria Produto Base
      if (productId) {
        const { error } = await supabase.from('products').update(productPayload).eq('id', productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('products').insert(productPayload).select().single();
        if (error) throw error;
        productId = data?.id;
      }

      // 2. Processa Complementos (Se houver ID de produto)
      if (productId && product.complements) {
        
        // PASSO A: Limpa vínculos antigos (Reset Total)
        // Isso impede a "multiplicação". Removemos tudo antes de por o novo.
        const { error: deleteError } = await supabase
          .from('product_complements')
          .delete()
          .eq('product_id', productId);
          
        if (deleteError) {
          console.error("Erro ao limpar vínculos antigos:", deleteError);
          throw deleteError;
        }

        // PASSO B: Deduplica a lista que veio do frontend
        const uniquePayloadGroups = new Map();
        product.complements.forEach(g => uniquePayloadGroups.set(g.id, g)); // ID é a chave única
        const cleanGroups = Array.from(uniquePayloadGroups.values());

        // PASSO C: Insere um por um
        for (const group of cleanGroups) {
          let groupId = group.id;

          const groupPayload = {
            name: group.name,
            min_selection: group.min,
            max_selection: group.max
          };

          // C.1 - Cria ou Atualiza o Grupo na tabela Mestra
          if (groupId.toString().startsWith('new_') || groupId.toString().startsWith('imported_')) {
            // Cria Novo
            const { data: newGroup } = await supabase.from('complement_groups')
              .insert(groupPayload)
              .select()
              .single();
            if (newGroup) groupId = newGroup.id;
          } else {
             // Atualiza Existente
             await supabase.from('complement_groups')
               .update(groupPayload)
               .eq('id', groupId);
          }

          // C.2 - Cria o Vínculo (Agora seguro pois limpamos no Passo A)
          await supabase.from('product_complements').insert({
            product_id: productId,
            group_id: groupId
          });

          // C.3 - Atualiza Opções (Delete All + Insert)
          await supabase.from('complement_options').delete().eq('group_id', groupId);
          
          // CORREÇÃO AQUI: Adicionado ': any' para o TypeScript não reclamar
          const opts = group.options.map((o: any) => ({
            group_id: groupId,
            name: o.name,
            price: o.price,
            max_quantity: 1,
            is_active: true
          }));

          if (opts.length > 0) {
            await supabase.from('complement_options').insert(opts);
          }
        }
      }

      fetchData(true); // Atualiza UI
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
    products, categories, activeCategory, setActiveCategory,
    saveProduct, deleteProduct, addCategory, deleteCategory, isLoading, fetchData
  };
}
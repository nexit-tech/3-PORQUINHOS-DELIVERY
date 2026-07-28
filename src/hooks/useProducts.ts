// src/hooks/useProducts.ts (COM ORDENAÇÃO)
import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
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

    // Antes: SELECT com join aninhado (produtos + grupos + opções) a cada 15s,
    // em toda página que usa o hook — inclusive no cardápio de cada cliente.
    // Agora só recarrega quando algo realmente muda, com um refresh lento
    // como rede de segurança caso o websocket caia.
    let debounce: ReturnType<typeof setTimeout>;
    const scheduleRefresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => fetchData(true), 400);
    };

    const channel = supabase
      .channel('catalog-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, scheduleRefresh)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complement_options' },
        scheduleRefresh
      )
      .subscribe();

    const fallback = setInterval(() => fetchData(true), 5 * 60_000);

    return () => {
      isMounted.current = false;
      clearTimeout(debounce);
      clearInterval(fallback);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  /** Grava `order` sequencial, mandando só as linhas que realmente mudaram. */
  async function persistOrder<T extends { id: string; order?: number }>(
    table: 'products' | 'categories',
    list: T[]
  ) {
    const changed = list
      .map((item, index) => ({ id: item.id, order: index, previous: item.order ?? 0 }))
      .filter((item) => item.previous !== item.order);

    for (const item of changed) {
      const { error } = await supabase
        .from(table)
        .update({ order: item.order })
        .eq('id', item.id);

      if (error) {
        console.error(`❌ Erro ao atualizar ${table}:`, item.id, error);
        throw error;
      }
    }
  }

  async function reorderCategories(newOrder: Category[]) {
    try {
      await persistOrder('categories', newOrder);
      setCategories(newOrder);
      toast.success('Categorias reordenadas!');
    } catch (error) {
      console.error('❌ Erro ao reordenar categorias:', error);
      toast.error('Erro ao reordenar categorias.');
      fetchData(true);
    }
  }

  /**
   * Reordena produtos.
   *
   * `orderedSubset` é o que apareceu no modal — que pode ser só uma categoria,
   * ou só os ativos. O código antigo fazia setProducts(orderedSubset) e gravava
   * order 0..n nesse subset: os produtos filtrados sumiam do estado e o `order`
   * colidia com o de outras categorias, embaralhando o cardápio.
   *
   * Aqui o subset é encaixado de volta nas MESMAS posições que ocupava na lista
   * completa, e o `order` é reatribuído sobre a lista global inteira.
   */
  async function reorderProducts(orderedSubset: Product[]) {
    const subsetIds = new Set(orderedSubset.map((p) => p.id));

    // Índices que o subset ocupa hoje na lista completa
    const slots: number[] = [];
    products.forEach((p, index) => {
      if (subsetIds.has(p.id)) slots.push(index);
    });

    if (slots.length !== orderedSubset.length) {
      console.warn('Lista de produtos dessincronizada, recarregando antes de reordenar.');
      fetchData(true);
      return;
    }

    const merged = [...products];
    slots.forEach((slot, i) => {
      merged[slot] = orderedSubset[i];
    });

    // Otimista: a UI reflete a nova ordem antes do banco responder
    setProducts(merged);

    try {
      await persistOrder('products', merged);
      toast.success('Produtos reordenados!');
    } catch (error) {
      console.error('❌ Erro ao reordenar produtos:', error);
      toast.error('Erro ao reordenar produtos.');
    } finally {
      fetchData(true);
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
      // O erro do Supabase vem no retorno, não como exceção: sem checar,
      // uma falha de FK ou de RLS passava batida e o admin achava que
      // tinha apagado
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;

      if (activeCategory === id) setActiveCategory('all');
      toast.success('Categoria removida');
      fetchData(true);
    } catch (error: any) {
      console.error('Erro ao deletar categoria:', error);
      toast.error(error?.message || 'Não foi possível remover a categoria.');
    }
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
      toast.error('Erro ao atualizar status do produto');
      fetchData(true);
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

          // Opções: atualiza as que já existem, insere as novas e apaga só as
          // que foram removidas na tela.
          //
          // Antes isso era um DELETE de tudo seguido de INSERT, o que trocava
          // o id de TODAS as opções a cada save. Como o carrinho do cliente
          // fica guardado no localStorage, editar um produto invalidava os
          // ids que ele tinha escolhido — e o create_order, que confere as
          // opções pelo id, somava zero de adicional. O cliente pagava o
          // preço base sem os sabores, sem ninguém perceber.
          const isNewOption = (id: any) =>
            String(id).startsWith('new_') || String(id).startsWith('opt_');

          const keptOptions = group.options.filter((o: any) => !isNewOption(o.id));
          const newOptions = group.options.filter((o: any) => isNewOption(o.id));

          const { data: currentOptions } = await supabase
            .from('complement_options')
            .select('id')
            .eq('group_id', groupId);

          const keepIds = new Set(keptOptions.map((o: any) => String(o.id)));
          const removedIds = (currentOptions || [])
            .map((o: any) => String(o.id))
            .filter((id: string) => !keepIds.has(id));

          if (removedIds.length > 0) {
            await supabase.from('complement_options').delete().in('id', removedIds);
          }

          for (const option of keptOptions) {
            await supabase
              .from('complement_options')
              .update({
                name: option.name,
                price: option.price,
                is_active: option.active !== false,
              })
              .eq('id', option.id);
          }

          if (newOptions.length > 0) {
            await supabase.from('complement_options').insert(
              newOptions.map((o: any) => ({
                group_id: groupId,
                name: o.name,
                price: o.price,
                max_quantity: 1,
                is_active: o.active !== false,
              }))
            );
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

      const { error } = await supabase.from('products').delete().eq('id', id);

      // Produto com pedidos antigos costuma ter FK em order_items: o delete
      // falha. Antes o erro sumia no console e a tela não mudava, dando a
      // impressão de que o botão não funcionava. Nesse caso, pausar resolve.
      if (error) throw error;

      toast.success('Produto removido');
      fetchData(true);
    } catch (error: any) {
      console.error('Erro ao deletar produto:', error);
      toast.error(
        'Não foi possível excluir. Se o produto já tem pedidos, use "Pausar" em vez de excluir.'
      );
      fetchData(true);
    }
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
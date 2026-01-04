import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { Order, OrderStatus } from '@/types/order';

export function useOrders(onlyActive = true) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 🔥 CORREÇÃO: useRef para evitar loop infinito
  const onlyActiveRef = useRef(onlyActive);
  
  // Atualiza a ref quando onlyActive mudar
  useEffect(() => {
    onlyActiveRef.current = onlyActive;
  }, [onlyActive]);

  const fetchMyOrders = async () => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          items:order_items (
            id,
            product_name,
            quantity,
            unit_price,
            total_price,
            observation,
            customizations
          )
        `)
        .order('created_at', { ascending: false });

      // 🔥 CORREÇÃO: Busca por telefone OU por IDs salvos
      const storedIds = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem('my_orders') || '[]') 
        : [];
      
      const storedPhone = typeof window !== 'undefined'
        ? localStorage.getItem('customer_phone')
        : null;

      console.log('🔍 [useOrders] Buscando pedidos...');
      console.log('📱 Telefone salvo:', storedPhone);
      console.log('🆔 IDs salvos:', storedIds);

      // Se tem telefone salvo, busca por telefone (mais confiável)
      if (storedPhone) {
        console.log('✅ Buscando por telefone:', storedPhone);
        query = query.eq('customer_phone', storedPhone);
      } 
      // Se não tem telefone mas tem IDs, busca por IDs
      else if (storedIds.length > 0) {
        console.log('✅ Buscando por IDs:', storedIds);
        query = query.in('id', storedIds);
      }
      // Se não tem nada, retorna vazio
      else {
        console.log('⚠️ Nenhum telefone ou ID salvo. Lista vazia.');
        setOrders([]);
        setLoading(false);
        return;
      }

      // 🔥 CORREÇÃO: Usa a ref ao invés da prop diretamente
      if (onlyActiveRef.current) {
        query = query.not('status', 'in', '("COMPLETED","CANCELED")');
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar pedidos:', error);
        throw error;
      }

      console.log('📦 Pedidos encontrados:', data?.length || 0);

      // Mapeamento dos pedidos
      const formattedOrders: Order[] = (data || []).map((order: any) => ({
        id: order.id,
        displayId: `#${order.id}`,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        paymentMethod: order.payment_method,
        status: order.status.toUpperCase(), 
        total: order.total,
        deliveryFee: order.delivery_fee || 0,
        createdAt: new Date(order.created_at).toLocaleDateString('pt-BR'),
        updatedAt: order.updated_at,
        items: order.items.map((item: any) => ({
          id: item.id,
          name: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          observation: item.observation || '',
          customizations: item.customizations
        }))
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error('❌ Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  async function updateStatus(orderId: number | string, newStatus: OrderStatus) {
    try {
      const idStr = String(orderId).replace('#', '');
      const id = parseInt(idStr, 10);
      
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      await fetchMyOrders();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar o status do pedido.');
    }
  }

  // 🔥 CORREÇÃO: Removido useCallback e dependências problemáticas
  useEffect(() => {
    console.log('🔄 [useOrders] Iniciando polling...');
    setLoading(true);
    fetchMyOrders();
    
    const interval = setInterval(() => {
      console.log('🔄 [useOrders] Polling automático...');
      fetchMyOrders();
    }, 5000); 
    
    return () => {
      console.log('🛑 [useOrders] Parando polling');
      clearInterval(interval);
    };
  }, []); // 🔥 Array vazio - só roda uma vez

  return { orders, loading, refreshOrders: fetchMyOrders, updateStatus };
}
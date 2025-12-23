import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { Order, OrderStatus } from '@/types/order';

export function useOrders(onlyActive = true) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyOrders = useCallback(async () => {
    try {
      // Query corrigida para a estrutura do seu banco
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

      // Lógica de filtro por ID (se existir no localStorage do cliente)
      const storedIds = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('my_orders') || '[]') : [];
      if (storedIds.length > 0) {
         query = query.in('id', storedIds);
      }

      // Filtro de status ativos
      if (onlyActive) {
        query = query.not('status', 'in', '("COMPLETED","CANCELED")');
      }

      const { data, error } = await query;

      if (error) throw error;

      // Mapeamento correto: Banco (snake_case) -> Front (camelCase)
      const formattedOrders: Order[] = (data || []).map((order: any) => ({
        id: order.id,
        displayId: `#${order.id}`, // Exibe #123
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        paymentMethod: order.payment_method,
        status: order.status.toUpperCase(), 
        total: order.total,
        deliveryFee: order.delivery_fee || 0,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        items: order.items.map((item: any) => ({
          id: item.id,
          name: item.product_name, // Campo direto da tabela order_items
          quantity: item.quantity,
          unitPrice: item.unit_price, // Campo direto da tabela order_items
          totalPrice: item.total_price,
          observation: item.observation,
          customizations: item.customizations
        }))
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  async function updateStatus(orderId: number | string, newStatus: OrderStatus) {
    try {
      // Garante que o ID seja numérico para o banco (remove # se vier string)
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

  useEffect(() => {
    setLoading(true);
    fetchMyOrders();
    // Pooling de 5 segundos para atualizar a lista
    const interval = setInterval(fetchMyOrders, 5000); 
    return () => clearInterval(interval);
  }, [fetchMyOrders]);

  return { orders, loading, refreshOrders: fetchMyOrders, updateStatus };
}
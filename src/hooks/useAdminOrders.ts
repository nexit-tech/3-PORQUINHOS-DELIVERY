// src/hooks/useAdminOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { Order, OrderStatus } from '@/types/order';

export function useAdminOrders(autoRefresh = true) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      // 🔥 BUSCA TODOS OS PEDIDOS (sem filtro de cliente)
      const { data, error } = await supabase
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
        // 🔥 EXCLUI APENAS COMPLETED E CANCELED
        .not('status', 'in', '("COMPLETED","CANCELED")')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedOrders: Order[] = (data || []).map((order: any) => ({
        id: order.id,
        displayId: `#${order.id}`,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        paymentMethod: order.payment_method,
        status: order.status.toUpperCase() as OrderStatus,
        total: Number(order.total),
        deliveryFee: Number(order.delivery_fee || 0),
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        items: (order.items || []).map((item: any) => ({
          id: item.id,
          name: item.product_name,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          totalPrice: Number(item.total_price),
          observation: item.observation || '',
          customizations: item.customizations || {}
        }))
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error('❌ Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = async (orderId: number | string, newStatus: OrderStatus) => {
    try {
      const idStr = String(orderId).replace('#', '');
      const id = parseInt(idStr, 10);

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Atualiza localmente
      setOrders(prev => 
        prev.map(order => 
          order.id === id 
            ? { ...order, status: newStatus, updatedAt: new Date().toISOString() }
            : order
        )
      );

      // Recarrega do banco
      await fetchOrders();
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchOrders();

    if (autoRefresh) {
      const interval = setInterval(fetchOrders, 5000); // Atualiza a cada 5s
      return () => clearInterval(interval);
    }
  }, [fetchOrders, autoRefresh]);

  return { orders, loading, refreshOrders: fetchOrders, updateStatus };
}
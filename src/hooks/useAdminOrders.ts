// src/hooks/useAdminOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { Order, OrderStatus } from '@/types/order';

export function useAdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
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
      // Não precisamos atualizar 'setOrders' aqui manualmente se o Realtime for rápido,
      // mas manter localmente garante UI responsiva instantânea (Optimistic Update)
      setOrders(prev => 
        prev.map(order => 
          order.id === id 
            ? { ...order, status: newStatus, updatedAt: new Date().toISOString() }
            : order
        )
      );
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchOrders();

    // 🔥 REALTIME: Escuta mudanças na tabela 'orders'
    const channel = supabase
      .channel('admin-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('🔔 Mudança detectada nos pedidos:', payload);
          // Pequeno delay para garantir que relações (items) foram gravadas
          setTimeout(() => fetchOrders(), 500); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  return { orders, loading, refreshOrders: fetchOrders, updateStatus };
}
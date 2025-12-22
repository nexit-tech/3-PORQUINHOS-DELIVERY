import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { Order, OrderStatus } from '@/types/order';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyOrders = useCallback(async () => {
    try {
      // 1. Lê os IDs salvos no celular
      const storedIds = JSON.parse(localStorage.getItem('my_orders') || '[]');
      
      if (storedIds.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // 2. Busca os pedidos no banco
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items (
            product_name, 
            quantity,
            observation
          )
        `)
        .in('id', storedIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 3. FILTRO MÁGICO: Remove os Cancelados e Finalizados da lista visual
      const activeOrders = (data || []).filter((order: any) => {
        return order.status !== 'CANCELED' && order.status !== 'COMPLETED';
      });

      // 4. Formata para exibir
      const formattedOrders: Order[] = activeOrders.map((order: any) => ({
        id: `#${order.id}`,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        paymentMethod: order.payment_method,
        status: order.status,
        total: order.total,
        deliveryFee: order.delivery_fee,
        createdAt: new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        items: order.items.map((item: any) => ({
          name: item.product_name, 
          quantity: item.quantity,
          observation: item.observation
        }))
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Erro ao buscar meus pedidos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchMyOrders();
    
    // Atualiza a cada 5 segundos para verificar se o status mudou para "COMPLETED" ou "CANCELED"
    const interval = setInterval(fetchMyOrders, 5000); 
    return () => clearInterval(interval);
  }, [fetchMyOrders]);

  return { orders, loading, refreshOrders: fetchMyOrders };
}
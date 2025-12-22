import { useState, useEffect } from 'react';
import { Order, OrderStatus } from '@/types/order';
import { supabase } from '@/services/supabase';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Função para buscar pedidos
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items (
            id,
            product_name, 
            quantity,
            observation,
            unit_price
          )
        `)
        .order('created_at', { ascending: false }); // Mais recentes primeiro

      if (error) throw error;

      // Formatação para bater com a interface Order
      const formattedOrders: Order[] = (data || []).map((order: any) => ({
        id: `#${order.id}`, // Adiciona o # visualmente
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        paymentMethod: order.payment_method,
        status: order.status,
        total: order.total,
        deliveryFee: order.delivery_fee,
        createdAt: new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        items: order.items.map((item: any) => ({
          id: item.id,
          name: item.product_name, // Usamos o nome salvo no item para garantir histórico
          quantity: item.quantity,
          observation: item.observation
        }))
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // (Opcional) Aqui poderíamos adicionar um Subscribe do Supabase para atualizar em Tempo Real!
    // Mas por enquanto, vamos manter o fetch simples.
  }, []);

  const updateStatus = async (idStr: string, newStatus: OrderStatus) => {
    try {
      // Remove o '#' para pegar o ID numérico real do banco
      const numericId = idStr.replace('#', '');

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', numericId);

      if (error) throw error;

      // Atualiza o estado localmente para refletir na hora
      setOrders(prev => prev.map(order => 
        order.id === idStr ? { ...order, status: newStatus } : order
      ));

    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do pedido');
    }
  };

  return { orders, updateStatus, loading, refreshOrders: fetchOrders };
}
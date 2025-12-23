import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { Order, OrderStatus } from '@/types/order';

// O parâmetro 'onlyActive' define se escondemos os finalizados/cancelados (Padrão: SIM)
export function useOrders(onlyActive = true) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // --- BUSCAR PEDIDOS ---
  const fetchMyOrders = useCallback(async () => {
    try {
      // Tenta pegar IDs do localStorage (Cliente) OU busca tudo se for Admin (lógica mista)
      // Se a sua Home (Admin) não usa localStorage, ela vai depender da query direta.
      // Vou assumir que o Admin lista tudo que está no banco (filtrado por status) 
      // ou usa os IDs se existirem. Para garantir que o Admin funcione:
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          items:order_items (
            product_name, 
            quantity,
            observation
          )
        `)
        .order('created_at', { ascending: false });

      // Se for cliente (tem IDs salvos), filtramos pelos IDs. 
      // Se for Admin (sem IDs salvos), trazemos tudo (respeitando o filtro de status abaixo).
      const storedIds = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('my_orders') || '[]') : [];
      if (storedIds.length > 0) {
         query = query.in('id', storedIds);
      }

      // FILTRO: Esconde Finalizados e Cancelados se solicitado (Padrão da Cozinha e Cliente)
      if (onlyActive) {
        query = query.not('status', 'in', '("COMPLETED","CANCELED")');
      }

      const { data, error } = await query;

      if (error) throw error;

      // Formata para o Front
      const formattedOrders: Order[] = (data || []).map((order: any) => ({
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
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  // --- ATUALIZAR STATUS (A FUNÇÃO QUE FALTAVA) ---
  async function updateStatus(orderId: string, newStatus: OrderStatus) {
    try {
      // Remove o '#' para enviar ao banco (Ex: "#10" vira "10")
      const id = orderId.replace('#', '');
      
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      // Atualiza a lista imediatamente
      await fetchMyOrders();
      
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar o status do pedido.');
    }
  }

  // --- EFEITOS ---
  useEffect(() => {
    setLoading(true);
    fetchMyOrders();
    const interval = setInterval(fetchMyOrders, 5000); 
    return () => clearInterval(interval);
  }, [fetchMyOrders]);

  // Retorna tudo que a página precisa
  return { orders, loading, refreshOrders: fetchMyOrders, updateStatus };
}
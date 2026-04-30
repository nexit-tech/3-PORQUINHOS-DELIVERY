// src/hooks/useAdminOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { Order, OrderStatus } from '@/types/order';
import { printReceipt } from '@/utils/printReceipt';
import { 
  notifyOrderAccepted, 
  notifyOrderDelivering, 
  notifyOrderCanceled 
} from '@/services/notifications';

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
            id, product_name, quantity, unit_price, total_price, observation, customizations
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
      
      setOrders(prev => 
        prev.map(order => order.id === id ? { ...order, status: newStatus, updatedAt: new Date().toISOString() } : order)
      );
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('admin-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async (payload) => {
          console.log('🔔 Mudança detectada nos pedidos:', payload);
          setTimeout(() => fetchOrders(), 500); 

          // 🔥 CORREÇÃO TYPESCRIPT: Avisar que o formato que vem do supabase é "any" para não dar erro
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;

          // Agora podemos acessar sem o typescript gritar
          const newStatus = newRecord?.status;
          const oldStatus = oldRecord?.status;
          const newId = newRecord?.id;

          // Se acabou de mudar de status ou inserido já com um status novo
          if (newStatus && newStatus !== oldStatus && newId) {
            
            // Busca o pedido completinho no banco para ter os itens para imprimir e notificar
            const { data: fullOrder } = await supabase
              .from('orders')
              .select('*, items:order_items(*)')
              .eq('id', newId)
              .single();

            if (fullOrder) {
              const formattedOrder: Order = {
                id: fullOrder.id,
                displayId: `#${fullOrder.id}`,
                customerName: fullOrder.customer_name,
                customerPhone: fullOrder.customer_phone,
                customerAddress: fullOrder.customer_address,
                paymentMethod: fullOrder.payment_method,
                status: fullOrder.status as OrderStatus,
                total: Number(fullOrder.total),
                deliveryFee: Number(fullOrder.delivery_fee || 0),
                createdAt: fullOrder.created_at,
                updatedAt: fullOrder.updated_at,
                items: fullOrder.items.map((i: any) => ({
                  id: i.id, name: i.product_name, quantity: i.quantity,
                  unitPrice: Number(i.unit_price), totalPrice: Number(i.total_price),
                  observation: i.observation || '', customizations: i.customizations || {}
                }))
              };

              // 🎯 DISPAROS GLOBAIS: Funciona não importa quem alterou o banco!
              if (newStatus === 'PREPARING') {
                console.log('✅ Pedido Aceito (Bot ou Manual). Notificando e Imprimindo...');
                await notifyOrderAccepted(formattedOrder);

                const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'printer').single();
                if (settingsData?.value?.printerName) {
                  await printReceipt(formattedOrder, settingsData.value, 1);
                }
              } else if (newStatus === 'DELIVERING') {
                await notifyOrderDelivering(formattedOrder);
              } else if (newStatus === 'CANCELED' || newStatus === 'REJECTED') {
                await notifyOrderCanceled(formattedOrder);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  return { orders, loading, refreshOrders: fetchOrders, updateStatus };
}
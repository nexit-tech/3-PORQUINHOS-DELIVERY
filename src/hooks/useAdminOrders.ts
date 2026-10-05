// src/hooks/useAdminOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { Order, OrderStatus } from '@/types/order';
import { printReceipt } from '@/utils/printReceipt';
import { loadPrinterSettings, shouldAutoPrint } from '@/lib/printerSettings';

function mapOrder(raw: any): Order {
  return {
    id: raw.id,
    displayId: `#${raw.id}`,
    customerName: raw.customer_name,
    customerPhone: raw.customer_phone,
    customerAddress: raw.customer_address,
    paymentMethod: raw.payment_method,
    status: String(raw.status).toUpperCase() as OrderStatus,
    subtotal: Number(raw.subtotal ?? Number(raw.total) - Number(raw.delivery_fee || 0)),
    total: Number(raw.total),
    deliveryFee: Number(raw.delivery_fee || 0),
    discount: Number(raw.discount || 0),
    couponCode: raw.coupon_code || null,
    paymentStatus: raw.payment_status || 'ON_DELIVERY',
    paymentReceiptUrl: raw.payment_receipt_url || null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    items: (raw.items || []).map((item: any) => ({
      id: item.id,
      name: item.product_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      totalPrice: Number(item.total_price),
      observation: item.observation || '',
      customizations: item.customizations || {},
    })),
  };
}

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
        // Pedido de pagamento online que ainda não pagou NÃO É PEDIDO.
        // É carrinho no meio do checkout: não pode aparecer para a cozinha,
        // senão a loja produz comida que ninguém pagou.
        .not('payment_status', 'in', '("AWAITING","EXPIRED","FAILED")')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders((data || []).map(mapOrder));
    } catch (error) {
      console.error('❌ Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // useCallback para a identidade da função ser estável: ela entra nas
  // dependências do efeito de aceite automático lá no dashboard
  const updateStatus = useCallback(async (orderId: number | string, newStatus: OrderStatus) => {
    try {
      const id = parseInt(String(orderId).replace('#', ''), 10);

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          order.id === id
            ? { ...order, status: newStatus, updatedAt: new Date().toISOString() }
            : order
        )
      );
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      throw error;
    }
  }, []);

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

          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;

          const newStatus = newRecord?.status ? String(newRecord.status).toUpperCase() : null;
          const oldStatus = oldRecord?.status ? String(oldRecord.status).toUpperCase() : null;
          const newId = newRecord?.id;

          if (!newStatus || !newId || newStatus === oldStatus) return;

          // A mensagem de WhatsApp para o cliente NÃO sai mais daqui: quem
          // envia é o servidor (src/lib/whatsapp/notificador.ts), que não
          // depende de painel aberto. Aqui sobrou só a impressão automática,
          // que é decisão de cada máquina.
          if (newStatus !== 'PREPARING' || !shouldAutoPrint()) return;

          // Pedido que nunca foi pago não vai para a impressora
          const paymentStatus = String(newRecord?.payment_status ?? 'ON_DELIVERY');
          if (['AWAITING', 'EXPIRED', 'FAILED'].includes(paymentStatus)) return;

          const { data: fullOrder } = await supabase
            .from('orders')
            .select('*, items:order_items(*)')
            .eq('id', newId)
            .single();

          if (!fullOrder) return;

          try {
            await printReceipt(mapOrder(fullOrder), loadPrinterSettings(), 1);
          } catch (error) {
            console.error('❌ Erro ao imprimir automaticamente:', error);
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

// src/hooks/useAdminOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { Order, OrderStatus } from '@/types/order';
import { printReceipt } from '@/utils/printReceipt';
import { loadPrinterSettings, shouldAutoPrint } from '@/lib/printerSettings';
import {
  notifyOrderAccepted,
  notifyOrderDelivering,
  notifyOrderCanceled,
} from '@/services/notifications';

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

/**
 * Tenta "reservar" o envio da notificação deste pedido/status.
 *
 * O listener realtime roda em TODO painel aberto, então sem isso o cliente
 * recebia uma mensagem de WhatsApp por aba/máquina aberta. A reserva é uma
 * linha com chave primária (order_id, status): só o primeiro consegue inserir.
 *
 * Se a tabela ainda não existir (SQL não rodado), segue em frente — melhor
 * duplicar do que deixar o cliente sem aviso nenhum.
 */
async function claimNotification(orderId: number, status: string): Promise<boolean> {
  const { error } = await supabase
    .from('order_notifications')
    .insert({ order_id: orderId, status });

  if (!error) return true;

  // 23505 = unique_violation: outro painel já enviou
  if ((error as any).code === '23505') {
    console.log(`↩️ Notificação de ${status} do pedido ${orderId} já foi enviada por outro painel.`);
    return false;
  }

  console.warn(
    '⚠️ Não consegui reservar a notificação (a tabela order_notifications existe?). Seguindo sem proteção contra duplicata:',
    error
  );
  return true;
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

          // Pedido que nunca foi pago não gera notificação nem impressão.
          //
          // Sem isto, todo carrinho abandonado no checkout online virava
          // CANCELED na expiração e disparava "Seu pedido foi CANCELADO"
          // no WhatsApp de alguém que nunca fechou pedido. Como o telefone
          // é digitado sem verificação, isso vira relay: qualquer um cria
          // pedido com o número da vítima, não paga, e espera a loja
          // mandar mensagem por ele.
          const paymentStatus = String(newRecord?.payment_status ?? 'ON_DELIVERY');
          if (['AWAITING', 'EXPIRED', 'FAILED'].includes(paymentStatus)) {
            console.log(`↩️ Pedido ${newId} sem pagamento confirmado: sem notificação.`);
            return;
          }

          const isNotifiable =
            newStatus === 'PREPARING' || newStatus === 'DELIVERING' || newStatus === 'CANCELED';
          const wantsPrint = newStatus === 'PREPARING' && shouldAutoPrint();

          if (!isNotifiable && !wantsPrint) return;

          const { data: fullOrder } = await supabase
            .from('orders')
            .select('*, items:order_items(*)')
            .eq('id', newId)
            .single();

          if (!fullOrder) return;

          const order = mapOrder(fullOrder);

          // IMPRESSÃO: decisão local. Só imprime a máquina que tem impressora
          // configurada e o aceite automático de impressão ligado.
          if (wantsPrint) {
            try {
              await printReceipt(order, loadPrinterSettings(), 1);
            } catch (error) {
              console.error('❌ Erro ao imprimir automaticamente:', error);
            }
          }

          // NOTIFICAÇÃO: uma vez só, não importa quantos painéis estejam abertos.
          if (!isNotifiable) return;
          if (!(await claimNotification(newId, newStatus))) return;

          if (newStatus === 'PREPARING') {
            await notifyOrderAccepted(order);
          } else if (newStatus === 'DELIVERING') {
            await notifyOrderDelivering(order);
          } else if (newStatus === 'CANCELED') {
            await notifyOrderCanceled(order);
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

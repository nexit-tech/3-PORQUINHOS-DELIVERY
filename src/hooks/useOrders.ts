// src/hooks/useOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { Order, OrderStatus, PaymentStatus } from '@/types/order';
import { STORE_TZ } from '@/lib/storeHours';

export function useOrders(onlyActive = true) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyOrders = useCallback(async () => {
    try {
      const storedPhone =
        typeof window !== 'undefined' ? localStorage.getItem('customer_phone') : null;

      if (!storedPhone) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Via RPC, não SELECT direto: com a RLS ligada o anônimo não lista a
      // tabela `orders`. Antes qualquer visitante baixava nome, telefone e
      // endereço de todos os clientes da loja.
      const { data, error } = await supabase.rpc('get_orders_by_phone', {
        p_phone: storedPhone,
        p_only_active: onlyActive,
      });

      if (error) throw error;

      const formattedOrders: Order[] = (data || []).map((order: any) => ({
        id: order.id,
        displayId: `#${order.id}`,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        paymentMethod: order.payment_method,
        status: String(order.status).toUpperCase() as OrderStatus,
        // Sem isto o cliente via um pedido AWAITING como "Aguardando
        // confirmação", igualzinho a um pedido que a loja já recebeu — e
        // ficava esperando pizza que ninguém ia fazer
        paymentStatus: (order.payment_status || 'ON_DELIVERY') as PaymentStatus,
        subtotal: Number(order.subtotal ?? 0),
        total: Number(order.total),
        deliveryFee: Number(order.delivery_fee || 0),
        discount: Number(order.discount || 0),
        couponCode: order.coupon_code || null,
        createdAt: new Date(order.created_at).toLocaleDateString('pt-BR', { timeZone: STORE_TZ }),
        updatedAt: order.updated_at,
        items: (order.items || []).map((item: any) => ({
          id: item.id,
          name: item.product_name,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          totalPrice: Number(item.total_price),
          observation: item.observation || '',
        })),
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  useEffect(() => {
    setLoading(true);
    fetchMyOrders();

    // ATENÇÃO: aqui o polling não é preguiça, é necessidade.
    //
    // O Realtime do Supabase respeita RLS. Depois de aplicar a 04, o papel
    // `anon` não tem política de SELECT em `orders` (de propósito: era assim
    // que dava para baixar a base inteira de clientes). Consequência: o
    // cliente NÃO recebe mais os eventos de postgres_changes, e a tela de
    // "Meus Pedidos" ficaria congelada em "Aguardando confirmação" para
    // sempre. Quem busca o status é este intervalo, via RPC.
    const interval = setInterval(fetchMyOrders, 20_000);

    // Revalida quando o cliente volta para a aba, para não esperar o tick
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchMyOrders();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchMyOrders]);

  return { orders, loading, refreshOrders: fetchMyOrders };
}

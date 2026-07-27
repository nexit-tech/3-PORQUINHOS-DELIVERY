// src/hooks/useOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { Order, OrderStatus } from '@/types/order';
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
        total: Number(order.total),
        deliveryFee: Number(order.delivery_fee || 0),
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

    // Realtime para o cliente ver o status mudar sem atualizar a página
    const channel = supabase
      .channel('client-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchMyOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMyOrders]);

  return { orders, loading, refreshOrders: fetchMyOrders };
}

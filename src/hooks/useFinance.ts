import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { storeDateKey, getStoreParts } from '@/lib/storeHours';

// Brasil não tem mais horário de verão desde 2019, então o offset é fixo.
const STORE_UTC_OFFSET = '-03:00';

const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface ProductStat {
  id: string;
  name: string;
  qtd: number;
  total: number;
}

export interface FinanceOrder {
  id: string;
  date: string; // YYYY-MM-DD no fuso da loja
  createdAt: string; // ISO cru, para exibir a hora
  customer: string;
  method: string;
  total: number;
  deliveryFee: number;
  address: string;
  status: string;
  items: any[];
}

/** Índice do dia da semana (0=Dom) a partir de uma chave YYYY-MM-DD. */
function weekdayFromKey(key: string): number {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

export function useFinance() {
  const [loading, setLoading] = useState(true);

  // KPIs
  const [revenue, setRevenue] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [avgTicket, setAvgTicket] = useState(0);

  // Gráficos
  const [chartData, setChartData] = useState<
    { date: string; fullDate: string; total: number; count: number }[]
  >([]);
  const [weekDayData, setWeekDayData] = useState<{ day: string; total: number; count: number }[]>(
    []
  );

  // Listas
  const [detailedOrders, setDetailedOrders] = useState<FinanceOrder[]>([]);
  const [topProducts, setTopProducts] = useState<ProductStat[]>([]);

  // Filtros de Data (no fuso da loja, não no fuso do navegador)
  const todayParts = getStoreParts();
  const firstDayKey = `${todayParts.year}-${String(todayParts.month).padStart(2, '0')}-01`;

  const [startDate, setStartDate] = useState(firstDayKey);
  const [endDate, setEndDate] = useState(todayParts.dateKey);

  const fetchFinancialData = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select(
          `*, items:order_items(product_id, product_name, quantity, unit_price, total_price, observation)`
        )
        .eq('status', 'COMPLETED')
        // Offset explícito: sem ele o Postgres interpreta o horário como UTC
        // e o período fica 3h deslocado (a loja fatura quase tudo depois das 21h)
        .gte('created_at', `${startDate}T00:00:00${STORE_UTC_OFFSET}`)
        .lte('created_at', `${endDate}T23:59:59.999${STORE_UTC_OFFSET}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const orders = data || [];

      // 1. KPIs
      const totalRevenue = orders.reduce((acc, order) => acc + Number(order.total), 0);
      const count = orders.length;

      setRevenue(totalRevenue);
      setOrdersCount(count);
      setAvgTicket(count > 0 ? totalRevenue / count : 0);

      // 2. Agrupamento por dia — usando a data no fuso da LOJA.
      // Antes usava toISOString() (UTC), então todo pedido depois das 21h
      // era contabilizado no dia seguinte.
      const salesByDay: Record<string, { total: number; count: number }> = {};

      orders.forEach((order) => {
        const key = storeDateKey(order.created_at);
        if (!salesByDay[key]) salesByDay[key] = { total: 0, count: 0 };
        salesByDay[key].total += Number(order.total);
        salesByDay[key].count += 1;
      });

      // 3. Preenche todos os dias do período (inclusive os sem venda)
      const filledChartData = [];
      const cursor = new Date(`${startDate}T00:00:00Z`);
      const lastDay = new Date(`${endDate}T00:00:00Z`);

      while (cursor <= lastDay) {
        const key = cursor.toISOString().slice(0, 10);
        const [, month, day] = key.split('-');
        const dataForDay = salesByDay[key] || { total: 0, count: 0 };

        filledChartData.push({
          fullDate: key,
          date: `${day}/${month}`,
          total: dataForDay.total,
          count: dataForDay.count,
        });

        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      setChartData(filledChartData);

      // 4. Agrupamento por dia da semana (derivado das mesmas chaves)
      const salesByWeekDay = WEEK_LABELS.map(() => ({ total: 0, count: 0 }));

      Object.entries(salesByDay).forEach(([key, value]) => {
        const index = weekdayFromKey(key);
        salesByWeekDay[index].total += value.total;
        salesByWeekDay[index].count += value.count;
      });

      setWeekDayData(
        WEEK_LABELS.map((day, index) => ({
          day,
          total: salesByWeekDay[index].total,
          count: salesByWeekDay[index].count,
        }))
      );

      // 5. Listas
      const formattedOrders: FinanceOrder[] = orders
        .map((order) => ({
          id: `#${order.id}`,
          date: storeDateKey(order.created_at),
          createdAt: order.created_at,
          customer: order.customer_name,
          method: order.payment_method,
          total: Number(order.total),
          deliveryFee: Number(order.delivery_fee || 0),
          address: order.customer_address || '',
          status: order.status,
          items: order.items || [],
        }))
        .reverse();
      setDetailedOrders(formattedOrders);

      const productMap = new Map<string, ProductStat>();
      orders.forEach((order) => {
        order.items?.forEach((item: any) => {
          const key = item.product_name;
          const current = productMap.get(key) || {
            id: item.product_id || key,
            name: key,
            qtd: 0,
            total: 0,
          };
          current.qtd += item.quantity;
          current.total += Number(item.total_price);
          productMap.set(key, current);
        });
      });
      setTopProducts(
        Array.from(productMap.values())
          .sort((a, b) => b.qtd - a.qtd)
          .slice(0, 10)
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchFinancialData();
  }, [fetchFinancialData]);

  return {
    revenue,
    ordersCount,
    avgTicket,
    chartData,
    weekDayData,
    detailedOrders,
    topProducts,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    loading,
  };
}

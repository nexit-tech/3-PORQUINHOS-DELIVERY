import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';

export interface ProductStat {
  id: string;
  name: string;
  qtd: number;
  total: number;
}

export interface FinanceOrder {
  id: string;
  date: string;
  customer: string;
  method: string;
  total: number;
  status: string;
  items?: any[];
}

export function useFinance() {
  const [loading, setLoading] = useState(true);
  
  // KPIs
  const [revenue, setRevenue] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [avgTicket, setAvgTicket] = useState(0);
  
  // Gráficos
  // Agora weekDayData também tem 'count'
  const [chartData, setChartData] = useState<{ date: string; fullDate: string; total: number; count: number }[]>([]);
  const [weekDayData, setWeekDayData] = useState<{ day: string; total: number; count: number }[]>([]);

  // Listas
  const [detailedOrders, setDetailedOrders] = useState<FinanceOrder[]>([]);
  const [topProducts, setTopProducts] = useState<ProductStat[]>([]);

  // Filtros de Data
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  const fetchFinancialData = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select(`*, items:order_items(product_id, product_name, quantity, total_price)`)
        .eq('status', 'COMPLETED')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const orders = data || [];

      // 1. KPIs
      const totalRevenue = orders.reduce((acc, order) => acc + Number(order.total), 0);
      const count = orders.length;
      const ticket = count > 0 ? totalRevenue / count : 0;

      setRevenue(totalRevenue);
      setOrdersCount(count);
      setAvgTicket(ticket);

      // 2. Gráfico Evolução (Linha)
      const salesByDay: Record<string, { total: number; count: number }> = {};
      
      orders.forEach((order) => {
        const dateObj = new Date(order.created_at);
        const key = dateObj.toISOString().split('T')[0];
        if (!salesByDay[key]) salesByDay[key] = { total: 0, count: 0 };
        salesByDay[key].total += Number(order.total);
        salesByDay[key].count += 1;
      });

      const filledChartData = [];
      const currDate = new Date(`${startDate}T12:00:00`);
      const lastDate = new Date(`${endDate}T12:00:00`);

      while (currDate <= lastDate) {
        const key = currDate.toISOString().split('T')[0];
        const dayLabel = currDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const dataForDay = salesByDay[key] || { total: 0, count: 0 };
        
        filledChartData.push({
          fullDate: key,
          date: dayLabel,
          total: dataForDay.total,
          count: dataForDay.count
        });
        currDate.setDate(currDate.getDate() + 1);
      }
      setChartData(filledChartData);

      // 3. Gráfico Dias da Semana (Contagem de Pedidos)
      const salesByWeekDay: Record<string, { total: number; count: number }> = {
        'Dom': { total: 0, count: 0 }, 'Seg': { total: 0, count: 0 }, 'Ter': { total: 0, count: 0 }, 
        'Qua': { total: 0, count: 0 }, 'Qui': { total: 0, count: 0 }, 'Sex': { total: 0, count: 0 }, 
        'Sáb': { total: 0, count: 0 }
      };
      
      orders.forEach((order) => {
        const d = new Date(order.created_at);
        const weekDayStr = d.toLocaleDateString('pt-BR', { weekday: 'short' });
        const key = weekDayStr.charAt(0).toUpperCase() + weekDayStr.slice(1).replace('.', '');
        
        if (salesByWeekDay[key]) {
          salesByWeekDay[key].total += Number(order.total);
          salesByWeekDay[key].count += 1; // Incrementa contagem
        }
      });

      const weekOrder = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      setWeekDayData(weekOrder.map(day => ({ 
        day, 
        total: salesByWeekDay[day].total,
        count: salesByWeekDay[day].count // Passamos o count
      })));

      // 4. Listas
      const formattedOrders = orders.map(order => ({
        id: `#${order.id}`,
        date: order.created_at.split('T')[0],
        customer: order.customer_name,
        method: order.payment_method,
        total: Number(order.total),
        status: order.status,
        items: order.items
      })).reverse();
      setDetailedOrders(formattedOrders);

      const productMap = new Map<string, ProductStat>();
      orders.forEach(order => {
        order.items?.forEach((item: any) => {
          const key = item.product_name;
          const current = productMap.get(key) || { id: item.product_id || 'x', name: key, qtd: 0, total: 0 };
          current.qtd += item.quantity;
          current.total += Number(item.total_price);
          productMap.set(key, current);
        });
      });
      setTopProducts(Array.from(productMap.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 10));

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchFinancialData(); }, [fetchFinancialData]);

  return { 
    revenue, ordersCount, avgTicket, 
    chartData, weekDayData, 
    detailedOrders, topProducts, 
    startDate, endDate, setStartDate, setEndDate, 
    loading 
  };
}
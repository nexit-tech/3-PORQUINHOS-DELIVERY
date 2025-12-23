'use client';

import React from 'react';
import styles from './page.module.css';

// Componentes
import FinanceHeader from '@/components/admin/Finance/FinanceHeader';
import KPIGrid from '@/components/admin/Finance/KPIGrid';
import SalesCharts from '@/components/admin/Finance/SalesCharts';
import DetailedStats from '@/components/admin/Finance/DetailedStats';

// Hook de Lógica
import { useFinance } from '@/hooks/useFinance';

export default function FinancePage() {
  // 1. Buscamos todos os dados e funções do nosso Hook
  const { 
    revenue, 
    ordersCount, 
    avgTicket, 
    chartData, 
    weekDayData,    // <--- O novo dado para o gráfico de dias
    detailedOrders, 
    topProducts,
    startDate, 
    endDate, 
    setStartDate, 
    setEndDate,
    loading 
  } = useFinance();

  // 2. Função para atualizar as datas quando o usuário mexe no cabeçalho
  const handleDateChange = (field: 'start' | 'end', value: string) => {
    if (field === 'start') setStartDate(value);
    else setEndDate(value);
  };

  // 3. Estado de Carregamento
  if (loading) {
    return (
      <div className={styles.loading}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div className="spinner" style={{ 
             width: '24px', height: '24px', 
             border: '3px solid #f3f3f3', 
             borderTop: '3px solid #000', 
             borderRadius: '50%',
             animation: 'spin 1s linear infinite'
          }}></div>
          <span>Carregando financeiro...</span>
        </div>
        <style jsx>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // 4. Renderização da Página
  return (
    <div className={styles.container}>
      {/* Cabeçalho com Filtros de Data */}
      <FinanceHeader 
        startDate={startDate}
        endDate={endDate}
        onDateChange={handleDateChange}
        onExport={() => alert('Exportar relatório: Em breve!')}
      />

      {/* Cards de Totais (KPIs) */}
      <KPIGrid 
        totalRevenue={revenue} 
        totalOrders={ordersCount} 
        averageTicket={avgTicket} 
      />

      <div className={styles.chartsSection}>
        {/* Gráficos: Passamos os dois tipos de dados agora */}
        <SalesCharts 
          data={chartData} 
          weekData={weekDayData} 
        />
        
        {/* Tabelas de Detalhes (Produtos e Pedidos) */}
        <DetailedStats 
          products={topProducts} 
          orders={detailedOrders} 
        />
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import FinanceHeader from '@/components/admin/Finance/FinanceHeader';
import KPIGrid from '@/components/admin/Finance/KPIGrid';
import SalesCharts from '@/components/admin/Finance/SalesCharts';
import DetailedStats from '@/components/admin/Finance/DetailedStats';
import styles from './page.module.css';

// --- DADOS MOCKADOS (Poderiam vir de um hook) ---
const MOCK_TRANSACTIONS = [
  { id: '#1020', date: '2023-10-01', customer: 'João Silva', method: 'Pix', total: 150.00, status: 'Concluído' },
  { id: '#1021', date: '2023-10-02', customer: 'Maria Ana', method: 'Cartão', total: 89.90, status: 'Concluído' },
  { id: '#1022', date: '2023-10-03', customer: 'Carlos Edu', method: 'Dinheiro', total: 45.00, status: 'Concluído' },
  { id: '#1023', date: '2023-10-05', customer: 'Ana Clara', method: 'Pix', total: 200.00, status: 'Concluído' },
  { id: '#1024', date: '2023-10-07', customer: 'Lucas M', method: 'Cartão', total: 120.00, status: 'Concluído' },
  { id: '#1025', date: '2023-10-10', customer: 'Beatriz L', method: 'Pix', total: 350.00, status: 'Concluído' },
  { id: '#1026', date: '2023-10-12', customer: 'Fernando', method: 'Cartão', total: 60.00, status: 'Concluído' },
];

const SALES_DATA = [
  { name: '01/10', vendas: 150 }, { name: '03/10', vendas: 250 },
  { name: '05/10', vendas: 450 }, { name: '07/10', vendas: 300 },
  { name: '10/10', vendas: 650 }, { name: '12/10', vendas: 800 },
  { name: '15/10', vendas: 500 },
];

const WEEK_DATA = [
  { name: 'Seg', pedidos: 12 }, { name: 'Ter', pedidos: 18 },
  { name: 'Qua', pedidos: 15 }, { name: 'Qui', pedidos: 25 },
  { name: 'Sex', pedidos: 45 }, { name: 'Sab', pedidos: 60 },
  { name: 'Dom', pedidos: 55 },
];

const TOP_PRODUCTS = [
  { id: 1, name: 'Pizza Grande Calabresa', qtd: 145, total: 7250.00 },
  { id: 2, name: 'X-Tudo Artesanal', qtd: 98, total: 3430.00 },
  { id: 3, name: 'Açaí 500ml', qtd: 76, total: 1520.00 },
  { id: 4, name: 'Coca Cola 2L', qtd: 60, total: 720.00 },
];

export default function FinancePage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const totalRevenue = MOCK_TRANSACTIONS.reduce((acc, curr) => acc + curr.total, 0);
  const totalOrders = MOCK_TRANSACTIONS.length;
  const avgTicket = totalRevenue / totalOrders;

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Relatório Financeiro', 14, 22);
    // ... lógica do PDF
    const tableColumn = ["ID", "Data", "Cliente", "Pagamento", "Valor", "Status"];
    const tableRows = MOCK_TRANSACTIONS.map(t => [
      t.id, t.date.split('-').reverse().join('/'), t.customer, t.method,
      `R$ ${t.total.toFixed(2)}`, t.status
    ]);
    // @ts-ignore
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 30 });
    doc.save('relatorio.pdf');
  };

  return (
    <div className={styles.container}>
      <FinanceHeader 
        startDate={startDate} 
        endDate={endDate} 
        onDateChange={(field, val) => field === 'start' ? setStartDate(val) : setEndDate(val)}
        onExport={handleExportPDF}
      />

      <KPIGrid 
        revenue={totalRevenue} 
        orders={totalOrders} 
        ticket={avgTicket} 
      />

      <SalesCharts 
        salesData={SALES_DATA} 
        weekData={WEEK_DATA} 
      />

      {/* COMPONENTE NOVO COM ABAS */}
      <DetailedStats 
        products={TOP_PRODUCTS} 
        orders={MOCK_TRANSACTIONS} 
      />
    </div>
  );
}
'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import styles from './styles.module.css';

// Interface exata que vem do seu useFinance
interface SalesChartsProps {
  data: { date: string; fullDate: string; total: number; count: number }[];
  weekData: { day: string; total: number; count: number }[];
}

// Tooltip do Gráfico Principal (Faturamento)
const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltipCard}>
        <p className={styles.tooltipLabel}>{label}</p>
        <div className={styles.tooltipValueRow}>
          <span className={styles.tooltipDot} />
          <p className={styles.tooltipValue}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payload[0].value)}
          </p>
        </div>
        <p className={styles.tooltipSub}>
          {payload[0].payload.count} pedidos no dia
        </p>
      </div>
    );
  }
  return null;
};

// Tooltip do Gráfico de Barras (Somatória por Dia da Semana)
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltipCard}>
        <p className={styles.tooltipLabel}>{label}</p> {/* Mostra "Seg", "Ter", etc */}
        <p className={styles.tooltipValue}>
          {payload[0].value} pedidos
        </p>
        <p className={styles.tooltipSub} style={{ fontSize: '0.75rem', color: '#71717a' }}>
           Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payload[0].payload.total)}
        </p>
      </div>
    );
  }
  return null;
};

export default function SalesCharts({ data, weekData }: SalesChartsProps) {
  
  // Calcula o dia (data específica) com maior faturamento para o Card de Destaque
  const bestDay = useMemo(() => {
    if (!data || data.length === 0) return { date: '-', total: 0 };
    return data.reduce((prev, current) => 
      (current.total > prev.total) ? current : prev
    , data[0]);
  }, [data]);

  // Proteção contra dados vazios
  if (!data || !weekData) {
    return <div className={styles.loading}>Carregando gráficos...</div>;
  }

  return (
    <div className={styles.container}>
      
      {/* --- ESQUERDA: GRÁFICO DE FATURAMENTO (Linha do Tempo) --- */}
      <div className={styles.mainChartSection}>
        <div className={styles.headerRow}>
          <div className={styles.titleWrapper}>
            <div className={styles.iconBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
            </div>
            <h3>Faturamento no Período</h3>
          </div>
        </div>

        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                dy={10}
                interval="preserveStartEnd"
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                tickFormatter={(val) => 
                  new Intl.NumberFormat('pt-BR', { notation: "compact", compactDisplay: "short" }).format(val)
                }
              />
              
              <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '4 4' }} />
              
              <Area 
                type="monotone" 
                dataKey="total" 
                stroke="#f97316" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorVendas)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#f97316' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- DIREITA: DESTAQUES --- */}
      <div className={styles.sideSection}>
        
        {/* Card 1: Melhor Dia (Recorde de Faturamento) */}
        <div className={styles.bestDayCard}>
          <div className={styles.bestDayHeader}>
            <div className={styles.whiteIconBox}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <span>Melhor Dia (Recorde)</span>
          </div>
          
          <div className={styles.bestDayContent}>
            <strong>{bestDay.date}</strong>
            <span className={styles.bestDayValue}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bestDay.total)}
            </span>
          </div>
          <div className={styles.decorationCircle} />
        </div>

        {/* Card 2: SOMATÓRIA POR DIA DA SEMANA (O que você pediu!) */}
        <div className={styles.miniChartCard}>
          <div className={styles.miniHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              <h4>Pedidos por Dia</h4>
            </div>
          </div>
          
          <div className={styles.miniChartWrapper}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData}>
                {/* Eixo X com os dias (Seg, Ter, Qua...) */}
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a1a1aa', fontSize: 10 }}
                  dy={5}
                />
                <Tooltip cursor={{ fill: 'transparent' }} content={<CustomBarTooltip />} />
                
                {/* Barras usando 'count' (Quantidade de pedidos somados) */}
                <Bar dataKey="count" radius={[4, 4, 4, 4]}>
                  {weekData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.count > 0 ? '#f97316' : '#e4e4e7'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
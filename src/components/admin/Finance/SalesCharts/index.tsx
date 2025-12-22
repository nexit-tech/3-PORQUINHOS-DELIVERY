'use client';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell 
} from 'recharts';
import styles from './styles.module.css';

interface SalesChartsProps {
  salesData: any[];
  weekData: any[];
}

export default function SalesCharts({ salesData, weekData }: SalesChartsProps) {
  return (
    <div className={styles.chartsRow}>
      {/* GRÁFICO 1: EVOLUÇÃO DE FATURAMENTO */}
      <div className={styles.chartCard}>
        <h3>Evolução de Faturamento</h3>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesData}>
              <defs>
                {/* Gradiente Laranja */}
                <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              {/* Grade cinza clara */}
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
              
              {/* Eixos cinza médio */}
              <XAxis 
                dataKey="name" 
                stroke="#71717a" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 12, fill: '#71717a' }}
              />
              <YAxis 
                stroke="#71717a" 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => `R$${val}`} 
                tick={{ fontSize: 12, fill: '#71717a' }}
                width={80}
              />
              
              {/* Tooltip Branco */}
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  borderColor: '#e4e4e7',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  color: '#18181b'
                }} 
                itemStyle={{ color: '#f97316', fontWeight: 600 }} 
                cursor={{ stroke: '#e4e4e7' }}
              />
              
              <Area 
                type="monotone" 
                dataKey="vendas" 
                stroke="#f97316" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorVendas)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GRÁFICO 2: PEDIDOS POR DIA */}
      <div className={styles.chartCard}>
        <h3>Pedidos por Dia</h3>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
              
              <XAxis 
                dataKey="name" 
                stroke="#71717a" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 12, fill: '#71717a' }}
              />
              
              <Tooltip 
                cursor={{ fill: '#f4f4f5' }} 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  borderColor: '#e4e4e7',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  color: '#18181b'
                }}
                itemStyle={{ color: '#18181b' }}
              />
              
              <Bar dataKey="pedidos" radius={[4, 4, 0, 0]}>
                {weekData.map((entry: any, index: number) => (
                  <Cell 
                    key={`cell-${index}`} 
                    /* Laranja se > 40, Cinza claro se menor */
                    fill={entry.pedidos > 40 ? '#f97316' : '#d4d4d8'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
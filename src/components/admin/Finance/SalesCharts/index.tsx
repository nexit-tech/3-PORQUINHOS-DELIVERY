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
      <div className={styles.chartCard}>
        <h3>Evolução de Faturamento</h3>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ea1d2c" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ea1d2c" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis dataKey="name" stroke="#888" tickLine={false} axisLine={false} />
              <YAxis stroke="#888" tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
              <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} itemStyle={{ color: '#ea1d2c' }} />
              <Area type="monotone" dataKey="vendas" stroke="#ea1d2c" fillOpacity={1} fill="url(#colorVendas)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.chartCard}>
        <h3>Pedidos por Dia</h3>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis dataKey="name" stroke="#888" tickLine={false} axisLine={false} />
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              <Bar dataKey="pedidos" fill="#ea1d2c" radius={[4, 4, 0, 0]}>
                {weekData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.pedidos > 40 ? '#ea1d2c' : '#555'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
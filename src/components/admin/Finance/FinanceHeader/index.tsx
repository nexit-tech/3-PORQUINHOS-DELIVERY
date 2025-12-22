import { Calendar, Download } from 'lucide-react';
import styles from './styles.module.css';

interface FinanceHeaderProps {
  startDate: string;
  endDate: string;
  onDateChange: (field: 'start' | 'end', value: string) => void;
  onExport: () => void;
}

export default function FinanceHeader({ startDate, endDate, onDateChange, onExport }: FinanceHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <h1>Financeiro</h1>
        <p>Visão geral de faturamento e métricas.</p>
      </div>
      
      <div className={styles.controls}>
        <div className={styles.dateGroup}>
          <Calendar size={16} className={styles.dateIcon} />
          <input 
            type="date" 
            className={styles.dateInput} 
            value={startDate}
            onChange={(e) => onDateChange('start', e.target.value)}
          />
          <span className={styles.separator}>até</span>
          <input 
            type="date" 
            className={styles.dateInput}
            value={endDate}
            onChange={(e) => onDateChange('end', e.target.value)}
          />
        </div>
        
        <button onClick={onExport} className={styles.exportBtn}>
          <Download size={18} /> Exportar Relatório
        </button>
      </div>
    </header>
  );
}
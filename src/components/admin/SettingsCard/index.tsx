import { LucideIcon, ChevronRight } from 'lucide-react';
import styles from './styles.module.css';

interface SettingsCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  // Novos props opcionais para dar vida
  status?: string; 
  statusColor?: 'green' | 'red' | 'gray' | 'blue';
}

export default function SettingsCard({ 
  title, 
  description, 
  icon: Icon, 
  onClick, 
  status, 
  statusColor = 'gray' 
}: SettingsCardProps) {
  
  return (
    <button className={styles.card} onClick={onClick}>
      <div className={styles.cardHeader}>
        <div className={styles.iconBox}>
          <Icon size={28} />
        </div>
        {status && (
          <span className={`${styles.badge} ${styles[statusColor]}`}>
            {status}
          </span>
        )}
      </div>
      
      <div className={styles.content}>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <div className={styles.footer}>
        <span className={styles.cta}>Configurar</span>
        <ChevronRight size={18} />
      </div>
    </button>
  );
}
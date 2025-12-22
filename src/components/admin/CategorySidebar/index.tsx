import { Category } from '@/types/product';
import { UtensilsCrossed, Plus } from 'lucide-react';
import styles from './styles.module.css';

interface SidebarProps {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewCategory: () => void; // <--- NOVA PROP
}

export default function CategorySidebar({ categories, activeId, onSelect, onNewCategory }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <h3 className={styles.title}>Categorias</h3>
      <ul className={styles.list}>
        {categories.map(cat => (
          <li key={cat.id}>
            <button 
              className={`${styles.btn} ${activeId === cat.id ? styles.active : ''}`}
              onClick={() => onSelect(cat.id)}
            >
              <UtensilsCrossed size={16} />
              {cat.name}
            </button>
          </li>
        ))}
      </ul>
      
      {/* Botão agora chama a função recebida do pai */}
      <button className={styles.addBtn} onClick={onNewCategory}>
        <Plus size={16} /> Nova Categoria
      </button>
    </aside>
  );
}
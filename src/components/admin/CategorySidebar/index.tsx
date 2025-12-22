import { Plus, Trash2 } from 'lucide-react'; // Importe o Trash2
import styles from './styles.module.css';

interface CategorySidebarProps {
  categories: any[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewCategory: () => void;
  onDeleteCategory?: (id: string) => void; // Nova Prop Opcional
}

export default function CategorySidebar({ 
  categories, 
  activeId, 
  onSelect, 
  onNewCategory,
  onDeleteCategory 
}: CategorySidebarProps) {
  
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h3>Categorias</h3>
        <button onClick={onNewCategory} className={styles.addBtn} title="Nova Categoria">
          <Plus size={18} />
        </button>
      </div>

      <nav className={styles.nav}>
        <button 
          className={`${styles.navItem} ${activeId === 'all' ? styles.active : ''}`}
          onClick={() => onSelect('all')}
        >
          Todos os Produtos
        </button>

        {categories.map(cat => (
          <div 
            key={cat.id} 
            className={`${styles.navItemWrapper} ${activeId === cat.id ? styles.activeWrapper : ''}`}
          >
            <button 
              className={styles.navItemContent}
              onClick={() => onSelect(cat.id)}
            >
              {cat.name}
            </button>
            
            {/* Botão de Excluir Categoria */}
            {onDeleteCategory && (
              <button 
                className={styles.deleteCatBtn}
                onClick={(e) => {
                  e.stopPropagation(); // Evita selecionar a categoria ao clicar em excluir
                  onDeleteCategory(cat.id);
                }}
                title="Excluir Categoria"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
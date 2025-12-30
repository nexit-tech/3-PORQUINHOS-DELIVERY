// src/components/admin/CategorySidebar/index.tsx
import { Plus, Trash2, ArrowUpDown } from 'lucide-react';
import styles from './styles.module.css';

interface CategorySidebarProps {
  categories: any[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewCategory: () => void;
  onDeleteCategory?: (id: string) => void;
  onReorder?: () => void;
}

export default function CategorySidebar({ 
  categories, 
  activeId, 
  onSelect, 
  onNewCategory,
  onDeleteCategory,
  onReorder
}: CategorySidebarProps) {
  
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h3>Categorias</h3>
        <div className={styles.headerActions}>
          {/* 🔥 BOTÃO DE ORDENAR */}
          {onReorder && categories.length > 1 && (
            <button onClick={onReorder} className={styles.reorderBtn} title="Reordenar Categorias">
              <ArrowUpDown size={16} />
            </button>
          )}
          <button onClick={onNewCategory} className={styles.addBtn} title="Nova Categoria">
            <Plus size={18} />
          </button>
        </div>
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
                  e.stopPropagation();
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
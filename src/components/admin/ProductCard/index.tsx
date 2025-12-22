import { Product } from '@/types/product';
import { Edit2, Layers, Trash2 } from 'lucide-react';
import styles from './styles.module.css';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void; // <--- Novo prop
}

export default function ProductCard({ product, onEdit, onDelete }: ProductCardProps) {
  const hasComplements = product.complements && product.complements.length > 0;

  return (
    <div className={styles.card}>
      <div 
        className={styles.imagePlaceholder} 
        style={{ backgroundImage: product.image ? `url(${product.image})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      
      <div className={styles.body}>
        <div className={styles.header}>
          <h3>{product.name}</h3>
          <span className={styles.price}>
            {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
        
        <p className={styles.desc}>{product.description}</p>
        
        {hasComplements && (
          <div className={styles.badge}>
            <Layers size={14} />
            {product.complements.length} Grupos de Opções
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button 
          className={styles.deleteBtn} 
          onClick={() => onDelete(product.id)}
          title="Excluir Produto"
        >
          <Trash2 size={16} />
        </button>
        <button className={styles.editBtn} onClick={() => onEdit(product)}>
          <Edit2 size={16} /> Editar
        </button>
      </div>
    </div>
  );
}
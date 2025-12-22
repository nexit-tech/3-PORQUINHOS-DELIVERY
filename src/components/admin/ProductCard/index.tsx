import { Product } from '@/types/product';
import { Edit2, Layers } from 'lucide-react';
import styles from './styles.module.css';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void; // <--- Callback novo
}

export default function ProductCard({ product, onEdit }: ProductCardProps) {
  const hasComplements = product.complements.length > 0;

  return (
    <div className={styles.card}>
      <div 
        className={styles.imagePlaceholder} 
        style={{ backgroundImage: product.image ? `url(${product.image})` : 'none', backgroundSize: 'cover' }}
      />
      
      <div className={styles.body}>
        <div className={styles.header}>
          <h3>{product.name}</h3>
          <span className={styles.price}>R$ {product.price.toFixed(2)}</span>
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
        <button className={styles.editBtn} onClick={() => onEdit(product)}>
          <Edit2 size={16} /> Editar Produto
        </button>
      </div>
    </div>
  );
}
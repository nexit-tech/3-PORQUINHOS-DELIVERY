// src/components/admin/ProductCard/index.tsx
import { Product } from '@/types/product';
import { Edit2, Layers, Trash2, Power } from 'lucide-react';
import styles from './styles.module.css';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, currentStatus: boolean) => void; // 🔥 NOVO
}

export default function ProductCard({ product, onEdit, onDelete, onToggleActive }: ProductCardProps) {
  const hasComplements = product.complements && product.complements.length > 0;

  return (
    <div className={`${styles.card} ${!product.active ? styles.inactive : ''}`}>
      {/* 🔥 BADGE DE STATUS */}
      {!product.active && (
        <div className={styles.inactiveBadge}>PAUSADO</div>
      )}

      <div 
        className={styles.imagePlaceholder} 
        style={{ 
          backgroundImage: product.image ? `url(${product.image})` : 'none', 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          filter: !product.active ? 'grayscale(1) opacity(0.5)' : 'none' // 🔥 Fica cinza quando pausado
        }}
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
        {/* 🔥 BOTÃO DE ATIVAR/PAUSAR */}
        <button 
          className={`${styles.toggleBtn} ${product.active ? styles.active : styles.paused}`}
          onClick={() => onToggleActive(product.id, product.active)}
          title={product.active ? "Pausar Produto" : "Ativar Produto"}
        >
          <Power size={16} />
          {product.active ? 'Pausar' : 'Ativar'}
        </button>

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
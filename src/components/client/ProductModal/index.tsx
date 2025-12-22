'use client';

import { useState, useRef, useEffect } from 'react';
import { Minus, Plus, Check } from 'lucide-react';
import { useCart, CartItem } from '@/context/CartContext';
import styles from './styles.module.css';

interface Product {
  id: number;
  name: string;
  desc: string;
  price: number;
}

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  initialData?: CartItem | null; // Se passar isso, é modo EDIÇÃO
}

const EXTRA_PRICE = 5.00; // Preço da borda

export default function ProductModal({ product, onClose, initialData }: ProductModalProps) {
  const { addToCart, editCartItem } = useCart();

  // Estados
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState('');
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false); // Feedback visual

  // UI States
  const [isClosing, setIsClosing] = useState(false);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  // --- EFEITO: Carregar dados se for EDIÇÃO ---
  useEffect(() => {
    if (initialData) {
      setQuantity(initialData.quantity);
      setObservation(initialData.observation);
      setSelectedFlavors(initialData.flavors);
      setSelectedExtras(initialData.extras);
    }
  }, [initialData]);

  if (!product) return null;

  // --- LÓGICA DE ARRASTAR (MANTIDA) ---
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.body}`)) return; 
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff > 0) setOffsetY(diff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (offsetY > 150) handleClose();
    else setOffsetY(0);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setOffsetY(0);
      setShowToast(false);
    }, 300);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  // --- LÓGICA DE NEGÓCIO ---

  const toggleFlavor = (flavorName: string) => {
    setSelectedFlavors(prev => {
      if (prev.includes(flavorName)) return prev.filter(f => f !== flavorName);
      if (prev.length >= 2) return prev; 
      return [...prev, flavorName];
    });
  };

  const toggleExtra = (extraName: string) => {
    setSelectedExtras(prev => 
      prev.includes(extraName) ? prev.filter(e => e !== extraName) : [...prev, extraName]
    );
  };

  const increment = () => setQuantity(q => q + 1);
  const decrement = () => setQuantity(q => Math.max(1, q - 1));

  // CÁLCULO TOTAL: (Preço Pizza + (Qtd Extras * 5)) * Quantidade
  const unitPrice = product.price + (selectedExtras.length * EXTRA_PRICE);
  const total = unitPrice * quantity;

  const handleSave = () => {
    // Dados do item
    const itemData = {
      quantity,
      flavors: selectedFlavors,
      extras: selectedExtras,
      observation,
      totalPrice: total
    };

    if (initialData) {
      // MODO EDIÇÃO
      editCartItem(initialData.uuid, itemData);
      handleClose(); // Fecha direto na edição
    } else {
      // MODO ADICIONAR
      addToCart({
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          desc: product.desc
        },
        ...itemData
      });

      // Feedback visual e fecha
      setShowToast(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    }
  };

  // Styles
  const modalStyle = {
    transform: `translateY(${isClosing ? '100%' : `${offsetY}px`})`,
    transition: isDragging ? 'none' : 'transform 0.3s ease-out'
  };

  return (
    <div className={`${styles.overlay} ${isClosing ? styles.fadeOut : ''}`} onClick={handleOverlayClick}>
      
      {/* TOAST DE SUCESSO */}
      {showToast && (
        <div className={styles.toast}>
          <Check size={20} />
          <span>Adicionado ao carrinho!</span>
        </div>
      )}

      <div className={styles.modal} style={modalStyle}>
        
        {/* HEADER LIMPO (SEM BOTÃO DE VOLTAR) */}
        <div 
          className={styles.dragHeader}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.dragHandle} />
          {/* Removi o botão de fechar daqui conforme pedido */}

          <div className={styles.imageHeader}>
            <div className={styles.imgPlaceholder} />
          </div>

          <div className={styles.headerInfo}>
            <h2>{product.name}</h2>
            <p className={styles.desc}>{product.desc}</p>
            <div className={styles.priceBadge}>
              {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
        </div>

        <div className={styles.body}>
          {/* SABORES */}
          <div className={styles.group}>
            <div className={styles.groupHeader}>
              <h3>Escolha os Sabores</h3>
              <span className={styles.limitBadge}>Até 2 sabores</span>
            </div>
            <div className={styles.optionsList}>
              {['Calabresa', 'Frango c/ Catupiry', 'Portuguesa', '4 Queijos'].map(flavor => (
                <label key={flavor} className={styles.optionRow}>
                  <div className={styles.optionInfo}>
                    <span className={styles.optionTitle}>{flavor}</span>
                  </div>
                  <input 
                    type="checkbox" 
                    className={styles.checkbox} 
                    checked={selectedFlavors.includes(flavor)}
                    onChange={() => toggleFlavor(flavor)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className={styles.divider} />

          {/* EXTRAS (SOMANDO PREÇO) */}
          <div className={styles.group}>
            <div className={styles.groupHeader}>
              <h3>Borda Recheada?</h3>
              <span className={styles.limitBadge}>+ R$ 5,00 cada</span>
            </div>
             <div className={styles.optionsList}>
              {['Borda Catupiry', 'Borda Cheddar'].map(extra => (
                <label key={extra} className={styles.optionRow}>
                  <div className={styles.optionInfo}>
                    <span className={styles.optionTitle}>{extra}</span>
                    <span className={styles.optionPrice}>+ R$ 5,00</span>
                  </div>
                  <input 
                    type="checkbox" 
                    className={styles.checkbox}
                    checked={selectedExtras.includes(extra)}
                    onChange={() => toggleExtra(extra)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className={styles.divider} />

          {/* OBSERVAÇÃO */}
          <div className={styles.group}>
            <div className={styles.groupHeader}>
              <h3>Observações</h3>
            </div>
            <textarea 
              className={styles.textarea}
              placeholder="Ex: Sem cebola, bem assada..."
              rows={3}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className={styles.footer}>
          <div className={styles.quantityControl}>
            <button onClick={decrement} className={styles.qtdBtn}><Minus size={18}/></button>
            <span className={styles.qtdNumber}>{quantity}</span>
            <button onClick={increment} className={styles.qtdBtn}><Plus size={18}/></button>
          </div>
          
          <button className={styles.addBtn} onClick={handleSave}>
            <span>{initialData ? 'Atualizar Pedido' : 'Adicionar'}</span>
            <span className={styles.totalPrice}>
              {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
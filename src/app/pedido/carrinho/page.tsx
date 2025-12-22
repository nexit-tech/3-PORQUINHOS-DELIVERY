'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Minus, Plus, ArrowLeft, ShoppingBag, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { useCart, CartItem } from '@/context/CartContext';
import styles from './page.module.css';
import ProductModal from '@/components/client/ProductModal';

export default function CarrinhoPage() {
  const router = useRouter();
  const { items, removeFromCart, updateQuantity, clearCart, cartSubtotal } = useCart();
  
  // Estado para controlar qual item está sendo editado (abre o modal)
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);

  // --- ESTADO VAZIO ---
  if (items.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <ShoppingBag size={64} color="var(--border-color)" />
        <h2>Seu carrinho está vazio</h2>
        <p>Que tal adicionar um lanche delicioso?</p>
        <Link href="/pedido" className={styles.backBtn}>
          Ver Cardápio
        </Link>
      </div>
    );
  }

  // --- CARRINHO COM ITENS ---
  return (
    <main className={styles.container}>
      
      {/* HEADER */}
      <header className={styles.header}>
        <Link href="/pedido" className={styles.iconBtn}>
          <ArrowLeft size={24} />
        </Link>
        <h1>Carrinho</h1>
        <button className={styles.clearBtn} onClick={clearCart}>
          Limpar
        </button>
      </header>

      {/* LISTA DE ITENS */}
      <div className={styles.list}>
        {items.map((item) => (
          // O clique no card abre o modal de edição
          <div 
            key={item.uuid} 
            className={styles.card}
            onClick={() => setEditingItem(item)} 
          >
            <div className={styles.cardHeader}>
              <h3 className={styles.prodName}>{item.product.name}</h3>
              <button 
                className={styles.removeBtn} 
                onClick={(e) => {
                  e.stopPropagation(); // Impede abrir o modal ao clicar no lixo
                  removeFromCart(item.uuid);
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className={styles.details}>
              {/* Mostra Sabores */}
              {item.flavors.length > 0 && (
                <p><strong>Sabores:</strong> {item.flavors.join(', ')}</p>
              )}
              {/* Mostra Adicionais/Bordas */}
              {item.extras.length > 0 && (
                <p><strong>Adicionais:</strong> {item.extras.join(', ')}</p>
              )}
              {/* Mostra Observação */}
              {item.observation && (
                <p className={styles.obs}>"{item.observation}"</p>
              )}
              
              {/* Dica visual de edição */}
              <div className={styles.editHint}>
                <Edit2 size={12} />
                <span>Toque para editar</span>
              </div>
            </div>

            <div className={styles.cardFooter}>
              <div className={styles.price}>
                {item.totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              
              {/* Controle de Quantidade */}
              <div 
                className={styles.quantityControl}
                onClick={(e) => e.stopPropagation()} // Impede abrir modal ao mudar qtd
              >
                <button onClick={() => updateQuantity(item.uuid, -1)} className={styles.qtdBtn}>
                  <Minus size={16}/>
                </button>
                <span className={styles.qtdNumber}>{item.quantity}</span>
                <button onClick={() => updateQuantity(item.uuid, 1)} className={styles.qtdBtn}>
                  <Plus size={16}/>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER FIXO */}
      <div className={styles.footerSummary}>
        <div className={styles.summaryRow}>
          <span>Subtotal</span>
          <span className={styles.totalValue}>
            {cartSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
        
        {/* BOTÃO DE AÇÃO */}
        <button 
          className={styles.finishBtn} 
          onClick={() => router.push('/pedido/checkout/endereco')}
        >
          Confirmar Endereço
        </button>
      </div>

      {/* MODAL DE EDIÇÃO (Reutiliza o componente, passando initialData) */}
      {editingItem && (
        <ProductModal 
          product={editingItem.product}
          initialData={editingItem} 
          onClose={() => setEditingItem(null)}
        />
      )}
    </main>
  );
}
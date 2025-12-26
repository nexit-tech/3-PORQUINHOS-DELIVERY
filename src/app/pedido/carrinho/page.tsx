'use client';

import { useState } from 'react';
import { useCart, CartItem } from '@/context/CartContext';
import { Trash2, Minus, Plus, ArrowLeft, ShoppingBag, Edit2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import ProductModal from '@/components/client/ProductModal';
import styles from './page.module.css';

export default function CarrinhoPage() {
  const { items, removeItem, updateQuantity, cartSubtotal } = useCart() as any;
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);

  if (!items || items.length === 0) {
    return (
      <main className={styles.emptyContainer}>
        <div className={styles.emptyContent}>
          <ShoppingBag size={64} color="#e5e7eb" />
          <h2>Seu carrinho está vazio</h2>
          <p>Que tal adicionar algumas delícias?</p>
          <Link href="/pedido" className={styles.backBtn}>
            Voltar para o Cardápio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <Link href="/pedido" className={styles.iconBtn}>
          <ArrowLeft size={24} />
        </Link>
        <h1>Carrinho</h1>
        <div style={{ width: 24 }} />
      </header>

      <div className={styles.content}>
        <div className={styles.list}>
          {items.map((item: any) => (
            <div key={item.uuid} className={styles.card}>
              <div className={styles.cardHeader}>
                {/* Imagem do Produto */}
                <div className={styles.imageWrapper}>
                  {item.product.image ? (
                    <Image 
                      src={item.product.image} 
                      alt={item.product.name} 
                      fill 
                      className={styles.prodImage}
                    />
                  ) : (
                    <div className={styles.imgPlaceholder} />
                  )}
                </div>

                <div className={styles.prodInfo}>
                  <h3>{item.product.name}</h3>
                  <div className={styles.priceRow}>
                    <span className={styles.unitPrice}>
                      {(item.totalPrice / item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>

                {/* Botão de Remover */}
                <button 
                  onClick={() => removeItem(item.uuid)}
                  className={styles.removeBtn}
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* 🎯 DETALHES CORRIGIDOS (Pizza 1, Pizza 2, etc) */}
              <div className={styles.details}>
                {/* 🔥 NOVA LÓGICA: Exibe grupos separadamente (Pizza 1, Pizza 2) */}
                {item.selections && Object.keys(item.selections).length > 0 ? (
                  Object.entries(item.selections).map(([groupId, options]: [string, any], index) => {
                    // Busca o nome do grupo (ex: "Pizza 1", "Pizza 2")
                    const group = item.product.complements?.find((g: any) => g.id === groupId);
                    const groupLabel = group?.name || `Grupo ${index + 1}`;
                    
                    // Lista os sabores selecionados
                    const selectedFlavors = options.map((opt: any) => opt.name).join(', ');
                    
                    return (
                      <p key={groupId} className={styles.detailLine}>
                        <strong>{groupLabel}:</strong> {selectedFlavors}
                      </p>
                    );
                  })
                ) : (
                  // Fallback antigo (se não tiver selections)
                  item.flavors && item.flavors.length > 0 && (
                    <p className={styles.detailLine}>
                      <strong>Sabores:</strong> {item.flavors.join(', ')}
                    </p>
                  )
                )}

                {/* 🔥 REMOVIDO: Adicionais (não existe mais) */}

                {/* Observação */}
                {item.observation && (
                  <p className={styles.detailLine}>
                    <strong>Obs:</strong> {item.observation}
                  </p>
                )}
              </div>

              <div className={styles.actions}>
                <button 
                  className={styles.editBtn}
                  onClick={() => setEditingItem(item)}
                >
                  <Edit2 size={16} /> Editar
                </button>

                <div className={styles.quantityControl}>
                  <button onClick={() => updateQuantity(item.uuid, Math.max(1, item.quantity - 1))}>
                    <Minus size={16} />
                  </button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.uuid, item.quantity + 1)}>
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.totalRow}>
          <span>Subtotal</span>
          <strong>{cartSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
        </div>
        <Link href="/pedido/checkout/endereco" className={styles.checkoutBtn}>
          Confirmar Pedido
        </Link>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editingItem && (
        <ProductModal
          product={editingItem.product as any}
          initialData={editingItem}
          onClose={() => setEditingItem(null)}
        />
      )}
    </main>
  );
}
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, ComplementOption } from '@/types/product';

// Tipo do item no carrinho
export interface CartItem {
  uuid: string; // Identificador único para o carrinho (importante!)
  product: Product;
  quantity: number;
  observation?: string;
  flavors?: string[];
  customizations?: { name: string; price: number }[]; // Adicionais
  totalPrice: number; // Preço total (unitário * quantidade)
  selections?: Record<string, ComplementOption[]>; // Para restaurar o modal
}

interface CartContextType {
  items: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  deliveryFee: number;
  setDeliveryFee: (fee: number) => void;
  addToCart: (item: Omit<CartItem, 'uuid'>) => void;
  removeItem: (uuid: string) => void;
  updateQuantity: (uuid: string, quantity: number) => void;
  editCartItem: (uuid: string, updatedData: Partial<CartItem>) => void;
  clearCart: () => void;
  
  // Dados do Cliente
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  address: Address;
  setAddress: (addr: Address) => void;
}

interface Address {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState<Address>({ street: '', number: '', neighborhood: '' });

  // Carrega do LocalStorage ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem('anota_cart');
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao carregar carrinho', e);
      }
    }
  }, []);

  // Salva no LocalStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('anota_cart', JSON.stringify(items));
  }, [items]);

  // ADICIONAR
  const addToCart = (newItem: Omit<CartItem, 'uuid'>) => {
    setItems((prev) => {
      // Cria um UUID aleatório para esse item
      const uuid = Math.random().toString(36).substring(2, 9);
      return [...prev, { ...newItem, uuid }];
    });
  };

  // REMOVER (Correção do botão de lixo)
  const removeItem = (uuid: string) => {
    setItems((prev) => prev.filter((item) => item.uuid !== uuid));
  };

  // ATUALIZAR QUANTIDADE (+ / -)
  const updateQuantity = (uuid: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.uuid === uuid) {
          // Recalcula o preço total baseado no unitário original
          const unitPrice = item.totalPrice / item.quantity;
          return { ...item, quantity: newQuantity, totalPrice: unitPrice * newQuantity };
        }
        return item;
      })
    );
  };

  // EDITAR ITEM (Quando volta do Modal)
  const editCartItem = (uuid: string, updatedData: Partial<CartItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.uuid === uuid) {
          // Atualiza os dados mantendo o UUID e o Produto base
          return { ...item, ...updatedData };
        }
        return item;
      })
    );
  };

  const clearCart = () => setItems([]);

  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = items.reduce((acc, item) => acc + item.totalPrice, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        cartCount,
        cartSubtotal,
        deliveryFee,
        setDeliveryFee,
        addToCart,
        removeItem,
        updateQuantity,
        editCartItem,
        clearCart,
        customerName,
        setCustomerName,
        customerPhone,
        setCustomerPhone,
        address,
        setAddress,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
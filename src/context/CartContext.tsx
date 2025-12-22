'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

// --- TIPAGENS ---

export interface CartItem {
  uuid: string; // ID único para o item no carrinho
  product: {
    id: number;
    name: string;
    price: number;
    desc: string;
  };
  quantity: number;
  flavors: string[];    // Sabores selecionados
  extras: string[];     // Bordas/Adicionais
  observation: string;  // Obs do item
  totalPrice: number;   // Preço total deste item (unitário * qtd)
}

export interface Address {
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
}

export interface Customer {
  name: string;
  phone: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  deliveryFee: number;
  address: Address;
  customer: Customer;
  paymentMethod: string;
  status: 'recebido' | 'preparando' | 'saiu' | 'entregue';
  date: Date;
}

interface CartContextType {
  // Carrinho
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'uuid'>) => void;
  editCartItem: (uuid: string, updatedItem: Partial<CartItem>) => void;
  removeFromCart: (uuid: string) => void;
  updateQuantity: (uuid: string, delta: number) => void;
  clearCart: () => void;
  
  // Totais
  cartSubtotal: number;
  cartCount: number;

  // Checkout - Taxa e Endereço
  deliveryFee: number;
  setDeliveryFee: (val: number) => void;
  address: Address;
  setAddress: (addr: Address) => void;
  
  // Checkout - Cliente
  customerName: string;
  setCustomerName: (val: string) => void;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;

  // Pedidos (Histórico)
  orders: Order[];
  placeOrder: (paymentMethod: string) => void;
}

// --- CONTEXTO ---

const CartContext = createContext<CartContextType>({} as CartContextType);

// --- PROVIDER ---

export function CartProvider({ children }: { children: ReactNode }) {
  // 1. Estado do Carrinho
  const [items, setItems] = useState<CartItem[]>([]);
  
  // 2. Estado do Checkout (Endereço e Taxa)
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [address, setAddress] = useState<Address>({ street: '', number: '', neighborhood: '' });
  
  // 3. Estado do Cliente (Nome e Telefone)
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // 4. Histórico de Pedidos
  const [orders, setOrders] = useState<Order[]>([]);

  // --- AÇÕES DO CARRINHO ---

  const addToCart = (newItem: Omit<CartItem, 'uuid'>) => {
    const uuid = Math.random().toString(36).substring(7);
    setItems((prev) => [...prev, { ...newItem, uuid }]);
  };

  const editCartItem = (uuid: string, updatedData: Partial<CartItem>) => {
    setItems((prev) => 
      prev.map(item => item.uuid === uuid ? { ...item, ...updatedData } : item)
    );
  };

  const removeFromCart = (uuid: string) => {
    setItems((prev) => prev.filter((item) => item.uuid !== uuid));
  };

  const updateQuantity = (uuid: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.uuid === uuid) {
          const newQuantity = Math.max(1, item.quantity + delta);
          // Recalcula o preço total proporcionalmente
          const unitPrice = item.totalPrice / item.quantity;
          return { ...item, quantity: newQuantity, totalPrice: unitPrice * newQuantity };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    setDeliveryFee(0);
    // Opcional: Limpar endereço/cliente se quiser resetar tudo
    // setAddress({ street: '', number: '', neighborhood: '' });
  };

  // --- AÇÃO FINAL: CRIAR PEDIDO ---

  const placeOrder = (paymentMethod: string) => {
    // Gera um ID aleatório (ex: #8392)
    const orderId = `#${Math.floor(1000 + Math.random() * 9000)}`;
    
    const newOrder: Order = {
      id: orderId,
      items: [...items], // Copia os itens atuais
      total: items.reduce((acc, item) => acc + item.totalPrice, 0) + deliveryFee,
      deliveryFee,
      address,
      customer: {
        name: customerName,
        phone: customerPhone
      },
      paymentMethod,
      status: 'recebido',
      date: new Date()
    };

    // Adiciona ao início do histórico
    setOrders(prev => [newOrder, ...prev]);
    
    // Limpa o carrinho para o próximo pedido
    clearCart();
  };

  // --- CÁLCULOS ---

  const cartSubtotal = items.reduce((acc, item) => acc + item.totalPrice, 0);
  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider 
      value={{ 
        items, 
        addToCart, 
        editCartItem, 
        removeFromCart, 
        updateQuantity, 
        clearCart, 
        cartSubtotal, 
        cartCount,
        
        deliveryFee, 
        setDeliveryFee, 
        address, 
        setAddress,
        
        customerName, 
        setCustomerName, 
        customerPhone, 
        setCustomerPhone,
        
        orders, 
        placeOrder
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// Hook personalizado para usar o contexto
export const useCart = () => useContext(CartContext);
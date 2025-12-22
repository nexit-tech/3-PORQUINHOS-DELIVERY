import { useState } from 'react';
import { Order, OrderStatus } from '@/types/order';

const MOCK_ORDERS: Order[] = [
  // --- PENDENTES ---
  {
    id: '#1023', customerName: 'João Silva', customerPhone: '(11) 99999-1234', customerAddress: 'Rua das Flores, 123',
    paymentMethod: 'CREDIT_CARD', status: 'PENDING', total: 45.90, deliveryFee: 5.00, createdAt: '19:30',
    items: [{ id: '1', name: '2x X-Tudo', quantity: 2, observation: 'Sem cebola' }]
  },
  {
    id: '#1025', customerName: 'Pedro Sampaio', customerPhone: '(11) 98888-5555', customerAddress: 'Rua da Praia, 55',
    paymentMethod: 'PIX', status: 'PENDING', total: 32.00, deliveryFee: 0.00, createdAt: '19:42',
    items: [{ id: '1', name: 'Açaí 500ml', quantity: 1 }]
  },
  {
    id: '#1026', customerName: 'Ana Clara', customerPhone: '(11) 97777-1111', customerAddress: 'Av. Central, 1001',
    paymentMethod: 'CASH', status: 'PENDING', total: 89.90, deliveryFee: 7.50, createdAt: '19:45',
    items: [{ id: '1', name: 'Combo Família', quantity: 1 }]
  },
  {
    id: '#1027', customerName: 'Lucas Motta', customerPhone: '(11) 96666-2222', customerAddress: 'Rua 2, Bloco C',
    paymentMethod: 'DEBIT_CARD', status: 'PENDING', total: 25.50, deliveryFee: 3.00, createdAt: '19:48',
    items: [{ id: '1', name: 'Marmita P', quantity: 1 }]
  },
  {
    id: '#1028', customerName: 'Beatriz Lima', customerPhone: '(11) 95555-3333', customerAddress: 'Alameda Santos, 400',
    paymentMethod: 'CREDIT_CARD', status: 'PENDING', total: 55.00, deliveryFee: 5.00, createdAt: '19:50',
    items: [{ id: '1', name: 'Pizza Calabresa', quantity: 1 }]
  },

  // --- PREPARANDO ---
  {
    id: '#1024', customerName: 'Maria Ana', customerPhone: '(11) 94444-4444', customerAddress: 'Av. Brasil, 500 - Ap 20',
    paymentMethod: 'PIX', status: 'PREPARING', total: 112.50, deliveryFee: 10.00, createdAt: '19:35',
    items: [{ id: '2', name: 'Pizza G + Refri', quantity: 1 }]
  },
  {
    id: '#1022', customerName: 'Carlos Eduardo', customerPhone: '(11) 93333-5555', customerAddress: 'Rua Nova, 12',
    paymentMethod: 'CASH', status: 'PREPARING', total: 40.00, deliveryFee: 4.00, createdAt: '19:20',
    items: [{ id: '1', name: 'Hamburguer Artesanal', quantity: 1 }]
  },

  // --- EM ROTA ---
  {
    id: '#1020', customerName: 'Fernanda Souza', customerPhone: '(11) 92222-6666', customerAddress: 'Rua Timbiras, 88',
    paymentMethod: 'CREDIT_CARD', status: 'DELIVERING', total: 78.00, deliveryFee: 6.00, createdAt: '19:10',
    items: [{ id: '1', name: 'Sushi Combo 1', quantity: 1 }]
  }
];

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);

  const updateStatus = (id: string, newStatus: OrderStatus) => {
    setOrders(prev => prev.map(order => 
      order.id === id ? { ...order, status: newStatus } : order
    ));
  };

  return { orders, updateStatus };
}
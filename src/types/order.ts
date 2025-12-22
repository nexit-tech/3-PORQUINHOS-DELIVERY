export type OrderStatus = 'PENDING' | 'PREPARING' | 'DELIVERING' | 'COMPLETED' | 'CANCELED';
export type PaymentMethod = 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'PIX';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  observation?: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  deliveryFee: number; // <--- NOVO CAMPO
  createdAt: string;
}


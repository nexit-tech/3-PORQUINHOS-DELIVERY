export type OrderStatus = 'PENDING' | 'PREPARING' | 'DELIVERING' | 'COMPLETED' | 'CANCELED';
export type PaymentMethod = 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'PIX';

export interface OrderItem {
  id: string; // UUID no banco
  name: string; // product_name no banco
  quantity: number;
  unitPrice: number; // unit_price no banco
  totalPrice: number; // total_price no banco
  observation?: string;
  customizations?: any; // jsonb no banco
}

export interface Order {
  id: number; // bigserial no banco
  displayId: string; // Para exibir com # (ex: #105)
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string; // Texto no banco
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  deliveryFee: number;
  createdAt: string;
  updatedAt: string;
}
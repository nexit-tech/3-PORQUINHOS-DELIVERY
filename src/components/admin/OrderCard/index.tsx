import { Order, PaymentMethod } from '@/types/order';
import { 
  Clock, 
  MapPin, 
  User, 
  CheckCircle, 
  XCircle, 
  Bike, 
  Ban, 
  Printer, 
  Phone, 
  CreditCard, 
  Banknote, 
  QrCode 
} from 'lucide-react';
import styles from './styles.module.css';

interface OrderCardProps {
  order: Order;
  onUpdateStatus: (id: string, status: any) => void;
}

export default function OrderCard({ order, onUpdateStatus }: OrderCardProps) {
  
  const handlePrint = () => {
    alert(`🖨️ Imprimindo pedido #${order.id}\n\nCliente: ${order.customerName}\nTaxa: R$ ${order.deliveryFee.toFixed(2)}\nTotal: R$ ${order.total.toFixed(2)}`);
  };

  const getPaymentInfo = (method: PaymentMethod) => {
    switch (method) {
      case 'CREDIT_CARD': 
        return { label: 'Cartão de Crédito', icon: <CreditCard size={16} /> };
      case 'DEBIT_CARD': 
        return { label: 'Cartão de Débito', icon: <CreditCard size={16} /> };
      case 'PIX': 
        return { label: 'Pix', icon: <QrCode size={16} /> };
      case 'CASH': 
        return { label: 'Dinheiro', icon: <Banknote size={16} /> };
      default: 
        return { label: method, icon: <CreditCard size={16} /> };
    }
  };

  const paymentInfo = getPaymentInfo(order.paymentMethod);
  
  const renderActions = () => {
      switch (order.status) {
        case 'PENDING':
          return (
            <div className={styles.actions}>
              <button 
                className={`${styles.btn} ${styles.btnReject}`}
                onClick={() => onUpdateStatus(order.id, 'CANCELED')}
              >
                <XCircle size={18} /> Recusar
              </button>
              <button 
                className={`${styles.btn} ${styles.btnAccept}`}
                onClick={() => onUpdateStatus(order.id, 'PREPARING')}
              >
                <CheckCircle size={18} /> Aceitar
              </button>
            </div>
          );
        case 'PREPARING':
          return (
            <div className={styles.actions}>
              <button 
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => onUpdateStatus(order.id, 'CANCELED')}
              >
                <Ban size={18} /> Cancelar
              </button>
              <button 
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => onUpdateStatus(order.id, 'DELIVERING')}
              >
                <Bike size={18} /> Despachar
              </button>
            </div>
          );
        case 'DELIVERING':
          return (
            <div className={styles.actions}>
              <button 
                className={`${styles.btn} ${styles.btnSuccess}`}
                onClick={() => onUpdateStatus(order.id, 'COMPLETED')}
              >
                <CheckCircle size={18} /> Finalizar Entrega
              </button>
            </div>
          );
        default: 
          return null;
      }
  };

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <span className={styles.id}>{order.id}</span>
        <div className={styles.headerRight}>
          <button onClick={handlePrint} className={styles.printBtn} title="Reimprimir Pedido">
            <Printer size={16} />
          </button>
          <div className={styles.timeBadge}>
            <Clock size={14} />
            <span>{order.createdAt}</span>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.infoBlock}>
          <div className={styles.infoRow}>
            <User size={16} className={styles.icon} /> 
            <strong>{order.customerName}</strong>
          </div>
          <div className={styles.infoRow}>
            <Phone size={16} className={styles.icon} /> 
            <span>{order.customerPhone}</span>
          </div>
          <div className={styles.infoRow}>
            <MapPin size={16} className={styles.icon} /> 
            <span className={styles.address}>{order.customerAddress}</span>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.infoBlock}>
          <div className={styles.infoRow}>
              <span className={styles.icon}>{paymentInfo.icon}</span>
              <span className={styles.payment}>{paymentInfo.label}</span>
          </div>
          
          <ul className={styles.itemsList}>
            {order.items.map(item => (
              <li key={item.id}>
                <span className={styles.qty}>{item.quantity}x</span>
                <span className={styles.itemName}>{item.name}</span>
                {item.observation && (
                  <p className={styles.obs}>Obs: {item.observation}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.footer}>
        {/* Renderização da Taxa de Entrega */}
        <div className={styles.fee}>
            <span>Taxa de entrega:</span>
            <span>
                {order.deliveryFee > 0 
                  ? `R$ ${order.deliveryFee.toFixed(2)}` 
                  : 'Grátis'}
            </span>
        </div>

        <div className={styles.total}>
          <span>Total:</span> 
          <strong>R$ {order.total.toFixed(2)}</strong>
        </div>
        {renderActions()}
      </div>
    </article>
  );
}
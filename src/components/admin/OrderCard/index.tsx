import { useState } from 'react';
import { 
  Clock, MapPin, User, CheckCircle, XCircle, Printer, 
  CreditCard, DollarSign 
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import toast from 'react-hot-toast';
import { Order } from '@/types/order';
import styles from './styles.module.css'; // O CSS Module original

interface OrderCardProps {
  order: Order;
  onUpdateStatus?: (id: number, status: any) => void;
}

export default function OrderCard({ order, onUpdateStatus }: OrderCardProps) {
  const [loading, setLoading] = useState(false);

  // Formata moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formata data
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // --- LÓGICA DE IMPRESSÃO (Mantida a nova versão que funciona) ---
  const handlePrint = () => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // ... (Mantendo o mesmo HTML de impressão gerado anteriormente) ...
    const receiptContent = `
      <html>
        <head>
          <style>
            body { font-family: 'Courier New', monospace; width: 300px; font-size: 12px; margin: 0; padding: 10px; color: #000; }
            .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
            .title { font-size: 16px; font-weight: bold; }
            .info { font-size: 11px; margin-bottom: 5px; }
            .items { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .items th { text-align: left; border-bottom: 1px dashed #000; }
            .item-row td { padding: 4px 0; vertical-align: top; }
            .qty { width: 30px; font-weight: bold; }
            .price { text-align: right; }
            .total { border-top: 1px dashed #000; padding-top: 5px; font-weight: bold; font-size: 14px; text-align: right; }
            .footer { margin-top: 15px; text-align: center; font-size: 10px; }
            .obs { font-style: italic; font-size: 10px; margin-left: 30px; display: block; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">PEDIDO ${order.displayId}</div>
            <div class="info">${new Date().toLocaleDateString('pt-BR')} - ${formatTime(order.createdAt)}</div>
            <div class="info">Cliente: ${order.customerName}</div>
            <div class="info">Tel: ${order.customerPhone || 'N/A'}</div>
          </div>
          <table class="items">
            <thead>
              <tr><th>Qtd</th><th>Item</th><th style="text-align: right;">R$</th></tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr class="item-row">
                  <td class="qty">${item.quantity}x</td>
                  <td>${item.name}${item.observation ? `<br/><span class="obs">Obs: ${item.observation}</span>` : ''}</td>
                  <td class="price">${formatCurrency(item.totalPrice)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">TOTAL: ${formatCurrency(order.total)}</div>
          <div style="margin-top: 10px; font-size: 11px;">
            <strong>Pagamento:</strong> ${order.paymentMethod}<br/>
            <strong>Endereço:</strong> ${order.customerAddress}
          </div>
          <div class="footer">--- Fim do Pedido ---</div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(receiptContent);
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { document.body.removeChild(iframe); }, 1000);
    };
  };

  // --- LÓGICA DE STATUS ---
  const updateOrderStatus = async (newStatus: string) => {
    setLoading(true);
    if (onUpdateStatus) {
      await onUpdateStatus(order.id, newStatus);
      setLoading(false);
      return;
    }
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) throw error;
      toast.success(`Pedido atualizado!`);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao atualizar');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async () => {
    handlePrint();
    await updateOrderStatus('PREPARING');
  };

  const handleCancelOrder = async () => {
    if (window.confirm('Cancelar este pedido?')) {
      await updateOrderStatus('CANCELED');
    }
  };

  // Cores do Status (Mantivemos Tailwind APENAS para as cores do badge, já que o CSS não tem classes de status)
  const getStatusColor = (status: string) => {
    const colors: any = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      PREPARING: 'bg-blue-100 text-blue-800 border-blue-200',
      DELIVERING: 'bg-purple-100 text-purple-800 border-purple-200',
      COMPLETED: 'bg-gray-100 text-gray-800 border-gray-200',
      CANCELED: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className={styles.card}>
      {/* HEADER: ID, Status, Hora, Impressão */}
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className={styles.id}>{order.displayId}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getStatusColor(order.status)}`}>
            {order.status}
          </span>
        </div>
        
        <div className={styles.headerRight}>
          <div className={styles.timeBadge}>
            <Clock size={14} />
            {formatTime(order.createdAt)}
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); handlePrint(); }} 
            className={styles.printBtn} 
            title="Imprimir Cupom"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* CONTEÚDO: Cliente, Endereço, Itens */}
      <div className={styles.content}>
        <div className={styles.infoBlock}>
          <div className={styles.infoRow}>
            <User size={16} className={styles.icon} />
            <span>{order.customerName}</span>
          </div>
          {order.customerAddress && (
            <div className={styles.infoRow}>
              <MapPin size={16} className={styles.icon} />
              <span className={styles.address}>{order.customerAddress}</span>
            </div>
          )}
        </div>

        <div className={styles.divider} />

        <ul className={styles.itemsList}>
          {order.items.map((item, idx) => (
            <li key={item.id || idx} className={styles.infoRow} style={{ justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>{item.quantity}x</span>
                <div>
                  {item.name}
                  {item.observation && (
                    <span style={{ display: 'block', fontSize: '0.8em', color: '#71717a', fontStyle: 'italic' }}>
                      Obs: {item.observation}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontWeight: '600' }}>{formatCurrency(item.totalPrice)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* FOOTER: Totais e Ações */}
      <div className={styles.footer}>
        <div className={styles.fee}>
          <span>Taxa de Entrega</span>
          <span>{formatCurrency(order.deliveryFee)}</span>
        </div>
        
        <div className={styles.total}>
          <span>TOTAL</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
        
        <div className={styles.fee} style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {order.paymentMethod === 'CREDIT_CARD' ? <CreditCard size={14}/> : <DollarSign size={14}/>}
            <span style={{ fontWeight: '500' }}>{order.paymentMethod}</span>
          </div>
        </div>

        <div className={styles.actions}>
          {order.status === 'PENDING' && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); handleCancelOrder(); }} 
                disabled={loading}
                className={`${styles.btn} ${styles.btnReject}`}
              >
                <XCircle size={18} /> Recusar
              </button>
              
              <button 
                onClick={(e) => { e.stopPropagation(); handleAcceptOrder(); }} 
                disabled={loading}
                className={`${styles.btn} ${styles.btnAccept}`}
              >
                {loading ? '...' : <><CheckCircle size={18} /> Aceitar</>}
              </button>
            </>
          )}

          {order.status === 'PREPARING' && (
             <button 
               onClick={() => updateOrderStatus('DELIVERING')} 
               className={`${styles.btn} ${styles.btnPrimary}`} 
               style={{ gridColumn: 'span 2' }}
             >
               Saiu para Entrega
             </button>
          )}

          {order.status === 'DELIVERING' && (
             <button 
               onClick={() => updateOrderStatus('COMPLETED')} 
               className={`${styles.btn} ${styles.btnSuccess}`} 
             >
               Concluir Pedido
             </button>
          )}
        </div>
      </div>
    </div>
  );
}
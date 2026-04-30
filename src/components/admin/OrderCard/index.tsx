'use client';

import { useState } from 'react';
import { 
  Clock, MapPin, User, CheckCircle, XCircle, Printer, 
  CreditCard, DollarSign, Phone 
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import toast from 'react-hot-toast';
import { Order } from '@/types/order';
import styles from './styles.module.css';

interface OrderCardProps {
  order: Order;
  onUpdateStatus?: (id: number, status: any) => void;
}

export default function OrderCard({ order, onUpdateStatus }: OrderCardProps) {
  const [loading, setLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // BOTÃO DE REIMPRESSÃO MANUAL (Não mexemos aqui)
  const handlePrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'printer').single();
      if (!settingsData?.value?.printerName) {
        toast.error('Configure a impressora em Configurações');
        setIsPrinting(false);
        return;
      }
      const printerSettings = settingsData.value;
      const { printReceipt } = await import('@/utils/printReceipt');
      await printReceipt(order, printerSettings, 1);
      toast.success('Impresso com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao imprimir');
    } finally {
      setIsPrinting(false);
    }
  };

  // 🔥 O BOTÃO AGORA SÓ ATUALIZA O BANCO! O WebSocket lá no useAdminOrders faz o resto.
  const updateOrderStatus = async (newStatus: string) => {
    setLoading(true);
    if (onUpdateStatus) {
      await onUpdateStatus(order.id, newStatus);
      setLoading(false);
      return;
    }
    
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
      if (error) throw error;
      toast.success(`Pedido atualizado!`);
    } catch (error) {
      toast.error('Erro ao atualizar');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async () => {
    await updateOrderStatus('PREPARING');
  };

  const handleRejectOrder = async () => {
    if (!window.confirm('Tem certeza que deseja RECUSAR este pedido?')) return;
    await updateOrderStatus('CANCELED');
  };

  const handleCancelOrder = async () => {
    if (window.confirm('Cancelar este pedido?')) {
      await updateOrderStatus('CANCELED');
    }
  };

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
            disabled={isPrinting}
            className={styles.printBtn} 
            title={isPrinting ? "Imprimindo..." : "Reimprimir"}
            style={{ opacity: isPrinting ? 0.6 : 1, cursor: isPrinting ? 'not-allowed' : 'pointer' }}
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.infoBlock}>
          <div className={styles.infoRow}>
            <User size={16} className={styles.icon} />
            <span>{order.customerName}</span>
          </div>

          {order.customerPhone && (
            <div className={styles.infoRow}>
              <Phone size={16} className={styles.icon} />
              <span>{order.customerPhone}</span>
            </div>
          )}

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
            <button onClick={(e) => { e.stopPropagation(); handleRejectOrder(); }} disabled={loading} className={`${styles.btn} ${styles.btnReject}`}>
              <XCircle size={18} /> Recusar
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleAcceptOrder(); }} disabled={loading} className={`${styles.btn} ${styles.btnAccept}`}>
              {loading ? '...' : <><CheckCircle size={18} /> Aceitar</>}
            </button>
          </>
        )}

        {order.status === 'PREPARING' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); handleCancelOrder(); }} disabled={loading} className={`${styles.btn} ${styles.btnReject}`}>
              <XCircle size={18} /> Cancelar
            </button>
            <button onClick={() => updateOrderStatus('DELIVERING')} disabled={loading} className={`${styles.btn} ${styles.btnAccept}`}>
              Saiu para Entrega
            </button>
          </>
        )}

        {order.status === 'DELIVERING' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); handleCancelOrder(); }} disabled={loading} className={`${styles.btn} ${styles.btnReject}`}>
              <XCircle size={18} /> Cancelar
            </button>
            <button onClick={() => updateOrderStatus('COMPLETED')} disabled={loading} className={`${styles.btn} ${styles.btnSuccess}`}>
              <CheckCircle size={18} /> Concluir Pedido
            </button>
          </>
        )}

        {(order.status === 'COMPLETED' || order.status === 'CANCELED') && (
          <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.9rem', fontStyle: 'italic' }}>
            {order.status === 'COMPLETED' ? '✅ Pedido Concluído' : '❌ Pedido Cancelado'}
          </div>
        )}
      </div>

      </div>
    </div>
  );
}
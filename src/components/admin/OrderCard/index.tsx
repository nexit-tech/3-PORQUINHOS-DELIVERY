'use client';

import { useState } from 'react';
import { 
  Clock, MapPin, User, CheckCircle, XCircle, Printer, 
  CreditCard, DollarSign 
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
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // 🔥 IMPRESSÃO DIRETA (SEM printReceipt.ts)
  const handlePrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    
    try {
      console.log('🖨️ Iniciando impressão...');
      
      // 1. Busca a impressora do Supabase
      const { data: settingsData, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'printer')
        .single();

      if (error || !settingsData) {
        console.error('❌ Impressora não configurada:', error);
        toast.error('Configure a impressora em Configurações > Impressão');
        setIsPrinting(false);
        return;
      }

      const printerSettings = settingsData.value;
      console.log('✅ Configuração encontrada:', printerSettings);

      if (!printerSettings.printerName) {
        toast.error('Nome da impressora não definido!');
        setIsPrinting(false);
        return;
      }

      // 2. Gera o HTML da nota
      const is58mm = printerSettings.paperWidth === '58mm';
      const widthPx = is58mm ? '220px' : '302px';
      const fontSize = is58mm ? '11px' : '13px';

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Courier New', monospace; 
      width: ${widthPx};
      margin: 0 auto;
      padding: 10px 5px 20px 5px;
      font-size: ${fontSize};
      line-height: 1.5;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; margin: 3px 0; }
    .bold { font-weight: 800; }
    .big { font-size: 16px; font-weight: 800; }
    .line { border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 2px 0; }
    .item-name { text-align: left; padding-right: 5px; }
    .item-price { text-align: right; white-space: nowrap; font-weight: 700; }
    .obs { font-size: 10px; font-style: italic; display: block; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="center">
    <div class="big">3 PORQUINHOS</div>
    <div class="bold">DELIVERY</div>
    <div class="line"></div>
    <div>${new Date().toLocaleString('pt-BR')}</div>
    <div class="line"></div>
    <div>PEDIDO: <span class="big">${order.displayId}</span></div>
  </div>

  <div class="line"></div>
  <div class="bold">ITENS</div>
  <br/>

  <table>
    ${order.items.map(item => `
      <tr>
        <td class="item-name">
          <span class="bold">${item.quantity}x</span> ${item.name}
          ${item.observation ? `<span class="obs">${item.observation}</span>` : ''}
        </td>
        <td class="item-price">
          ${formatCurrency(item.totalPrice)}
        </td>
      </tr>
    `).join('')}
  </table>

  <div class="line"></div>
  <div class="bold">CLIENTE</div>
  <div>${order.customerName}</div>
  ${order.customerPhone ? `<div>Tel: ${order.customerPhone}</div>` : ''}

  <div class="line"></div>
  <div class="bold">ENTREGA</div>
  <div>${order.customerAddress}</div>

  <div class="line"></div>

  <table>
    <tr>
      <td>Subtotal:</td>
      <td class="item-price bold">${formatCurrency(order.total - order.deliveryFee)}</td>
    </tr>
    ${order.deliveryFee > 0 ? `
    <tr>
      <td>Taxa:</td>
      <td class="item-price bold">${formatCurrency(order.deliveryFee)}</td>
    </tr>
    ` : ''}
  </table>

  <div class="line"></div>

  <table>
    <tr>
      <td class="big">TOTAL:</td>
      <td class="item-price big">${formatCurrency(order.total)}</td>
    </tr>
  </table>

  <div class="line"></div>
  
  <div class="center" style="font-size: 10px; margin-top: 10px;">
    Obrigado pela preferência!<br/>
    www.3porquinhos.com.br
  </div>
  
  <br/><br/>
  <div class="center">.</div>
</body>
</html>
      `;

      // 3. Chama o Electron para imprimir
      if ((window as any).require) {
        const { ipcRenderer } = (window as any).require('electron');
        
        console.log('📤 Enviando para impressora:', printerSettings.printerName);
        
        await ipcRenderer.invoke('print-silent', { 
          content: html, 
          printerName: printerSettings.printerName, 
          width: printerSettings.paperWidth 
        });

        console.log('✅ Comando de impressão enviado!');
        toast.success('Impresso com sucesso!');
      } else {
        // Fallback: Abre em nova janela
        const w = window.open('', '_blank', 'width=400,height=600');
        if (w) {
          w.document.write(html);
          w.document.close();
          setTimeout(() => w.print(), 500);
        }
      }

    } catch (error: any) {
      console.error('❌ Erro fatal:', error);
      toast.error('Erro ao imprimir: ' + error.message);
    } finally {
      setIsPrinting(false);
    }
  };

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

  // 🔥 ACEITAR = MUDA STATUS + IMPRIME
  const handleAcceptOrder = async () => {
    try {
      await updateOrderStatus('PREPARING');
      setTimeout(() => handlePrint(), 500);
    } catch (error) {
      console.error('Erro ao aceitar:', error);
    }
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
          
          {/* 🔥 BOTÃO DE REIMPRIMIR */}
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              handlePrint(); 
            }} 
            disabled={isPrinting}
            className={styles.printBtn} 
            title={isPrinting ? "Imprimindo..." : "Reimprimir"}
            style={{ 
              opacity: isPrinting ? 0.6 : 1,
              cursor: isPrinting ? 'not-allowed' : 'pointer'
            }}
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
              <button 
                onClick={(e) => { e.stopPropagation(); handleCancelOrder(); }} 
                disabled={loading}
                className={`${styles.btn} ${styles.btnReject}`}
              >
                <XCircle size={18} /> Recusar
              </button>
              
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  handleAcceptOrder(); 
                }} 
                disabled={loading || isPrinting}
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
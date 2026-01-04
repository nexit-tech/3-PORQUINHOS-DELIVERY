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
// 🔥 IMPORTA AS NOTIFICAÇÕES
import { 
  notifyOrderAccepted, 
  notifyOrderRejected, 
  notifyOrderCanceled, 
  notifyOrderDelivering 
} from '@/services/notifications';

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
      const contentWidth = is58mm ? '50mm' : '72mm';
      const paddingRight = is58mm ? '6mm' : '8mm';
      const fontSize = is58mm ? '10px' : '12px';

      // Formatador manual de dinheiro
      const formatMoney = (val: any) => {
        if (val === null || val === undefined) return 'R$ 0,00';
        let num = typeof val === 'string' 
          ? parseFloat(val.replace(/[^\d.,-]/g, '').replace(',', '.')) 
          : Number(val);
        if (isNaN(num)) num = 0;
        const fixed = num.toFixed(2);
        const [inteiro, decimal] = fixed.split('.');
        const inteiroFormatado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `R$ ${inteiroFormatado},${decimal}`;
      };

      const id = String(order.id).slice(0, 8);
      const cliente = order.customerName.toUpperCase();
      const tel = order.customerPhone || '';
      const endereco = order.customerAddress || 'Retirada';
      
      const taxaEntregaNum = Number(order.deliveryFee || 0);
      const totalNum = Number(order.total || 0);
      const subtotalVal = totalNum - taxaEntregaNum;
      
      const total = formatMoney(totalNum);
      const subtotal = formatMoney(subtotalVal);
      const entrega = taxaEntregaNum > 0 ? formatMoney(taxaEntregaNum) : null;
      
      // Detecção de troco
      const metodoPagamento = order.paymentMethod || '';
      const isDinheiro = metodoPagamento.toLowerCase().includes('dinheiro') || metodoPagamento.toLowerCase().includes('cash');
      
      let trocoTexto = null;
      if (isDinheiro && metodoPagamento.includes('Troco')) {
        const match = metodoPagamento.match(/Troco para R\$\s*([\d,.]+)/i);
        if (match) {
          trocoTexto = `Troco para ${formatMoney(match[1])}`;
        } else if (metodoPagamento.includes('Sem troco')) {
          trocoTexto = 'Sem troco';
        }
      }
      
      const data = new Date().toLocaleString('pt-BR');

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page { margin: 0; size: auto; }
    
    body {
      width: ${contentWidth};
      margin: 0 auto;
      padding: 5mm 2mm 50mm ${paddingRight}; 
      font-family: 'Courier New', Courier, monospace;
      background: #fff;
      color: #000;
      font-weight: 700;
      font-size: ${fontSize};
      line-height: 1.25;
    }

    .center { text-align: center; }
    .left { text-align: left; }
    .right { text-align: right; }
    .bold { font-weight: 900; }
    
    .line { 
      border-top: 1px dashed #000; 
      margin: 5px 0; 
      width: 100%;
    }

    .wrap {
      white-space: pre-wrap !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      word-break: break-word !important;
      width: 100%;
      display: block;
      line-height: 1.35;
      max-width: 100%;
      overflow: hidden;
      text-overflow: clip;
    }

    table { 
      width: 100%; 
      border-collapse: collapse;
      table-layout: fixed; 
    }
    td { 
      vertical-align: top; 
      padding: 1px 0;
      overflow: hidden;
    }
    
    .col-qtd { width: 15%; white-space: nowrap; }
    .col-nome { 
      width: 55%; 
      padding-right: 3px;
      word-wrap: break-word;
      word-break: break-word;
      overflow: hidden;
    }
    .col-valor { 
      width: 30%; 
      text-align: right; 
      white-space: nowrap;
      padding-right: 2px;
    }

    .obs { 
      font-size: 0.85em; 
      font-weight: normal; 
      margin-top: 1px; 
      display: block;
      word-wrap: break-word;
    }
    
    .big { font-size: 1.2em; font-weight: 900; }

    .section {
      margin: 5px 0;
      max-width: 100%;
      overflow: hidden;
    }
    
    .label {
      font-weight: 900;
      margin-bottom: 2px;
      font-size: 0.95em;
    }
    
    .value {
      font-weight: 700;
      word-wrap: break-word;
      word-break: break-word;
      line-height: 1.35;
      max-width: 100%;
      overflow: hidden;
    }

    @media print {
      body { 
        margin: 0;
        padding-right: ${paddingRight} !important;
      }
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="big">3 PORQUINHOS</div>
    <div class="bold">DELIVERY</div>
    <div style="font-size: 0.75em; margin-top: 3px;">${data}</div>
    <div class="line"></div>
    <div>PEDIDO: <span class="big">#${id}</span></div>
  </div>
  
  <div class="line"></div>

  <div class="bold" style="margin-bottom: 3px; font-size: 0.9em;">ITENS</div>
  <table>
    ${order.items.map(item => `
      <tr>
        <td class="col-qtd bold">${item.quantity}x</td>
        <td class="col-nome">${item.name}${item.observation ? `<span class="obs">(${item.observation})</span>` : ''}</td>
        <td class="col-valor">${formatMoney(item.totalPrice)}</td>
      </tr>
    `).join('')}
  </table>

  <div class="line"></div>

  <table style="font-size: 0.95em;">
    <tr>
      <td class="left">Subtotal:</td>
      <td class="right" style="padding-right: 2px;">${subtotal}</td>
    </tr>
    ${entrega ? `
    <tr>
      <td class="left">Taxa:</td>
      <td class="right" style="padding-right: 2px;">${entrega}</td>
    </tr>` : ''}
    <tr style="font-size: 1.15em; font-weight: 900;">
      <td class="left" style="padding-top: 3px;">TOTAL:</td>
      <td class="right" style="padding-top: 3px; padding-right: 2px;">${total}</td>
    </tr>
  </table>

  <div class="line"></div>

  <div class="section">
    <div class="label">CLIENTE</div>
    <div class="value wrap">${cliente}</div>
    ${tel ? `<div class="value">${tel}</div>` : ''}
  </div>
  
  <div class="section">
    <div class="label">ENTREGA</div>
    <div class="value wrap">${endereco}</div>
  </div>

  <div class="line"></div>

  <div class="section">
    <div class="label">PAGAMENTO</div>
    <div class="value">${metodoPagamento.split(' - ')[0]}</div>
    ${trocoTexto ? `<div class="value" style="margin-top: 2px; font-size: 0.9em;">${trocoTexto}</div>` : ''}
  </div>

  <div class="line"></div>

  <div class="center" style="font-size: 0.75em; margin-top: 8px;">
    Obrigado!<br>
    www.3porquinhos.com.br
  </div>
  
  <br><br><br>
  <div style="opacity: 0;">.</div>
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

  // 🔥 ATUALIZA STATUS + NOTIFICA
  const updateOrderStatus = async (newStatus: string) => {
    setLoading(true);
    if (onUpdateStatus) {
      await onUpdateStatus(order.id, newStatus);
      
      // 🔥 ENVIA NOTIFICAÇÃO BASEADA NO STATUS
      try {
        if (newStatus === 'PREPARING') {
          await notifyOrderAccepted(order);
        } else if (newStatus === 'DELIVERING') {
          await notifyOrderDelivering(order);
        } else if (newStatus === 'CANCELED') {
          await notifyOrderCanceled(order);
        }
      } catch (error) {
        console.error('Erro ao enviar notificação:', error);
      }
      
      setLoading(false);
      return;
    }
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) throw error;
      
      // 🔥 ENVIA NOTIFICAÇÃO BASEADA NO STATUS
      if (newStatus === 'PREPARING') {
        await notifyOrderAccepted(order);
      } else if (newStatus === 'DELIVERING') {
        await notifyOrderDelivering(order);
      } else if (newStatus === 'CANCELED') {
        await notifyOrderCanceled(order);
      }
      
      toast.success(`Pedido atualizado!`);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao atualizar');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 ACEITAR = MUDA STATUS + IMPRIME + NOTIFICA
  const handleAcceptOrder = async () => {
    try {
      await updateOrderStatus('PREPARING');
      setTimeout(() => handlePrint(), 500);
    } catch (error) {
      console.error('Erro ao aceitar:', error);
    }
  };

  // 🔥 RECUSAR = MUDA STATUS + NOTIFICA
  const handleRejectOrder = async () => {
    if (!window.confirm('Tem certeza que deseja RECUSAR este pedido?')) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('orders')
        .update({ status: 'CANCELED' })
        .eq('id', order.id);

      if (error) throw error;
      
      // 🔥 ENVIA NOTIFICAÇÃO DE RECUSA
      await notifyOrderRejected(order);
      
      toast.success('Pedido recusado e cliente notificado!');
    } catch (error) {
      console.error('Erro ao recusar:', error);
      toast.error('Erro ao recusar pedido');
    } finally {
      setLoading(false);
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

          {/* 🔥 EXIBE O TELEFONE (NÚMERO DO LEAD) SE HOUVER */}
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
        {/* ESTÁGIO 1: PENDENTE */}
        {order.status === 'PENDING' && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); handleRejectOrder(); }} 
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

        {/* ESTÁGIO 2: EM PREPARO (COZINHA) */}
        {order.status === 'PREPARING' && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); handleCancelOrder(); }} 
              disabled={loading}
              className={`${styles.btn} ${styles.btnReject}`}
            >
              <XCircle size={18} /> Cancelar
            </button>
            
            <button 
              onClick={() => updateOrderStatus('DELIVERING')} 
              disabled={loading}
              className={`${styles.btn} ${styles.btnAccept}`}
            >
              Saiu para Entrega
            </button>
          </>
        )}

        {/* ESTÁGIO 3: EM ROTA (ENTREGA) */}
        {order.status === 'DELIVERING' && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); handleCancelOrder(); }} 
              disabled={loading}
              className={`${styles.btn} ${styles.btnReject}`}
            >
              <XCircle size={18} /> Cancelar
            </button>
            
            <button 
              onClick={() => updateOrderStatus('COMPLETED')} 
              disabled={loading}
              className={`${styles.btn} ${styles.btnSuccess}`}
            >
              <CheckCircle size={18} /> Concluir Pedido
            </button>
          </>
        )}

        {/* ESTÁGIOS FINAIS: SEM AÇÕES */}
        {(order.status === 'COMPLETED' || order.status === 'CANCELED') && (
          <div style={{ 
            padding: '12px', 
            textAlign: 'center', 
            color: 'var(--text-light)', 
            fontSize: '0.9rem',
            fontStyle: 'italic' 
          }}>
            {order.status === 'COMPLETED' ? '✅ Pedido Concluído' : '❌ Pedido Cancelado'}
          </div>
        )}
      </div>

      </div>
    </div>
  );
}
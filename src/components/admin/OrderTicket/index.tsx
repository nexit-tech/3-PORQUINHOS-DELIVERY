import React, { forwardRef } from 'react';
import { Order } from '@/types/order';

interface OrderTicketProps {
  order: Order;
}

export const OrderTicket = forwardRef<HTMLDivElement, OrderTicketProps>(({ order }, ref) => {
  
  const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  // Usa o createdAt que já é string ou converte se necessário. No hook está vindo como string timestamp.
  const date = new Date(order.createdAt).toLocaleString('pt-BR');

  const getPaymentLabel = () => {
    switch(order.paymentMethod) {
      case 'PIX': return 'PIX';
      case 'CREDIT_CARD': return 'Cartão de Crédito';
      case 'DEBIT_CARD': return 'Cartão de Débito';
      case 'CASH': return 'Dinheiro';
      default: return order.paymentMethod;
    }
  };

  return (
    <div style={{ display: 'none' }}>
      <div ref={ref} className="print-content">
        <style type="text/css" media="print">
          {`
            @page { 
              size: 80mm auto;
              margin: 0mm;
            }
            html, body {
              width: 80mm;
              margin: 0 !important;
              padding: 0 !important;
            }
            .print-content {
              width: 100%;
              padding: 5px;
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              color: #000;
              background: #fff;
            }
            .divider { border-bottom: 1px dashed #000; margin: 5px 0; width: 100%; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; }
            td, th { vertical-align: top; padding: 2px 0; }
          `}
        </style>

        <div className="text-center">
          <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>3 PORQUINHOS</h1>
          <div>{order.code || order.id}</div>
          <div style={{ fontSize: '10px' }}>{date}</div>
        </div>

        <div className="divider" />

        <div style={{ fontSize: '14px' }} className="font-bold">{order.customerName}</div>
        <div>Tel: {order.customerPhone || 'Não inf.'}</div>
        <div style={{ marginTop: '5px' }}>
          <span className="font-bold">Entrega: </span>
          {order.type === 'pickup' ? 'RETIRADA' : (order.customerAddress || 'Balcão')}
        </div>

        <div className="divider" />

        <table>
          <thead>
            <tr style={{ borderBottom: '1px dashed #000' }}>
              <th style={{ width: '30px' }}>Qtd</th>
              <th style={{ textAlign: 'left' }}>Item</th>
              <th style={{ textAlign: 'right' }}>R$</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="font-bold">{item.quantity}x</td>
                <td>
                  <div>{item.name}</div>
                  {item.observation && (
                    <div style={{ fontSize: '10px', fontStyle: 'italic' }}>({item.observation})</div>
                  )}
                </td>
                <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                  {formatMoney(item.price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divider" />

        <div className="text-right">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal:</span>
            <span>{formatMoney(order.total - (order.deliveryFee || 0))}</span>
          </div>
          {order.deliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Entrega:</span>
              <span>{formatMoney(order.deliveryFee)}</span>
            </div>
          )}
          {order.change && order.change > 0 && (
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span>Troco:</span>
               <span>{formatMoney(order.change)}</span>
             </div>
          )}
          
          <div className="divider" />
          
          <div style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            <span>TOTAL:</span>
            <span>{formatMoney(order.total)}</span>
          </div>
        </div>

        <div style={{ marginTop: '10px', fontSize: '11px' }}>
          <strong>Pagamento:</strong> {getPaymentLabel()}
        </div>
        
        <div className="text-center" style={{ marginTop: '20px', paddingBottom: '20px' }}>
          www.3porquinhos.com.br
          <br />.
        </div>
      </div>
    </div>
  );
});

OrderTicket.displayName = 'OrderTicket';
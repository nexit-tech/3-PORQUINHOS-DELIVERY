import React, { forwardRef } from 'react';
import { Order } from '@/types/order';

interface OrderTicketProps {
  order: Order;
}

export const OrderTicket = forwardRef<HTMLDivElement, OrderTicketProps>(({ order }, ref) => {
  // 1. TRUQUE PARA O TYPESCRIPT NÃO RECLAMAR
  // Convertemos para 'any' para acessar campos que podem vir do banco mas não estão no Type oficial
  const safeOrder = order as any;

  const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  
  // Tratamento de data seguro
  const date = safeOrder.createdAt 
    ? new Date(safeOrder.createdAt).toLocaleString('pt-BR') 
    : new Date().toLocaleString('pt-BR');

  // Ajuste para usar displayId (que vem do Hook) ou o id
  const displayId = safeOrder.displayId || safeOrder.code || `#${safeOrder.id}`;

  const getPaymentLabel = () => {
    switch(safeOrder.paymentMethod) {
      case 'PIX': return 'PIX';
      case 'CREDIT_CARD': return 'Cartão de Crédito';
      case 'DEBIT_CARD': return 'Cartão de Débito';
      case 'CASH': return 'Dinheiro';
      default: return safeOrder.paymentMethod || 'Outros';
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
              background-color: #fff !important;
              -webkit-print-color-adjust: exact;
            }
            .print-content {
              width: 100%;
              padding: 5px;
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              color: #000 !important;
              background: #fff !important;
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
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{displayId}</div>
          <div style={{ fontSize: '10px' }}>{date}</div>
        </div>

        <div className="divider" />

        <div style={{ fontSize: '14px' }} className="font-bold">{safeOrder.customerName}</div>
        <div>Tel: {safeOrder.customerPhone || 'Não inf.'}</div>
        
        <div style={{ marginTop: '5px' }}>
          <span className="font-bold">Entrega: </span>
          {/* Se tiver customerAddress é entrega, senão assume retirada/balcão */}
          {safeOrder.customerAddress ? safeOrder.customerAddress : 'RETIRADA / BALCÃO'}
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
            {(safeOrder.items || []).map((item: any, idx: number) => {
              // CORREÇÃO CRÍTICA: O Hook manda unitPrice, não price.
              const price = item.unitPrice || item.price || 0;
              const total = price * (item.quantity || 1);
              
              return (
                <tr key={item.id || idx}>
                  <td className="font-bold">{item.quantity}x</td>
                  <td>
                    <div>{item.name}</div>
                    {item.observation && (
                      <div style={{ fontSize: '10px', fontStyle: 'italic' }}>({item.observation})</div>
                    )}
                  </td>
                  <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                    {formatMoney(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="divider" />

        <div className="text-right">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal:</span>
            <span>{formatMoney(safeOrder.total - (safeOrder.deliveryFee || 0))}</span>
          </div>
          
          {(safeOrder.deliveryFee > 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Entrega:</span>
              <span>{formatMoney(safeOrder.deliveryFee)}</span>
            </div>
          )}

          {/* Uso do safeOrder para acessar 'change' sem erro de TS */}
          {safeOrder.change && safeOrder.change > 0 && (
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span>Troco:</span>
               <span>{formatMoney(safeOrder.change)}</span>
             </div>
          )}
          
          <div className="divider" />
          
          <div style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            <span>TOTAL:</span>
            <span>{formatMoney(safeOrder.total)}</span>
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
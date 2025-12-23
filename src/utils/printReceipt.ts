import { PrinterSettings } from "@/types/settings";

export const printReceipt = async (order: any, settings: PrinterSettings, copies: number = 1) => {
  console.log('🖨️ printReceipt chamado');
  console.log('📋 Settings recebido:', settings);
  console.log('📦 Order recebido:', order);

  const is58mm = settings?.paperWidth === '58mm';
  
  // Dados do pedido
  const id = String(order.id || '???').slice(0, 8);
  const cliente = (order.customer_name || order.customerName || 'CLIENTE').toUpperCase();
  const tel = order.customer_phone || order.customerPhone || '';
  const endereco = order.customer_address || order.customerAddress || 'Retirada';
  
  const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(val);
  
  const total = formatMoney(order.total || 0);
  const subtotal = formatMoney(
    order.subtotal || 
    (order.total - (order.delivery_fee || order.deliveryFee || 0)) || 
    0
  );
  const entrega = (order.delivery_fee || order.deliveryFee) 
    ? formatMoney(order.delivery_fee || order.deliveryFee) 
    : null;
  const data = new Date().toLocaleString('pt-BR');

  const items = order.items || order.order_items || [];

  // HTML (MANTIDO IGUAL)
  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        @page {
          size: ${is58mm ? '58mm' : '80mm'} auto;
          margin: 0;
        }

        body {
          width: ${is58mm ? '58mm' : '80mm'};
          margin: 0 auto;
          padding: 10px 5px 20px 5px;
          font-family: 'Courier New', Courier, monospace;
          font-size: ${is58mm ? '12px' : '14px'};
          line-height: 1.5;
          color: #000;
          background: #fff;
          font-weight: 600;
        }

        .center { text-align: center; margin: 3px 0; }
        .left { text-align: left; }
        .right { text-align: right; }
        .bold { font-weight: 800; }
        .big { font-size: ${is58mm ? '16px' : '18px'}; font-weight: 800; letter-spacing: 1px; }
        .line { border: none; border-top: 1px dashed #000; margin: 5px 0; height: 0; }
        .spacer { height: 4px; display: block; }

        table { width: 100%; border-collapse: collapse; }
        tr { page-break-inside: avoid; }

        .item-row td { padding: 3px 0; vertical-align: top; }
        .item-name { width: 60%; word-wrap: break-word; padding-right: 5px; font-weight: 600; }
        .item-price { width: 40%; text-align: right; white-space: nowrap; font-weight: 700; }

        .obs {
          font-size: ${is58mm ? '10px' : '12px'};
          font-style: italic;
          display: block;
          margin-top: 2px;
          padding-left: 5px;
          line-height: 1.3;
          font-weight: 500;
        }

        .total-row { font-size: ${is58mm ? '14px' : '16px'}; font-weight: 800; padding: 4px 0; }
        .footer { margin-top: 10px; font-size: ${is58mm ? '10px' : '11px'}; text-align: center; line-height: 1.4; font-weight: 500; }

        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          * { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="spacer"></div>
      <div class="center">
        <div class="big">3 PORQUINHOS</div>
        <div class="bold">DELIVERY</div>
        <div class="line"></div>
        <div>${data}</div>
        <div class="line"></div>
        <div>PEDIDO: <span class="big">#${id}</span></div>
      </div>
      <div class="line"></div>
      <div class="bold">ITENS</div>
      <div class="spacer"></div>
      <table>
        ${items.map((item: any) => {
          const itemName = item.product_name || item.name || item.product?.name || 'Item';
          const itemQty = item.quantity || 1;
          const itemPrice = item.total_price || ((item.unit_price || item.price || 0) * itemQty);
          const obs = item.observation || '';
          return `
            <tr class="item-row">
              <td class="item-name">
                <span class="bold">${itemQty}x</span> ${itemName}
                ${obs ? `<span class="obs">${obs}</span>` : ''}
              </td>
              <td class="item-price">${formatMoney(itemPrice)}</td>
            </tr>
          `;
        }).join('')}
      </table>
      <div class="line"></div>
      <div class="bold">CLIENTE</div>
      <div>${cliente}</div>
      ${tel ? `<div>Tel: ${tel}</div>` : ''}
      <div class="line"></div>
      <div class="bold">ENTREGA</div>
      <div style="line-height: 1.4;">${endereco}</div>
      <div class="line"></div>
      <table>
        <tr>
          <td class="left">Subtotal:</td>
          <td class="right bold">${subtotal}</td>
        </tr>
        ${entrega ? `<tr><td class="left">Taxa:</td><td class="right bold">${entrega}</td></tr>` : ''}
      </table>
      <div class="line"></div>
      <table>
        <tr class="total-row">
          <td class="left">TOTAL:</td>
          <td class="right">${total}</td>
        </tr>
      </table>
      <div class="line"></div>
      <div class="footer">
        Obrigado pela preferencia!<br>
        www.3porquinhos.com.br
      </div>
      <div class="spacer"></div>
      <div class="spacer"></div>
      <div class="spacer"></div>
      <div class="spacer"></div>
    </body>
    </html>
  `;

  // 🔥 IMPRESSÃO COM VALIDAÇÃO E LOGS
  if (typeof window !== 'undefined' && (window as any).require) {
    try {
      const { ipcRenderer } = (window as any).require('electron');
      
      console.log(`🖨️ Enviando para impressora: ${settings.printerName || 'Padrão'}`);
      console.log(`📏 Largura: ${settings.paperWidth || '80mm'}`);
      
      for (let i = 0; i < copies; i++) {
        console.log(`📄 Imprimindo cópia ${i + 1}/${copies}...`);
        
        const result = await ipcRenderer.invoke('print-silent', { 
          content, 
          printerName: settings.printerName, 
          width: settings.paperWidth || '80mm'
        });
        
        console.log(`✅ Resultado da impressão:`, result);
        
        if (i < copies - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log('✅ Todas as cópias enviadas!');
      return true;
      
    } catch (e: any) {
      console.error("❌ Erro no Electron:", e);
      console.error("❌ Stack:", e.stack);
      return false;
    }
  } else {
    console.warn('⚠️ Electron não disponível, usando fallback do navegador');
    
    // Fallback navegador
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
    return true;
  }
};
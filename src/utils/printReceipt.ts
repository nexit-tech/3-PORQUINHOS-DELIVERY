import { PrinterSettings } from "@/types/settings";

export const printReceipt = async (order: any, settings: PrinterSettings, copies: number = 1) => {
  // Configuração segura de largura (48mm é a área útil real de impressoras 58mm)
  const is58mm = settings?.paperWidth === '58mm';
  const contentWidth = is58mm ? '46mm' : '72mm'; // Margem de segurança maior
  const fontSize = is58mm ? '11px' : '13px'; // Fonte levemente menor para caber mais

  // --- CORREÇÃO 1: Formatador de Dinheiro "A prova de falhas" ---
  const formatMoney = (val: any) => {
    if (val === null || val === undefined) return 'R$ 0,00';
    
    // Converte para número, limpando caracteres estranhos se for string
    let num = typeof val === 'string' 
      ? parseFloat(val.replace(/[^\d.,-]/g, '').replace(',', '.')) 
      : Number(val);
      
    if (isNaN(num)) num = 0;

    return num.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  };

  // Tratamento de dados
  const id = String(order.id || '???').slice(0, 8);
  const cliente = (order.customer_name || order.customerName || 'CLIENTE').toUpperCase();
  const tel = order.customer_phone || order.customerPhone || '';
  const endereco = order.customer_address || order.customerAddress || 'Retirada';
  
  const total = formatMoney(order.total);
  // Cálculo seguro do subtotal e entrega
  const taxaEntregaNum = Number(order.delivery_fee || order.deliveryFee || 0);
  const subtotalVal = order.subtotal ? order.subtotal : (Number(order.total || 0) - taxaEntregaNum);
  const subtotal = formatMoney(subtotalVal);
  const entrega = taxaEntregaNum > 0 ? formatMoney(taxaEntregaNum) : null;
  
  const data = new Date().toLocaleString('pt-BR');
  const items = order.items || order.order_items || [];

  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        /* Reset total */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          width: ${contentWidth}; /* Largura travada na área útil */
          margin: 0 auto; /* Centraliza */
          padding: 5px 0 50px 0; /* Espaço embaixo pro corte */
          font-family: 'Courier New', Courier, monospace;
          background: #fff;
          color: #000;
          font-weight: 700;
          font-size: ${fontSize};
        }

        /* Classes Utilitárias */
        .center { text-align: center; }
        .left { text-align: left; }
        .right { text-align: right; }
        .bold { font-weight: 900; }
        
        /* Linha divisória simples */
        .line { 
          border-top: 1px dashed #000; 
          margin: 6px 0; 
          width: 100%;
        }

        /* --- CORREÇÃO 2: Quebra de Linha Forçada para Endereço --- */
        .wrap-text {
          white-space: normal !important;
          word-wrap: break-word !important;
          overflow-wrap: anywhere !important; /* Força quebra em qualquer lugar */
          width: 100%;
          display: block;
          line-height: 1.3;
        }

        /* Tabela de Itens */
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        td { vertical-align: top; padding: 2px 0; }
        
        .col-qtd { width: 15%; white-space: nowrap; }
        .col-nome { width: 55%; padding-right: 5px; }
        .col-valor { width: 30%; text-align: right; white-space: nowrap; }

        .obs { font-size: 0.9em; font-weight: normal; margin-top: 2px; display: block; }
        .big { font-size: 1.3em; font-weight: 900; }

        @media print {
          @page { margin: 0; size: auto; }
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="big">3 PORQUINHOS</div>
        <div class="bold">DELIVERY</div>
        <div style="font-size: 0.8em; margin-top: 4px;">${data}</div>
        <div class="line"></div>
        <div>PEDIDO: <span class="big">#${id}</span></div>
      </div>
      
      <div class="line"></div>

      <div class="bold" style="margin-bottom: 4px;">ITENS</div>
      <table>
        ${items.map((item: any) => {
          const nome = item.product_name || item.name || item.product?.name || 'Item';
          const qtd = item.quantity || 1;
          const preco = item.total_price || ((item.unit_price || item.price || 0) * qtd);
          const obs = item.observation;
          
          return `
            <tr>
              <td class="col-qtd bold">${qtd}x</td>
              <td class="col-nome wrap-text">
                ${nome}
                ${obs ? `<span class="obs">(${obs})</span>` : ''}
              </td>
              <td class="col-valor">${formatMoney(preco)}</td>
            </tr>
          `;
        }).join('')}
      </table>

      <div class="line"></div>

      <table>
        <tr>
          <td class="left">Subtotal:</td>
          <td class="right">${subtotal}</td>
        </tr>
        ${entrega ? `
        <tr>
          <td class="left">Taxa Entrega:</td>
          <td class="right">${entrega}</td>
        </tr>` : ''}
        <tr style="font-size: 1.2em; font-weight: 900;">
          <td class="left" style="padding-top: 4px;">TOTAL:</td>
          <td class="right" style="padding-top: 4px;">${total}</td>
        </tr>
      </table>

      <div class="line"></div>

      <div class="bold">CLIENTE</div>
      <div class="wrap-text">${cliente}</div>
      ${tel ? `<div>${tel}</div>` : ''}
      
      <div style="margin-top: 8px;" class="bold">ENTREGA</div>
      <div class="wrap-text">${endereco}</div>

      <div class="line"></div>

      <div class="center" style="font-size: 0.8em; margin-top: 10px;">
        Obrigado pela preferência!<br>
        www.3porquinhos.com.br
      </div>
      
      <br><br><br><br>
      <div style="opacity: 0;">.</div>
    </body>
    </html>
  `;

  // --- Lógica de Impressão (Electron/Browser) ---
  if (typeof window !== 'undefined' && (window as any).require) {
    try {
      const { ipcRenderer } = (window as any).require('electron');
      for (let i = 0; i < copies; i++) {
        await ipcRenderer.invoke('print-silent', { 
          content, 
          printerName: settings.printerName, 
          width: settings.paperWidth || '80mm'
        });
        if (i < copies - 1) await new Promise(r => setTimeout(r, 1000));
      }
      return true;
    } catch (e) {
      console.error("Erro Electron:", e);
      return false;
    }
  } else {
    // Fallback para navegador
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
    return true;
  }
};
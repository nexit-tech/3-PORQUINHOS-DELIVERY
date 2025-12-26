import { PrinterSettings } from "@/types/settings";

export const printReceipt = async (order: any, settings: PrinterSettings, copies: number = 1) => {
  // CORREÇÃO: Largura MUITO mais conservadora + padding direito generoso
  const is58mm = settings?.paperWidth === '58mm';
  const contentWidth = is58mm ? '50mm' : '72mm'; // Largura nominal
  const paddingRight = is58mm ? '6mm' : '8mm'; // MARGEM DIREITA GRANDE
  const fontSize = is58mm ? '10px' : '12px';

  // Formatador de dinheiro manual
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

  // Tratamento de dados
  const id = String(order.id || '???').slice(0, 8);
  const cliente = (order.customer_name || order.customerName || 'CLIENTE').toUpperCase();
  const tel = order.customer_phone || order.customerPhone || '';
  const endereco = order.customer_address || order.customerAddress || 'Retirada';
  
  const taxaEntregaNum = Number(order.delivery_fee || order.deliveryFee || 0);
  const totalNum = Number(order.total || 0);
  const subtotalVal = totalNum - taxaEntregaNum;
  
  const total = formatMoney(totalNum);
  const subtotal = formatMoney(subtotalVal);
  const entrega = taxaEntregaNum > 0 ? formatMoney(taxaEntregaNum) : null;
  
  // Detecção de troco
  const metodoPagamento = order.payment_method || order.paymentMethod || '';
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
  const items = order.items || order.order_items || [];

  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @page {
          margin: 0;
          size: auto;
        }
        
        body {
          width: ${contentWidth};
          margin: 0 auto;
          /* CORREÇÃO CRÍTICA: Padding direito GENEROSO */
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

        /* Quebra de linha agressiva */
        .wrap {
          white-space: pre-wrap !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          word-break: break-word !important;
          width: 100%;
          display: block;
          line-height: 1.35;
          max-width: 100%;
          /* NOVO: Evita ultrapassar a borda */
          overflow: hidden;
          text-overflow: clip;
        }

        /* Tabela */
        table { 
          width: 100%; 
          border-collapse: collapse;
          table-layout: fixed; 
        }
        td { 
          vertical-align: top; 
          padding: 1px 0;
          overflow: hidden; /* Evita vazamento */
        }
        
        .col-qtd { 
          width: 15%; 
          white-space: nowrap; 
        }
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
          padding-right: 2px; /* Pequeno afastamento da borda */
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
          /* NOVO: Garante que não vaza */
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
      <!-- CABEÇALHO -->
      <div class="center">
        <div class="big">3 PORQUINHOS</div>
        <div class="bold">DELIVERY</div>
        <div style="font-size: 0.75em; margin-top: 3px;">${data}</div>
        <div class="line"></div>
        <div>PEDIDO: <span class="big">#${id}</span></div>
      </div>
      
      <div class="line"></div>

      <!-- ITENS -->
      <div class="bold" style="margin-bottom: 3px; font-size: 0.9em;">ITENS</div>
      <table>
        ${items.map((item: any) => {
          const nome = item.product_name || item.name || item.product?.name || 'Item';
          const qtd = item.quantity || 1;
          const preco = item.total_price || ((item.unit_price || item.price || 0) * qtd);
          const obs = item.observation;
          
          return `
            <tr>
              <td class="col-qtd bold">${qtd}x</td>
              <td class="col-nome">${nome}${obs ? `<span class="obs">(${obs})</span>` : ''}</td>
              <td class="col-valor">${formatMoney(preco)}</td>
            </tr>
          `;
        }).join('')}
      </table>

      <div class="line"></div>

      <!-- TOTAIS -->
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

      <!-- CLIENTE -->
      <div class="section">
        <div class="label">CLIENTE</div>
        <div class="value wrap">${cliente}</div>
        ${tel ? `<div class="value">${tel}</div>` : ''}
      </div>
      
      <!-- ENDEREÇO -->
      <div class="section">
        <div class="label">ENTREGA</div>
        <div class="value wrap">${endereco}</div>
      </div>

      <div class="line"></div>

      <!-- PAGAMENTO -->
      <div class="section">
        <div class="label">PAGAMENTO</div>
        <div class="value">${metodoPagamento.split(' - ')[0]}</div>
        ${trocoTexto ? `<div class="value" style="margin-top: 2px; font-size: 0.9em;">${trocoTexto}</div>` : ''}
      </div>

      <div class="line"></div>

      <!-- RODAPÉ -->
      <div class="center" style="font-size: 0.75em; margin-top: 8px;">
        Obrigado!<br>
        www.3porquinhos.com.br
      </div>
      
      <br><br><br>
      <div style="opacity: 0;">.</div>
    </body>
    </html>
  `;

  // Impressão
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
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
    return true;
  }
};
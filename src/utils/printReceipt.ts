import { PrinterSettings } from "@/types/settings";

export const printReceipt = async (order: any, settings: PrinterSettings, copies: number = 1) => {
  // --- PREPARAÇÃO DOS DADOS ---
  const is58mm = settings?.paperWidth === '58mm';
  
  // --- LARGURA BLINDADA (EM PIXELS) ---
  // 58mm = ~226px total. Usamos 210px para ter margem de segurança.
  // 80mm = ~302px total. Usamos 280px para ter margem de segurança.
  const widthPx = is58mm ? '180px' : '280px'; 
  const fontSize = is58mm ? '11px' : '12px';

  const id = String(order.id || '???').slice(0, 8);
  const cliente = (order.customerName || order.customer?.name || 'CLIENTE').toUpperCase();
  const tel = order.customerPhone || order.customer?.phone || '';
  const endereco = order.customerAddress || order.address?.street || 'Retirada';
  
  const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const total = formatMoney(order.total || 0);
  const subtotal = formatMoney(order.subtotal || order.items?.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0) || 0);
  const entrega = order.deliveryFee ? formatMoney(order.deliveryFee) : null;
  const data = new Date().toLocaleString('pt-BR');

  // --- HTML CLÁSSICO (TABELAS) ---
  // Usamos tabelas porque elas não "quebram" nem somem em impressoras térmicas.
  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        /* Reseta tudo */
        * { box-sizing: border-box; }
        
        body { 
          margin: 0; 
          padding: 0; 
          background-color: #fff; 
          font-family: 'Courier New', monospace; /* Fonte de recibo */
        }

        /* O CONTAINER MÁGICO */
        .page {
          width: ${widthPx}; /* Largura TRAVADA */
          padding: 5px 0 20px 0; /* Margem em cima e em baixo */
          margin: 0 auto; /* Centraliza se o papel for maior, mas mantém a largura */
          font-size: ${fontSize};
          line-height: 1.2;
          color: #000;
        }

        .center { text-align: center; }
        .left { text-align: left; }
        .right { text-align: right; }
        
        .bold { font-weight: bold; }
        .big { font-size: 14px; font-weight: bold; }
        
        /* Tracejado */
        .line { 
          border-top: 1px dashed #000; 
          width: 100%; 
          margin: 5px 0;
        }

        /* TABELA DE ITENS (A solução para esquerda/direita) */
        table { width: 100%; border-collapse: collapse; }
        td { vertical-align: top; }
        
        /* Coluna do Item: Pega todo o espaço possível */
        .col-name { text-align: left; padding-right: 5px; }
        
        /* Coluna do Preço: Não quebra linha (nowrap) */
        .col-price { text-align: right; white-space: nowrap; width: 1%; }

        .obs { font-size: 10px; font-style: italic; display: block; margin-top: 2px; }
      </style>
    </head>
    <body>
      <div class="page">
        
        <br />

        <div class="center">
          <div class="big">CONSUMO NO LOCAL</div>
          <div class="line"></div>
          <div>${data}</div>
          <div class="bold">3 Porquinhos Delivery</div>
          <div class="line"></div>
          <div>PEDIDO: <span class="big">#${id}</span></div>
        </div>

        <div class="line"></div>
        <div class="bold" style="margin-bottom: 5px;">ITENS</div>

        <table>
          ${(order.items || []).map((item: any) => `
            <tr>
              <td class="col-name">
                ${item.quantity || 1}x ${(item.name || item.product?.name || 'Item')}
                ${item.observation ? `<span class="obs">- ${item.observation}</span>` : ''}
                ${item.adicionais ? `<span class="obs">+ ${item.adicionais}</span>` : ''}
              </td>
              <td class="col-price">
                ${formatMoney((item.price || item.unitPrice || 0) * (item.quantity || 1))}
              </td>
            </tr>
            <tr><td colspan="2" style="height: 5px;"></td></tr>
          `).join('')}
        </table>

        <div class="line"></div>
        <div><span class="bold">CLIENTE:</span> ${cliente}</div>
        ${tel ? `<div>Tel: ${tel}</div>` : ''}

        <div class="line"></div>
        <div class="bold">ENTREGA:</div>
        <div>${endereco}</div>

        <div class="line"></div>
        
        <table>
          <tr>
            <td class="col-name">Subtotal:</td>
            <td class="col-price">${subtotal}</td>
          </tr>
          ${entrega ? `
          <tr>
            <td class="col-name">Taxa Entrega:</td>
            <td class="col-price">${entrega}</td>
          </tr>
          ` : ''}
        </table>

        <div class="line"></div>

        <table>
          <tr>
            <td class="col-name big">TOTAL:</td>
            <td class="col-price big">${total}</td>
          </tr>
        </table>

        <div class="line"></div>
        
        <div class="center" style="font-size: 10px; margin-top: 10px;">
          www.3porquinhos.com.br
          <br/>Powered by Anota AI
        </div>
        
        <br/><br/>
        <div class="center">.</div>
      </div>
    </body>
    </html>
  `;

  // --- ENVIO ---
  if (typeof window !== 'undefined' && (window as any).require) {
    try {
      const { ipcRenderer } = (window as any).require('electron');
      await ipcRenderer.invoke('print-silent', { 
        content, 
        printerName: settings?.printerName, 
        width: settings?.paperWidth || '80mm'
      });
    } catch (e) {
      console.error("Erro print:", e);
    }
  } else {
    // Fallback navegador
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if(doc) {
      doc.open(); doc.write(content); doc.close();
      setTimeout(() => iframe.contentWindow?.print(), 500);
    }
  }
};
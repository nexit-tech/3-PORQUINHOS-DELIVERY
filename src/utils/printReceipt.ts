import { Order } from "@/types/order";

export const printReceipt = (order: Order, copies: number = 1) => {
  // Formata moeda
  const formatMoney = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Formata Data
  const date = new Date().toLocaleString('pt-BR');

  // Conteúdo do Cupom HTML
  const content = `
    <html>
      <head>
        <title>Pedido #${order.id}</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body { 
            font-family: 'Courier New', monospace; 
            width: 80mm; 
            margin: 0; 
            padding: 10px;
            font-size: 12px;
            color: black;
          }
          .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          .title { font-size: 16px; font-weight: bold; }
          .info { margin-bottom: 5px; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .total { font-size: 14px; font-weight: bold; text-align: right; margin-top: 10px; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">3 PORQUINHOS</div>
          <div>Delivery App</div>
          <div>${date}</div>
        </div>

        <div class="info">
          <strong>PEDIDO #${order.id.slice(0, 8)}</strong><br/>
          <strong>Cliente:</strong> ${order.customer.name}<br/>
          <strong>Tel:</strong> ${order.customer.phone}
        </div>

        <div class="divider"></div>

        <div class="info">
          <strong>ENTREGA:</strong><br/>
          ${order.address.street}, ${order.address.number}<br/>
          ${order.address.neighborhood} - ${order.address.city}<br/>
          ${order.address.complement ? `Comp: ${order.address.complement}` : ''}
        </div>

        <div class="divider"></div>

        <div>
          ${order.items.map(item => `
            <div class="item">
              <span>${item.quantity}x ${item.product.name}</span>
              <span>${formatMoney(item.price * item.quantity)}</span>
            </div>
            ${item.observation ? `<div style="font-size:10px; margin-bottom:4px;">(Obs: ${item.observation})</div>` : ''}
          `).join('')}
        </div>

        <div class="divider"></div>

        <div class="item">
          <span>Subtotal:</span>
          <span>${formatMoney(order.total - (order.deliveryFee || 0))}</span>
        </div>
        <div class="item">
          <span>Taxa Entrega:</span>
          <span>${formatMoney(order.deliveryFee || 0)}</span>
        </div>
        <div class="total">
          TOTAL: ${formatMoney(order.total)}
        </div>

        <div class="divider"></div>

        <div class="info">
          <strong>PAGAMENTO:</strong><br/>
          ${order.paymentMethod === 'pix' ? 'PIX' : 
            order.paymentMethod === 'cash' ? `Dinheiro (Troco: ${order.change ? formatMoney(order.change) : 'Não'})` : 
            'Cartão'}
        </div>

        <div class="footer">
          www.3porquinhos.com.br
        </div>
      </body>
    </html>
  `;

  // Cria um iframe invisível para imprimir
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(content);
    doc.close();

    // Aguarda carregar e imprime
    iframe.contentWindow?.focus();
    setTimeout(() => {
      // Loop para o número de cópias
      for(let i=0; i<copies; i++) {
        iframe.contentWindow?.print();
      }
      // Remove o iframe depois (limpeza)
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  }
};
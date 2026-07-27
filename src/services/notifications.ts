
import { evolutionService } from './evolution';
import { Order } from '@/types/order';
import { STORE_PHONE_DISPLAY } from '@/config/store';

// Formata dinheiro
const formatMoney = (val: number) => {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Gera o resumo do pedido
const generateOrderSummary = (order: Order) => {
  const itemsList = order.items
    .map(item => `• ${item.quantity}x ${item.name} - ${formatMoney(item.totalPrice)}`)
    .join('\n');

  const metodoPagamento = order.paymentMethod || 'Não informado';
  const endereco = order.customerAddress || 'Retirada no local';

  return `
📦 *Resumo do Pedido*

${itemsList}

💰 *Valor Total:* ${formatMoney(order.total)}
💳 *Pagamento:* ${metodoPagamento}
📍 *Entrega:* ${endereco}
  `.trim();
};

// 🎯 NOTIFICAÇÕES POR STATUS

export async function notifyOrderAccepted(order: Order) {
  const phone = order.customerPhone;
  if (!phone) return;

  const message = `
Olá, *${order.customerName}*! 🎉

Seu pedido *${order.displayId}* foi *ACEITO* e já está sendo preparado com todo carinho!

${generateOrderSummary(order)}

⏰ Previsão de entrega: *30-40 minutos*

Obrigado pela preferência! 🍕❤️
  `.trim();

  try {
    await evolutionService.sendMessage(phone, message);
    console.log('✅ Notificação de ACEITE enviada:', order.displayId);
  } catch (error) {
    console.error('❌ Erro ao enviar notificação de aceite:', error);
  }
}

export async function notifyOrderRejected(order: Order) {
  const phone = order.customerPhone;
  if (!phone) return;

  const message = `
Olá, *${order.customerName}* 😔

Infelizmente seu pedido *${order.displayId}* foi *RECUSADO*.

${generateOrderSummary(order)}

❌ *Motivo:* Produto indisponível no momento

💬 Entre em contato conosco para mais informações: ${STORE_PHONE_DISPLAY}

Pedimos desculpas pelo transtorno.
  `.trim();

  try {
    await evolutionService.sendMessage(phone, message);
    console.log('✅ Notificação de RECUSA enviada:', order.displayId);
  } catch (error) {
    console.error('❌ Erro ao enviar notificação de recusa:', error);
  }
}

export async function notifyOrderCanceled(order: Order) {
  const phone = order.customerPhone;
  if (!phone) return;

  const message = `
Olá, *${order.customerName}* ⚠️

Seu pedido *${order.displayId}* foi *CANCELADO*.

${generateOrderSummary(order)}

❌ *Motivo:* Cancelamento solicitado

💬 Dúvidas? Entre em contato: ${STORE_PHONE_DISPLAY}

Esperamos você em breve! 😊
  `.trim();

  try {
    await evolutionService.sendMessage(phone, message);
    console.log('✅ Notificação de CANCELAMENTO enviada:', order.displayId);
  } catch (error) {
    console.error('❌ Erro ao enviar notificação de cancelamento:', error);
  }
}

export async function notifyOrderDelivering(order: Order) {
  const phone = order.customerPhone;
  if (!phone) return;

  const message = `
Olá, *${order.customerName}*! 🚴‍♂️💨

Seu pedido *${order.displayId}* *SAIU PARA ENTREGA*!

${generateOrderSummary(order)}

🏍️ *O entregador está a caminho!*

📍 Endereço: ${order.customerAddress}

🔔 Fique atento ao interfone/campainha!

Bom apetite! 🍕❤️
  `.trim();

  try {
    await evolutionService.sendMessage(phone, message);
    console.log('✅ Notificação de ENTREGA enviada:', order.displayId);
  } catch (error) {
    console.error('❌ Erro ao enviar notificação de entrega:', error);
  }
}
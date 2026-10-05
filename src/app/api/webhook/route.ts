import { NextResponse } from 'next/server';

// Desativado. Era aqui que a Evolution API entregava as mensagens do
// WhatsApp para o bot do n8n. Agora o próprio servidor recebe as mensagens
// pela conexão do QR Code (src/lib/whatsapp/conexao.ts) e quem responde é
// o atendente de src/lib/bot.
//
// A rota continua existindo e respondendo 200 de propósito: se a instância
// antiga da Evolution ainda estiver configurada para chamar aqui, ela não
// fica tentando de novo — e as mensagens não são respondidas em dobro.
export async function POST() {
  return NextResponse.json({ success: true, message: 'Webhook desativado: o bot agora roda pelo WhatsApp do QR Code' });
}

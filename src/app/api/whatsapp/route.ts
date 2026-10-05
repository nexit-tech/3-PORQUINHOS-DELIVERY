import { NextResponse } from 'next/server';
import { desconectarWhatsapp, statusWhatsapp } from '@/lib/whatsapp/conexao';
import { ligarWhatsapp, whatsappHabilitado } from '@/lib/whatsapp/servidor';

// Conexão do WhatsApp da loja, usada pela tela de Configurações.
// Protegida pelo middleware: só o admin logado chega aqui.
export const dynamic = 'force-dynamic';

const indisponivel = () =>
  NextResponse.json({
    estado: 'indisponivel',
    qr: null,
    numero: null,
    motivo: 'WhatsApp desligado neste servidor (WHATSAPP_ENABLED).',
  });

export async function GET() {
  if (!whatsappHabilitado()) return indisponivel();
  return NextResponse.json(statusWhatsapp());
}

export async function POST(request: Request) {
  if (!whatsappHabilitado()) return indisponivel();

  try {
    const { action } = await request.json();

    switch (action) {
      case 'connect':
        return NextResponse.json(await ligarWhatsapp());

      case 'logout':
        await desconectarWhatsapp();
        return NextResponse.json(statusWhatsapp());

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Erro na rota do WhatsApp:', error);
    return NextResponse.json({ error: error?.message || 'Erro no WhatsApp' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import {
  connectInstance,
  createInstance,
  getConnectionState,
  logoutInstance,
  sendTextMessage,
} from '@/services/evolutionApi';

// Proxy usado pelo painel (o navegador não pode ver a EVOLUTION_API_KEY).
// Protegido pelo middleware: antes esta rota estava aberta para a internet
// inteira, ou seja, qualquer um mandava WhatsApp em nome da loja.
export async function POST(request: Request) {
  try {
    const { action, phone, message } = await request.json();

    switch (action) {
      case 'check':
        return NextResponse.json(await getConnectionState());

      case 'create':
        return NextResponse.json(await createInstance());

      case 'connect':
        return NextResponse.json(await connectInstance());

      case 'logout':
        return NextResponse.json(await logoutInstance());

      case 'send':
        if (!phone || !message) {
          return NextResponse.json(
            { error: 'Phone e message são obrigatórios' },
            { status: 400 }
          );
        }
        return NextResponse.json(await sendTextMessage(phone, message));

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Erro no Proxy Evolution:', error.response?.data || error.message);
    return NextResponse.json(
      { error: 'Erro ao comunicar com a Evolution API' },
      { status: 500 }
    );
  }
}

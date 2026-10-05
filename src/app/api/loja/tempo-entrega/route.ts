import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBotSetting } from '@/services/botSettings';
import { normalizarMinutos, TEMPO_ENTREGA_KEY, TEMPO_ENTREGA_PADRAO } from '@/lib/tempoEntrega';

// Prazo de entrega para o cronômetro da loja. Passa pelo servidor porque o
// bot_settings é fechado para o visitante pela RLS — e abrir a tabela
// inteira só para ler um número exporia a configuração do bot.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const valor = await getBotSetting(TEMPO_ENTREGA_KEY, getSupabaseAdmin());
    return NextResponse.json({ minutes: normalizarMinutos(valor) });
  } catch (error) {
    console.error('Erro ao ler o tempo de entrega:', error);
    return NextResponse.json({ minutes: TEMPO_ENTREGA_PADRAO });
  }
}

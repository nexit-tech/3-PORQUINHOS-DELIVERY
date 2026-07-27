// src/app/api/cron/auto-unpause/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireSecret } from '@/lib/apiAuth';

// Este cron virou OPCIONAL: o /api/webhook já despausa sozinho o número
// quando chega uma mensagem depois das 24h. Ele continua aqui para quem
// quiser limpar a lista periodicamente (Railway cron, cron-job.org, etc).
export async function GET(request: Request) {
  const unauthorized = requireSecret(request, 'CRON_SECRET');
  if (unauthorized) return unauthorized;

  const db = getSupabaseAdmin();

  try {
    console.log('🔄 Verificando números para auto-despausar...');

    const now = new Date().toISOString();

    // Busca números pausados automaticamente que já passaram das 24h
    const { data: toUnpause, error } = await db
      .from('bot_paused_numbers')
      .select('*')
      .eq('is_paused', true)
      .eq('auto_paused', true)
      .not('auto_unpause_at', 'is', null)
      .lte('auto_unpause_at', now);

    if (error) throw error;

    if (!toUnpause || toUnpause.length === 0) {
      console.log('✅ Nenhum número para despausar');
      return NextResponse.json({ 
        success: true, 
        message: 'No numbers to unpause',
        count: 0 
      });
    }

    console.log(`📋 ${toUnpause.length} número(s) para despausar`);

    // Despausa todos
    for (const item of toUnpause) {
      const { error: updateError } = await db
        .from('bot_paused_numbers')
        .update({
          is_paused: false,
          auto_unpause_at: null,
          notes: `${item.notes || ''} [Auto-despausado em ${new Date().toLocaleString('pt-BR')}]`
        })
        .eq('id', item.id);

      if (updateError) {
        console.error(`❌ Erro ao despausar ${item.phone}:`, updateError);
      } else {
        console.log(`✅ ${item.phone} despausado automaticamente`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${toUnpause.length} number(s) unpaused`,
      count: toUnpause.length 
    });

  } catch (error: any) {
    console.error('❌ Erro no auto-unpause:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
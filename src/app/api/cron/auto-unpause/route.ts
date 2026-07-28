// src/app/api/cron/auto-unpause/route.ts
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireSecret } from '@/lib/apiAuth';

/**
 * Fecha os pedidos de pagamento online que o cliente abandonou no checkout.
 *
 * Sem isto eles ficam AWAITING para sempre — e, quando usaram cupom,
 * segurando um uso que nunca volta. Marcar como cancelado dispara o
 * trigger que devolve o cupom.
 */
async function expirarPedidosAbandonados(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc('expire_abandoned_orders', { p_minutes: 45 });

  if (error) {
    console.error('❌ Erro ao expirar pedidos abandonados:', error);
    return 0;
  }

  const total = Number(data || 0);
  if (total > 0) console.log(`🧹 ${total} pedido(s) abandonado(s) no checkout expirado(s)`);
  return total;
}

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
      const expirados = await expirarPedidosAbandonados(db);
      return NextResponse.json({
        success: true,
        message: 'No numbers to unpause',
        count: 0,
        expiredOrders: expirados,
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

    const expirados = await expirarPedidosAbandonados(db);

    return NextResponse.json({
      success: true,
      message: `${toUnpause.length} number(s) unpaused`,
      count: toUnpause.length,
      expiredOrders: expirados,
    });

  } catch (error: any) {
    console.error('❌ Erro no auto-unpause:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
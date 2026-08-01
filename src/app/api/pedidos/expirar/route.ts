import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Derruba pedidos que foram criados e nunca pagos.
 *
 * Pedido com payment_status = 'AWAITING' é carrinho que virou linha no
 * banco e parou ali: a cozinha não vê, o cliente não quer mais, e se ele
 * usou cupom o uso continua consumido. Depois de MINUTOS_ABANDONO vira
 * CANCELED/EXPIRED, o trigger devolve o cupom e ele some das telas.
 *
 * Por que uma rota e não um cron: o cron do vercel.json nunca executou —
 * o projeto roda no Railway. Em vez de depender de um agendador que não
 * existe, a limpeza acontece quando alguém abre "Meus Pedidos". Não é
 * pontual como um cron, mas é o único caminho que roda de verdade hoje.
 * Se um dia houver agendador, é só bater nesta mesma rota.
 */

/**
 * FIXO no servidor, de propósito.
 *
 * Se viesse no corpo da requisição, qualquer um chamaria com 0 e
 * cancelaria de uma vez todos os pedidos da loja que estão com o cliente
 * digitando o cartão nesse exato momento.
 */
const MINUTOS_ABANDONO = 10;

async function expirar() {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc('expire_abandoned_orders', {
      p_minutes: MINUTOS_ABANDONO,
    });

    if (error) throw error;

    return NextResponse.json({ expirados: Number(data ?? 0) });
  } catch (error: any) {
    console.error('Erro ao expirar pedidos abandonados:', error);
    // Quem chama é uma tela de listagem: não vale quebrar o histórico do
    // cliente porque a faxina falhou.
    return NextResponse.json({ expirados: 0, error: 'falha na limpeza' }, { status: 200 });
  }
}

export async function POST() {
  return expirar();
}

/** GET para conseguir plugar num agendador externo (cron-job.org, Railway). */
export async function GET() {
  return expirar();
}

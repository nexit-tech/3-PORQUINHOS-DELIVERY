import { NextResponse } from 'next/server';
import { confirmarPagamento } from '@/lib/confirmarPagamento';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Chamada pela tela de retorno, quando o cliente volta do checkout.
 *
 * Serve de rede para o caso do webhook não chegar (a entrega pode falhar,
 * o servidor pode estar reiniciando). Como usa a mesma confirmarPagamento,
 * que é idempotente, não faz diferença qual dos dois chega primeiro.
 *
 * Os parâmetros aqui vêm da URL do navegador do cliente — território dele.
 * Eles só dizem O QUE consultar; quem responde se está pago continua sendo
 * o payment_check.
 */
export async function POST(request: Request) {
  try {
    const { orderNsu, transactionNsu, slug } = await request.json();

    if (!orderNsu) {
      return NextResponse.json({ error: 'Pedido não informado' }, { status: 400 });
    }

    // Sem dados de transação (cliente desistiu e voltou), só devolve o
    // estado atual — que o webhook pode já ter atualizado
    if (!transactionNsu || !slug) {
      const db = getSupabaseAdmin();
      const { data } = await db
        .from('orders')
        .select('id, payment_status, total')
        .eq('id', Number(orderNsu))
        .maybeSingle();

      return NextResponse.json({
        ok: true,
        paid: data?.payment_status === 'PAID',
        paymentStatus: data?.payment_status ?? null,
        orderId: data?.id ?? null,
      });
    }

    const resultado = await confirmarPagamento({
      orderNsu: String(orderNsu),
      transactionNsu: String(transactionNsu),
      slug: String(slug),
    });

    return NextResponse.json({
      ok: resultado.ok,
      paid: resultado.paid,
      reason: resultado.reason,
      orderId: resultado.orderId,
    });
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    return NextResponse.json({ error: 'Erro ao verificar o pagamento' }, { status: 500 });
  }
}

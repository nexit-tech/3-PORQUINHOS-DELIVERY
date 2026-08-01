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

/** Estado que já está gravado no banco, sem falar com a operadora. */
async function estadoGravado(orderId: number) {
  const db = getSupabaseAdmin();

  const { data } = await db
    .from('orders')
    .select('id, payment_status, total')
    .eq('id', orderId)
    .maybeSingle();

  return data ?? null;
}

export async function POST(request: Request) {
  try {
    const { orderNsu, transactionNsu, slug } = await request.json();

    if (!orderNsu) {
      return NextResponse.json({ error: 'Pedido não informado' }, { status: 400 });
    }

    const orderId = Number(orderNsu);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
    }

    // Sem dados de transação (cliente desistiu e voltou), só devolve o
    // estado atual — que o webhook pode já ter atualizado
    if (!transactionNsu || !slug) {
      const registro = await estadoGravado(orderId);

      return NextResponse.json({
        ok: true,
        paid: registro?.payment_status === 'PAID',
        paymentStatus: registro?.payment_status ?? null,
        orderId: registro?.id ?? null,
      });
    }

    const resultado = await confirmarPagamento({
      orderNsu: String(orderNsu),
      transactionNsu: String(transactionNsu),
      slug: String(slug),
    });

    // Se a operadora não confirmou AGORA, ainda vale olhar o que já está
    // gravado. O webhook costuma chegar antes do cliente voltar, e quem
    // escreveu PAID foi o mark_order_paid — depois de um payment_check que
    // deu certo. Então isto não é acreditar na URL do navegador: é lembrar
    // de uma confirmação nossa, anterior e verificada na operadora.
    //
    // Sem isto, um soluço do payment_check na volta do cliente mostrava
    // "ainda não recebemos a confirmação" para quem tinha pago e cujo
    // pedido já estava na cozinha — e o cliente refazia o pedido.
    if (!resultado.paid) {
      const registro = await estadoGravado(orderId);

      if (registro?.payment_status === 'PAID') {
        return NextResponse.json({
          ok: true,
          paid: true,
          paymentStatus: 'PAID',
          orderId: registro.id,
        });
      }
    }

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

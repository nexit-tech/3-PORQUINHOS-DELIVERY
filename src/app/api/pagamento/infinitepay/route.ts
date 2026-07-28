import { NextResponse } from 'next/server';
import { confirmarPagamento } from '@/lib/confirmarPagamento';

/**
 * Webhook da InfinitePay.
 *
 * IMPORTANTE: o corpo desta requisição NÃO É CONFIÁVEL.
 *
 * Diferente da Stripe, que assina o payload com Stripe-Signature, não
 * encontrei mecanismo de assinatura na InfinitePay. Ou seja: esta rota é
 * pública e qualquer pessoa pode postar {"order_nsu": 1408, "paid": true}.
 * Se a gente acreditasse nisso, sairia pizza de graça.
 *
 * Então aqui só se aproveita QUAIS identificadores olhar. Se está pago é
 * o payment_check que responde, numa chamada do nosso servidor para o
 * deles (ver confirmarPagamento).
 *
 * Sobre os códigos de resposta: a InfinitePay reenvia quando não recebe
 * 200. Por isso devolvemos 200 quando não há o que fazer (pedido já pago,
 * pagamento ainda não confirmado) e 5xx só quando queremos a retentativa.
 */
export async function POST(request: Request) {
  let evento: any;

  try {
    evento = await request.json();
  } catch {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 });
  }

  const orderNsu = String(evento?.order_nsu ?? '');
  const transactionNsu = String(evento?.transaction_nsu ?? '');
  const slug = String(evento?.invoice_slug ?? evento?.slug ?? '');
  const receiptUrl = evento?.receipt_url ? String(evento.receipt_url) : null;

  console.log('[Webhook InfinitePay] pedido=%s transacao=%s', orderNsu, transactionNsu);

  if (!orderNsu || !transactionNsu || !slug) {
    // Não adianta reenviar: falta identificador. 200 encerra a fila.
    console.warn('[Webhook InfinitePay] evento sem identificadores', evento);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const resultado = await confirmarPagamento({
    orderNsu,
    transactionNsu,
    slug,
    receiptUrl,
  });

  // A retentativa só ajuda quando a falha é temporária. Divergência de
  // valor ou pedido inexistente dá o mesmo resultado mil vezes — devolver
  // 503 nesses casos gerava reenvio infinito e nenhum registro.
  // O pedido já foi para FAILED e está gravado em payment_attempts.
  if (!resultado.ok && !resultado.permanent) {
    return NextResponse.json({ ok: false, reason: resultado.reason }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    paid: resultado.paid,
    ...(resultado.permanent ? { rejected: resultado.reason } : {}),
  });
}

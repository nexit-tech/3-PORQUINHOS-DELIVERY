// src/lib/confirmarPagamento.ts
// Confirmação de pagamento — SÓ NO SERVIDOR.
//
// Existe uma função só, compartilhada por dois caminhos que podem chegar
// em qualquer ordem (ou os dois):
//
//   1. o webhook da InfinitePay
//   2. o cliente voltando pela redirect_url
//
// Ter os dois não é redundância: webhook pode falhar em entregar, e o
// cliente pode fechar a aba antes de voltar. Como a função é idempotente,
// os dois chamarem é o caso normal.
import { checkPayment } from '@/lib/infinitepay';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface ConfirmarInput {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
  receiptUrl?: string | null;
}

export interface ConfirmarResultado {
  ok: boolean;
  paid: boolean;
  /**
   * true  = não adianta tentar de novo (valor divergente, pedido inexistente)
   * false = falha temporária (operadora fora do ar), vale retentativa
   *
   * O webhook usa isto para decidir entre 200 e 503: sem essa distinção,
   * uma divergência de valor gerava retentativa infinita da InfinitePay.
   */
  permanent?: boolean;
  duplicate?: boolean;
  reason?: string;
  orderId?: number;
}

export async function confirmarPagamento(
  input: ConfirmarInput
): Promise<ConfirmarResultado> {
  const orderId = Number(input.orderNsu);

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return { ok: false, paid: false, permanent: true, reason: 'Pedido inválido' };
  }

  if (!input.transactionNsu || !input.slug) {
    return { ok: false, paid: false, permanent: true, reason: 'Dados da transação incompletos' };
  }

  // 1. Pergunta para a operadora. É esta chamada que vale, não o corpo do
  //    webhook — que chega sem assinatura e portanto não prova nada.
  let resultado;
  try {
    resultado = await checkPayment({
      orderNsu: input.orderNsu,
      transactionNsu: input.transactionNsu,
      slug: input.slug,
    });
  } catch (error) {
    console.error('[Pagamento] payment_check falhou:', error);
    // Temporário: queremos que a InfinitePay reenvie
    return {
      ok: false,
      paid: false,
      permanent: false,
      reason: 'Não foi possível confirmar com a operadora',
    };
  }

  if (!resultado.paid) {
    return { ok: true, paid: false, reason: 'Pagamento ainda não confirmado', orderId };
  }

  // 2. O contrato da InfinitePay não foi verificado contra conta real, e
  //    todos os campos da resposta são opcionais. Se `amount` vier ausente
  //    ou em reais, Number() vira NaN e o banco recusaria TODOS os
  //    pagamentos por "valor divergente" — silenciosamente. Melhor tratar
  //    como falha temporária e deixar rastro alto no log.
  const centavos = Number(resultado.amount);

  if (!Number.isInteger(centavos) || centavos <= 0) {
    console.error(
      '[Pagamento] payment_check devolveu amount inesperado:',
      JSON.stringify(resultado)
    );
    return {
      ok: false,
      paid: false,
      permanent: false,
      reason: 'Resposta da operadora sem valor válido',
      orderId,
    };
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc('mark_order_paid', {
    p_order_id: orderId,
    p_transaction_nsu: input.transactionNsu,
    p_amount_cents: centavos,
    p_capture_method: resultado.capture_method ?? null,
    p_receipt_url: input.receiptUrl ?? null,
  });

  if (error) {
    console.error('[Pagamento] mark_order_paid falhou:', error);
    return { ok: false, paid: false, permanent: false, reason: 'Erro ao registrar o pagamento' };
  }

  if (!data?.ok) {
    // Fica registrado em payment_attempts e o pedido vai para FAILED, que
    // aparece na tela de pagamentos em vez de sumir do sistema
    console.error('[Pagamento] Recusado pelo banco:', data);
    return {
      ok: false,
      paid: false,
      permanent: Boolean(data?.permanent),
      reason: data?.reason || 'Pagamento recusado',
      orderId,
    };
  }

  if (data?.duplicate) {
    console.warn('[Pagamento] Segundo pagamento no mesmo pedido:', orderId);
  }

  return { ok: true, paid: true, duplicate: Boolean(data?.duplicate), orderId };
}

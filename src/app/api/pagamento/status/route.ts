import { NextResponse } from 'next/server';
import { isPaymentEnabled } from '@/lib/infinitepay';

/**
 * Diz ao checkout se a loja tem pagamento online configurado.
 *
 * Existe para a opção "Pagar agora" não aparecer quando a InfinitePay não
 * está configurada — o cliente escolheria e tomaria um erro no fim do
 * fluxo, que é o pior lugar para descobrir isso.
 *
 * Não devolve a handle nem chave nenhuma, só um booleano.
 */
export async function GET() {
  return NextResponse.json({ enabled: isPaymentEnabled(), provider: 'infinitepay' });
}

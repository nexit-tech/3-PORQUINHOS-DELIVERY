import { NextResponse } from 'next/server';
import { PaymentProviderError } from '@/lib/infinitepay';
import { gerarLinkPagamento, LinkPagamentoErro } from '@/lib/linkPagamento';

/**
 * Gera o link de cobrança de um pedido que já existe.
 * A regra toda (valores lidos do banco, URL pública fixa) mora em
 * src/lib/linkPagamento.ts, que o atendente do WhatsApp também usa.
 */
export async function POST(request: Request) {
  try {
    const { orderId, email, address } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Informe o pedido' }, { status: 400 });
    }

    // Devolve o total que a operadora VAI cobrar, lido do banco. A tela
    // usa isso para confirmar com o cliente antes de redirecionar: o total
    // exibido no checkout vem do carrinho no localStorage e pode estar
    // velho se o preço mudou no painel.
    return NextResponse.json(await gerarLinkPagamento(Number(orderId), { email, address }));
  } catch (error: any) {
    if (error instanceof LinkPagamentoErro) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    // Conta sem checkout externo, ou credencial errada. Repetir não muda
    // nada, então mandar o cliente "tentar novamente" só o faz rodar em
    // círculo e perder a compra. Este erro é recado para o dono da loja.
    if (error instanceof PaymentProviderError && error.isConfig) {
      console.error(
        '🚨 [InfinitePay] Cobrança recusada pela configuração da conta ' +
          `(${error.status}${error.code ? ` ${error.code}` : ''}): ${error.message}` +
          '\n   Ative o Checkout Externo em ' +
          'https://app.infinitepay.io/external-checkout#configuracoes?enabled=true ' +
          'e confira o INFINITEPAY_HANDLE.'
      );
      return NextResponse.json(
        {
          error:
            'O pagamento online está indisponível no momento. ' +
            'Fale com a loja pelo WhatsApp para concluir seu pedido.',
        },
        { status: 503 }
      );
    }

    console.error('Erro ao criar link de pagamento:', error);
    return NextResponse.json(
      { error: 'Não foi possível iniciar o pagamento. Tente novamente.' },
      { status: 500 }
    );
  }
}

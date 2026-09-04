import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildAddress,
  buildItemsFromOrder,
  createPaymentLink,
  isPaymentEnabled,
  PaymentProviderError,
  toE164BR,
} from '@/lib/infinitepay';

/**
 * Gera o link de cobrança de um pedido que já existe.
 *
 * O navegador manda SÓ o id do pedido. Tudo que vira dinheiro — itens,
 * frete, desconto, total — é lido do banco aqui dentro. Se o valor viesse
 * do cliente, seria o mesmo buraco do "pedido de R$ 0,01" que a
 * create_order fechou.
 */
export async function POST(request: Request) {
  if (!isPaymentEnabled()) {
    return NextResponse.json(
      { error: 'Pagamento online não está configurado nesta loja.' },
      { status: 503 }
    );
  }

  try {
    const { orderId, email, address } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Informe o pedido' }, { status: 400 });
    }

    const db = getSupabaseAdmin();

    const { data: order, error } = await db.rpc('get_order_for_payment', {
      p_order_id: Number(orderId),
    });

    if (error) throw error;

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    if (order.payment_status === 'PAID') {
      return NextResponse.json({ error: 'Este pedido já foi pago' }, { status: 409 });
    }

    if (order.payment_status !== 'AWAITING') {
      return NextResponse.json(
        { error: 'Este pedido não é de pagamento online' },
        { status: 409 }
      );
    }

    if (!order.total_cents || order.total_cents <= 0) {
      return NextResponse.json({ error: 'Pedido sem valor a cobrar' }, { status: 409 });
    }

    // A URL pública precisa ser alcançável pela internet: a InfinitePay
    // chama o webhook de fora. Em localhost isso não funciona — use um
    // túnel (ngrok/cloudflared) ou o domínio de produção.
    //
    // Sem cair no origin da requisição: aquilo sai do header Host, que quem
    // chama escolhe. Com "Host: evil.tld" a operadora receberia webhook_url
    // e redirect_url apontando para o servidor do atacante, num checkout
    // legítimo da loja. Melhor recusar do que gerar cobrança sequestrável.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');

    if (!baseUrl) {
      console.error(
        '🚨 NEXT_PUBLIC_APP_URL não configurada. Sem ela o webhook não tem como voltar.'
      );
      return NextResponse.json(
        { error: 'Pagamento online indisponível no momento.' },
        { status: 503 }
      );
    }

    const checkoutUrl = await createPaymentLink({
      orderNsu: String(order.id),
      items: buildItemsFromOrder(order),
      redirectUrl: `${baseUrl}/pedido/pagamento/retorno`,
      webhookUrl: `${baseUrl}/api/pagamento/infinitepay`,
      // Nome e telefone vêm do banco, como todo o resto. O e-mail é a única
      // exceção: não é gravado no pedido e existe só para o checkout da
      // operadora abrir com o contato preenchido. Como não influencia
      // valor nenhum, aceitar do cliente aqui não abre o buraco que a
      // regra "valor é assunto do banco" fecha — mas ainda assim só passa
      // se tiver cara de e-mail.
      customer: {
        name: order.customer_name || undefined,
        phone_number: toE164BR(order.customer_phone),
        email:
          typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
            ? email.trim()
            : undefined,
      },
      // Mesma lógica do e-mail: só pré-preenche a etapa de entrega lá.
      // O endereço que a cozinha usa continua sendo o do pedido no banco —
      // este aqui não sobrescreve nada.
      address: buildAddress(address),
    });

    // Devolve o total que a operadora VAI cobrar, lido do banco. A tela
    // usa isso para confirmar com o cliente antes de redirecionar: o total
    // exibido no checkout vem do carrinho no localStorage e pode estar
    // velho se o preço mudou no painel.
    return NextResponse.json({
      url: checkoutUrl,
      orderId: order.id,
      totalCents: order.total_cents,
      total: Number(order.total),
    });
  } catch (error: any) {
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

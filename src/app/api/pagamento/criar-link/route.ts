import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildItemsFromOrder,
  createPaymentLink,
  isPaymentEnabled,
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
    const { orderId } = await request.json();

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
      customer: {
        name: order.customer_name || undefined,
        phone_number: order.customer_phone || undefined,
      },
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
    console.error('Erro ao criar link de pagamento:', error);
    return NextResponse.json(
      { error: 'Não foi possível iniciar o pagamento. Tente novamente.' },
      { status: 500 }
    );
  }
}

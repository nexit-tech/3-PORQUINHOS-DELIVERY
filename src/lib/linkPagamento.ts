// src/lib/linkPagamento.ts
// Gera o link de cobrança da InfinitePay para um pedido que já existe.
// Usado pela tela de checkout (/api/pagamento/criar-link) e pelo atendente
// do WhatsApp, que manda o link na conversa.
//
// Recebe SÓ o id do pedido. Tudo que vira dinheiro — itens, frete,
// desconto, total — é lido do banco aqui dentro. Se o valor viesse de quem
// chama, seria o mesmo buraco do "pedido de R$ 0,01" que a create_order
// fechou.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildAddress,
  buildItemsFromOrder,
  createPaymentLink,
  isPaymentEnabled,
  toE164BR,
  type InfinitePayAddress,
} from '@/lib/infinitepay';

/** Erro que tem resposta pronta para o cliente, com o status HTTP certo. */
export class LinkPagamentoErro extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface LinkGerado {
  url: string;
  orderId: number;
  totalCents: number;
  total: number;
}

export async function gerarLinkPagamento(
  orderId: number,
  extras: { email?: unknown; address?: Partial<InfinitePayAddress> | null } = {}
): Promise<LinkGerado> {
  if (!isPaymentEnabled()) {
    throw new LinkPagamentoErro('Pagamento online não está configurado nesta loja.', 503);
  }

  const db = getSupabaseAdmin();
  const { data: order, error } = await db.rpc('get_order_for_payment', { p_order_id: orderId });

  if (error) throw error;
  if (!order) throw new LinkPagamentoErro('Pedido não encontrado', 404);
  if (order.payment_status === 'PAID') throw new LinkPagamentoErro('Este pedido já foi pago', 409);
  if (order.payment_status !== 'AWAITING') {
    throw new LinkPagamentoErro('Este pedido não é de pagamento online', 409);
  }
  if (!order.total_cents || order.total_cents <= 0) {
    throw new LinkPagamentoErro('Pedido sem valor a cobrar', 409);
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
    console.error('🚨 NEXT_PUBLIC_APP_URL não configurada. Sem ela o webhook não tem como voltar.');
    throw new LinkPagamentoErro('Pagamento online indisponível no momento.', 503);
  }

  const { email, address } = extras;

  const url = await createPaymentLink({
    orderNsu: String(order.id),
    items: buildItemsFromOrder(order),
    redirectUrl: `${baseUrl}/pedido/pagamento/retorno`,
    webhookUrl: `${baseUrl}/api/pagamento/infinitepay`,
    // Nome e telefone vêm do banco, como todo o resto. O e-mail é a única
    // exceção: não é gravado no pedido e existe só para o checkout da
    // operadora abrir com o contato preenchido. Como não influencia
    // valor nenhum, aceitar de fora aqui não abre o buraco que a regra
    // "valor é assunto do banco" fecha — mas ainda assim só passa se
    // tiver cara de e-mail.
    customer: {
      name: order.customer_name || undefined,
      phone_number: toE164BR(order.customer_phone),
      email:
        typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
          ? email.trim()
          : undefined,
    },
    // Mesma lógica do e-mail: só pré-preenche a etapa de entrega lá.
    // O endereço que a cozinha usa continua sendo o do pedido no banco.
    address: buildAddress(address),
  });

  return { url, orderId: order.id, totalCents: order.total_cents, total: Number(order.total) };
}

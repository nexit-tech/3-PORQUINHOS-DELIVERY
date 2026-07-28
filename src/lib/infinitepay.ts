// src/lib/infinitepay.ts
// Cliente da InfinitePay. Roda SÓ NO SERVIDOR.
//
// Documentação consultada em 28/07/2026 (Central de Ajuda da InfinitePay).
// Não encontrei assinatura no webhook deles — diferente da Stripe, que
// manda Stripe-Signature. Por isso o desenho aqui é "avisa e confere":
// o webhook é apenas uma campainha, e quem diz se está pago é o
// payment_check, chamado servidor-a-servidor.

const BASE_URL = process.env.INFINITEPAY_API_URL || 'https://api.checkout.infinitepay.io';

export interface InfinitePayItem {
  quantity: number;
  /** Em CENTAVOS. R$ 39,90 = 3990. */
  price: number;
  description: string;
}

export interface CreateLinkInput {
  orderNsu: string;
  items: InfinitePayItem[];
  redirectUrl: string;
  webhookUrl?: string;
  customer?: { name?: string; email?: string; phone_number?: string };
}

export interface PaymentCheckResult {
  success?: boolean;
  paid?: boolean;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
}

export function getHandle(): string {
  const handle = process.env.INFINITEPAY_HANDLE;
  if (!handle) {
    throw new Error(
      'INFINITEPAY_HANDLE não configurada. É a sua InfiniteTag, sem o $ na frente.'
    );
  }
  // A doc é explícita: sem o $
  return handle.replace(/^\$/, '').trim();
}

export function isPaymentEnabled(): boolean {
  return Boolean(process.env.INFINITEPAY_HANDLE);
}

/** Converte reais (numeric do banco) para centavos, sem erro de ponto flutuante. */
export function toCents(reais: number | string): number {
  return Math.round(Number(reais) * 100);
}

/**
 * Cria o link de cobrança e devolve a URL do checkout.
 *
 * Os itens vêm montados a partir do BANCO, nunca do navegador — mesma
 * regra do create_order.
 */
export async function createPaymentLink(input: CreateLinkInput): Promise<string> {
  const payload = {
    handle: getHandle(),
    order_nsu: input.orderNsu,
    redirect_url: input.redirectUrl,
    ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {}),
    ...(input.customer ? { customer: input.customer } : {}),
    items: input.items,
  };

  const response = await fetch(`${BASE_URL}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // Se a operadora demorar, é melhor falhar rápido do que segurar o
    // cliente numa tela travada
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error('[InfinitePay] Falha ao criar link:', response.status, text);
    throw new Error(`InfinitePay respondeu ${response.status}`);
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Resposta da InfinitePay não era JSON');
  }

  if (!data?.url) {
    console.error('[InfinitePay] Resposta sem url:', data);
    throw new Error('InfinitePay não devolveu a URL do checkout');
  }

  return data.url as string;
}

/**
 * Confirma o pagamento direto na operadora.
 *
 * É AQUI que a verdade mora. O corpo do webhook não prova nada: como não
 * vem assinado, qualquer um poderia postar "pedido 1408 pago" na nossa
 * rota. Esta chamada sai do nosso servidor para o deles.
 */
export async function checkPayment(params: {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}): Promise<PaymentCheckResult> {
  const response = await fetch(`${BASE_URL}/payment_check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handle: getHandle(),
      order_nsu: params.orderNsu,
      transaction_nsu: params.transactionNsu,
      slug: params.slug,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error('[InfinitePay] payment_check falhou:', response.status, text);
    throw new Error(`payment_check respondeu ${response.status}`);
  }

  try {
    return JSON.parse(text) as PaymentCheckResult;
  } catch {
    throw new Error('payment_check não devolveu JSON');
  }
}

/**
 * Monta os itens da cobrança a partir do pedido gravado.
 *
 * Cuidado que justifica a função existir: a soma dos itens TEM que bater
 * com o total do pedido, senão a operadora cobra um valor e o sistema
 * espera outro — e o mark_order_paid recusa por divergência.
 *
 * Como não está confirmado se a API aceita item com preço negativo, o
 * desconto do cupom não vira uma linha própria: quando existe desconto,
 * a cobrança vai como uma linha só, já com o valor final. Sem desconto,
 * os itens vão detalhados, que é melhor para o comprovante do cliente.
 */
export function buildItemsFromOrder(order: {
  id: number | string;
  total_cents: number;
  delivery_fee: number | string;
  discount: number | string;
  items: Array<{ product_name: string; quantity: number; total_price: number | string }>;
}): InfinitePayItem[] {
  const desconto = Number(order.discount || 0);

  if (desconto > 0) {
    return [
      {
        quantity: 1,
        price: order.total_cents,
        description: `Pedido #${order.id} (já com desconto)`,
      },
    ];
  }

  const linhas: InfinitePayItem[] = order.items.map((i) => ({
    quantity: i.quantity,
    // total_price já é o valor da linha inteira; a InfinitePay multiplica
    // price por quantity, então o preço enviado é o UNITÁRIO
    price: Math.round((Number(i.total_price) / i.quantity) * 100),
    description: i.product_name.slice(0, 120),
  }));

  const frete = toCents(order.delivery_fee || 0);
  if (frete > 0) {
    linhas.push({ quantity: 1, price: frete, description: 'Taxa de entrega' });
  }

  // Rede de segurança contra arredondamento: se a soma não fechar com o
  // total, manda linha única. Um centavo de diferença faria o pagamento
  // ser recusado depois, na conferência de valor.
  const soma = linhas.reduce((acc, l) => acc + l.price * l.quantity, 0);

  if (soma !== order.total_cents) {
    console.warn(
      `[InfinitePay] Itens somam ${soma} mas o pedido é ${order.total_cents}. Enviando linha única.`
    );
    return [{ quantity: 1, price: order.total_cents, description: `Pedido #${order.id}` }];
  }

  return linhas;
}

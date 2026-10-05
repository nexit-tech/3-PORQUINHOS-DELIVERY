// src/lib/whatsapp/notificador.ts
// Manda para o WhatsApp do cliente cada passo do pedido: aceito, saiu para
// entrega / pronto para retirar, finalizado ou cancelado.
//
// Antes isso rodava no navegador, dentro do painel: se ninguém estivesse com
// o painel aberto (ou se fosse o app desktop, que não tem as rotas de API), o
// cliente não recebia nada. Agora quem envia é o servidor, olhando o banco a
// cada poucos segundos. Não depende de tela nenhuma aberta.
//
// Por que olhar o banco e não o Realtime: o Realtime perde eventos quando a
// conexão cai e não repete os que passaram. Consultando, um pedido aceito
// enquanto o WhatsApp estava fora recebe a mensagem quando ele volta.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBotSetting, setBotSetting } from '@/services/botSettings';
import { STORE_PHONE_DISPLAY } from '@/config/store';
import { normalizarMinutos, previsaoDeEntrega, TEMPO_ENTREGA_KEY } from '@/lib/tempoEntrega';
import { enviarTexto, whatsappConectado, WhatsappDesconectado } from './conexao';

const INTERVALO = 15_000;

/**
 * Só pedidos criados nas últimas horas. Pedido de ontem que ainda está
 * "Em preparo" é esquecido no painel, não pedido de verdade — e mandar
 * "seu pedido foi aceito" para ele agora só confundiria o cliente.
 */
const JANELA_HORAS = 6;

/**
 * PENDING fica de fora de propósito. O telefone é digitado sem verificação:
 * mandar mensagem na hora em que o pedido nasce deixaria qualquer um usar a
 * loja para disparar WhatsApp para o número de outra pessoa. A partir do
 * aceite, quem dispara é alguém da loja.
 */
const STATUS_NOTIFICAVEIS = ['PREPARING', 'DELIVERING', 'COMPLETED', 'CANCELED'] as const;

/**
 * Quando o envio pelo servidor foi ligado pela primeira vez. Pedido criado
 * antes disso nunca recebe mensagem: sem esta data, a primeira conexão
 * mandaria "pedido finalizado" para todo mundo que comprou nas últimas horas.
 */
const INICIO_KEY = 'whatsapp_notificador_desde';
let inicio: string | null = null;

async function dataDeInicio(db: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  if (inicio) return inicio;

  const salvo = await getBotSetting<{ at?: string }>(INICIO_KEY, db);
  if (salvo?.at) return (inicio = salvo.at);

  const agora = new Date().toISOString();
  await setBotSetting(INICIO_KEY, { at: agora }, db);
  return (inicio = agora);
}

const moeda = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function resumo(pedido: any) {
  const itens = (pedido.items ?? [])
    .map((i: any) => `• ${i.quantity}x ${i.product_name}`)
    .join('\n');

  return `${itens}\n\n💰 *Total:* ${moeda(pedido.total)}\n💳 *Pagamento:* ${pedido.payment_method || 'Não informado'}`;
}

const ehRetirada = (pedido: any) =>
  String(pedido.customer_address || '').toUpperCase().includes('RETIRADA');

export function montarMensagem(pedido: any, status: string, minutos: number): string | null {
  const nome = String(pedido.customer_name || '').split(' ')[0] || 'tudo bem';
  const numero = `#${pedido.id}`;
  const retirada = ehRetirada(pedido);
  const previsao = previsaoDeEntrega(pedido.created_at, minutos);

  switch (status) {
    case 'PREPARING':
      return [
        `Olá, *${nome}*! 🎉`,
        '',
        `Seu pedido *${numero}* foi *ACEITO* e já está sendo preparado!`,
        '',
        resumo(pedido),
        '',
        retirada
          ? `⏰ Fica pronto para retirada até as *${previsao}*.`
          : `⏰ Previsão de entrega: até as *${previsao}*.`,
        '',
        'Obrigado pela preferência! ❤️',
      ].join('\n');

    case 'DELIVERING':
      return retirada
        ? [
            `*${nome}*, seu pedido *${numero}* está *PRONTO*! 🛍️`,
            '',
            'Já pode vir buscar. Te esperamos!',
          ].join('\n')
        : [
            `*${nome}*, seu pedido *${numero}* *SAIU PARA ENTREGA*! 🛵💨`,
            '',
            `📍 ${pedido.customer_address}`,
            '',
            'O entregador está a caminho. Fique de olho no interfone/campainha!',
          ].join('\n');

    case 'COMPLETED':
      return [
        `Pedido *${numero}* finalizado! ✅`,
        '',
        `Obrigado, *${nome}*. Bom apetite e até a próxima! 🐷`,
      ].join('\n');

    case 'CANCELED':
      return [
        `Olá, *${nome}*.`,
        '',
        `Seu pedido *${numero}* foi *CANCELADO*. 😔`,
        pedido.payment_status === 'PAID'
          ? '\nComo ele já estava pago, a loja vai entrar em contato sobre o estorno.'
          : '',
        `💬 Dúvidas? Fale com a gente: ${STORE_PHONE_DISPLAY}`,
      ]
        .filter((linha) => linha !== '')
        .join('\n');

    default:
      return null;
  }
}

async function rodada() {
  if (!whatsappConectado()) return;

  const db = getSupabaseAdmin();
  const janela = new Date(Date.now() - JANELA_HORAS * 3_600_000).toISOString();
  const ligadoEm = await dataDeInicio(db);
  const desde = ligadoEm > janela ? ligadoEm : janela;

  const { data: pedidos, error } = await db
    .from('orders')
    .select('*, items:order_items(product_name, quantity)')
    .in('status', STATUS_NOTIFICAVEIS as unknown as string[])
    .gte('created_at', desde)
    // Pedido que nunca foi pago não é pedido: cancelar um carrinho abandonado
    // não pode virar "seu pedido foi cancelado" no WhatsApp de ninguém.
    .not('payment_status', 'in', '("AWAITING","EXPIRED","FAILED")');

  if (error) throw error;
  if (!pedidos?.length) return;

  const { data: jaEnviados, error: erroTrava } = await db
    .from('order_notifications')
    .select('order_id, status')
    .in('order_id', pedidos.map((p) => p.id));

  if (erroTrava) throw erroTrava;

  const enviados = new Set((jaEnviados ?? []).map((n) => `${n.order_id}:${n.status}`));
  const pendentes = pedidos.filter((p) => !enviados.has(`${p.id}:${String(p.status).toUpperCase()}`));
  if (pendentes.length === 0) return;

  const minutos = normalizarMinutos(await getBotSetting(TEMPO_ENTREGA_KEY, db).catch(() => null));

  for (const pedido of pendentes) {
    const status = String(pedido.status).toUpperCase();
    const texto = montarMensagem(pedido, status, minutos);
    if (!texto || !pedido.customer_phone) continue;

    // A mesma trava que o painel usava: (pedido, status) é chave primária.
    // Se dois processos chegarem juntos, só um insere.
    const { error: erroReserva } = await db
      .from('order_notifications')
      .insert({ order_id: pedido.id, status });

    if (erroReserva) {
      if ((erroReserva as any).code !== '23505') console.error('Erro ao reservar notificação:', erroReserva);
      continue;
    }

    try {
      const resultado = await enviarTexto(pedido.customer_phone, texto);
      if (resultado.enviado) console.log(`📲 WhatsApp do pedido #${pedido.id} (${status}) enviado`);
      else console.warn(`📵 Pedido #${pedido.id}: ${resultado.motivo} (${pedido.customer_phone})`);
    } catch (erro) {
      // Falhou no meio (WhatsApp caiu, rede): solta a trava para a próxima
      // rodada tentar de novo. "Número sem WhatsApp" não cai aqui — esse não
      // adianta repetir.
      console.error(`❌ WhatsApp do pedido #${pedido.id} (${status}) falhou:`, erro);
      await db.from('order_notifications').delete().eq('order_id', pedido.id).eq('status', status);
      if (erro instanceof WhatsappDesconectado) return;
    }
  }
}

const g = globalThis as unknown as { __notificadorPedidos?: NodeJS.Timeout };

export function ligarNotificador() {
  if (g.__notificadorPedidos) return;

  let rodando = false;
  g.__notificadorPedidos = setInterval(async () => {
    // Uma rodada lenta não pode encavalar com a próxima e mandar em dobro
    if (rodando) return;
    rodando = true;
    try {
      await rodada();
    } catch (erro) {
      console.error('Erro no envio de status por WhatsApp:', erro);
    } finally {
      rodando = false;
    }
  }, INTERVALO);
}

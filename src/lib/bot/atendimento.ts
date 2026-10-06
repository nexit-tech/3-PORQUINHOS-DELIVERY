// src/lib/bot/atendimento.ts
// Porta de entrada das mensagens que chegam no WhatsApp da loja.
// Decide se o bot responde (ligado? número pausado? pediu humano?), junta
// mensagens mandadas em sequência e entrega para o agente.
//
// Substitui o caminho antigo Evolution → /api/webhook → n8n.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { BOT_SETTING_KEYS, getBotFlag, getBotSetting } from '@/services/botSettings';
import { enviarImagem, enviarTexto } from '@/lib/whatsapp/conexao';
import { isStoreOpen, type DayHours } from '@/lib/storeHours';
import { botConfigurado, responder } from './agente';
import { carregarIA } from './configServidor';

// Frases que indicam pedido de atendimento humano.
// A lista antiga tinha "ajuda", "pessoa" e "alguém" soltos, então
// "quero um lanche pra uma pessoa" pausava o bot por 24h.
const HUMAN_TRIGGERS: RegExp[] = [
  /\batendente\b/i,
  /\bfalar\s+com\s+(algu[eé]m|uma?\s+pessoa|atendente|humano|voc[eê]s)\b/i,
  /\b(um|uma)\s+(humano|pessoa\s+de\s+verdade)\b/i,
  /\bn[aã]o\s+(quero|to|estou)\s+.{0,15}(rob[oô]|bot|m[aá]quina)\b/i,
  /\bchama\s+(algu[eé]m|o\s+dono|a\s+gerente|o\s+gerente)\b/i,
];

/**
 * O bot espera alguns segundos de silêncio antes de responder (configurável
 * no painel). Cliente de WhatsApp manda "oi" / "quero uma pizza" / "de
 * calabresa" em três mensagens; sem esperar, o bot responderia três vezes.
 */
async function esperaMs() {
  return (await carregarIA()).config.esperaSegundos * 1000;
}

async function lojaAberta() {
  const { data } = await getSupabaseAdmin().from('store_settings').select('day_of_week, is_open, open_time, close_time');
  return isStoreOpen((data ?? []) as DayHours[]);
}

/** Quando alguém da loja responde pelo celular, o bot sai da conversa por este tempo. */
const HORAS_PAUSA_HUMANO = 3;

interface Pendente {
  mensagens: string[];
  nome: string | null;
  timer: NodeJS.Timeout;
}

const g = globalThis as unknown as {
  __botPendentes?: Map<string, Pendente>;
  __botFila?: Map<string, Promise<void>>;
};
const pendentes = (g.__botPendentes ??= new Map());
// Uma resposta por vez por cliente: se ele manda mensagem enquanto o bot
// ainda está pensando, a próxima espera a anterior terminar e já lê o
// histórico atualizado.
const fila = (g.__botFila ??= new Map());

/** O painel grava o número como foi digitado: com ou sem o 55. */
function variacoes(phone: string): string[] {
  return phone.startsWith('55') ? [phone, phone.slice(2)] : [phone, `55${phone}`];
}

async function estaPausado(phone: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('bot_paused_numbers')
    .select('id, is_paused, auto_paused, auto_unpause_at, notes')
    .in('phone', variacoes(phone));

  const ativa = (data ?? []).find((p) => p.is_paused);
  if (!ativa) return false;

  // Pausa automática vencida: reativa aqui mesmo, sem depender de cron
  const venceu = ativa.auto_paused && ativa.auto_unpause_at && new Date(ativa.auto_unpause_at) <= new Date();
  if (!venceu) return true;

  await db
    .from('bot_paused_numbers')
    .update({
      is_paused: false,
      auto_unpause_at: null,
      notes: `${ativa.notes || ''} [Auto-despausado em ${new Date().toLocaleString('pt-BR')}]`,
    })
    .eq('id', ativa.id);
  return false;
}

async function pausar(phone: string, horas: number, nota: string) {
  await getSupabaseAdmin()
    .from('bot_paused_numbers')
    .upsert(
      {
        phone,
        is_paused: true,
        paused_at: new Date().toISOString(),
        notes: nota.slice(0, 300),
        auto_paused: true,
        auto_unpause_at: new Date(Date.now() + horas * 3_600_000).toISOString(),
      },
      { onConflict: 'phone' }
    );
}

/**
 * Alguém da loja escreveu para o cliente pelo celular. O bot sai da conversa
 * para não responder por cima do atendente.
 */
export async function humanoAssumiu(phone: string) {
  if (await estaPausado(phone)) return;
  console.log(`🙋 Loja respondeu ${phone} pelo celular: bot pausado por ${HORAS_PAUSA_HUMANO}h`);
  await pausar(phone, HORAS_PAUSA_HUMANO, 'Atendente respondeu pelo celular');
}

export async function receberMensagem(phone: string, texto: string, nome: string | null) {
  const db = getSupabaseAdmin();

  if (!botConfigurado()) {
    console.warn('🤖 Mensagem recebida, mas OPENAI_API_KEY não está configurada. Bot não responde.');
    return;
  }

  if (!(await getBotFlag(BOT_SETTING_KEYS.BOT_ACTIVE, true, db))) return;
  if (await estaPausado(phone)) return;

  if (HUMAN_TRIGGERS.some((p) => p.test(texto))) {
    console.log(`🚨 ${phone} pediu atendimento humano`);
    await pausar(phone, 24, `Solicitou atendimento: "${texto}"`);
    await db.from('bot_notifications').insert({
      phone,
      message: texto.slice(0, 500),
      type: 'HUMAN_REQUEST',
      is_read: false,
      created_at: new Date().toISOString(),
    });

    const setting = await getBotSetting<{ text?: string }>(BOT_SETTING_KEYS.PAUSE_MESSAGE, db);
    const aviso = (setting?.text || '⏸️ Um atendente vai te responder em breve!').replace(/\\n/g, '\n');
    await enviarTexto(phone, aviso).catch((e) => console.error('Erro ao enviar aviso de pausa:', e));
    return;
  }

  // Loja fechada e o painel mandou ficar quieto fora do horário
  const ia = await carregarIA();
  if (!ia.config.responderFechado && !(await lojaAberta())) return;

  const espera = await esperaMs();
  const atual = pendentes.get(phone);
  if (atual) {
    clearTimeout(atual.timer);
    atual.mensagens.push(texto);
    atual.nome = nome ?? atual.nome;
    atual.timer = setTimeout(() => processar(phone), espera);
  } else {
    pendentes.set(phone, {
      mensagens: [texto],
      nome,
      timer: setTimeout(() => processar(phone), espera),
    });
  }
}

function processar(phone: string) {
  const pendente = pendentes.get(phone);
  if (!pendente) return;
  pendentes.delete(phone);

  const anterior = fila.get(phone) ?? Promise.resolve();
  const proxima = anterior
    .then(() => atender(phone, pendente.mensagens.join('\n'), pendente.nome))
    .catch((erro) => console.error(`🤖 Erro ao atender ${phone}:`, erro))
    .finally(() => {
      if (fila.get(phone) === proxima) fila.delete(phone);
    });
  fila.set(phone, proxima);
}

async function atender(phone: string, texto: string, nome: string | null) {
  // Pode ter sido pausado enquanto esperava (atendente assumiu)
  if (await estaPausado(phone)) return;

  const { texto: resposta, fotos } = await responder(phone, texto, nome);

  if (resposta) {
    const envio = await enviarTexto(phone, resposta);
    if (!envio.enviado) {
      console.warn(`🤖 Não consegui responder ${phone}: ${envio.motivo}`);
      return;
    }
  }

  for (const foto of fotos) {
    await enviarImagem(phone, foto.url, foto.legenda).catch((e) =>
      console.error(`🤖 Não consegui mandar a foto para ${phone}:`, e)
    );
  }
}

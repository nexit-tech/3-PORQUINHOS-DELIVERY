// src/lib/whatsapp/conexao.ts
// A conexão do servidor com o WhatsApp da loja, sem Evolution nem Z-API.
//
// Funciona como o WhatsApp Web: o servidor vira um "aparelho conectado" do
// celular da loja depois que o QR Code é lido. Quem faz isso é a biblioteca
// Baileys, que fala o protocolo do WhatsApp direto.
//
// Só roda num servidor que fica ligado (Railway). Em serverless (Vercel) a
// função morre depois de cada requisição e leva a conexão junto.
//
// ⚠️ Não é a API oficial do WhatsApp. Para avisar quem fez pedido o risco é
// baixo, mas disparo em massa para quem não pediu derruba o número.
import type { WAMessage, WASocket } from 'baileys';
import QRCode from 'qrcode';
import { apagarSessao, carregarSessao } from './authState';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { setBotSetting } from '@/services/botSettings';

export type EstadoWhatsapp = 'desligado' | 'conectando' | 'qrcode' | 'conectado';

interface Conexao {
  sock: WASocket | null;
  estado: EstadoWhatsapp;
  /** QR Code atual em data URL, pronto para um <img>. */
  qr: string | null;
  /** Número conectado, só os dígitos. */
  numero: string | null;
  tentativas: number;
  /** Desconexão pedida pelo painel: não reconectar sozinho. */
  saindo: boolean;
  /** Abertura em andamento. Dois cliques em "Gerar QR" não abrem duas conexões. */
  abrindo: Promise<unknown> | null;
}

// Guardado no globalThis porque no `next dev` cada recompilação recarrega os
// módulos. Sem isso, cada salvamento de arquivo abriria uma conexão nova, e o
// WhatsApp derruba as duas quando vê o mesmo aparelho conectado duas vezes.
const g = globalThis as unknown as { __whatsapp?: Conexao };
const conexao: Conexao = (g.__whatsapp ??= {
  sock: null,
  estado: 'desligado',
  qr: null,
  numero: null,
  tentativas: 0,
  saindo: false,
  abrindo: null,
});

/**
 * Nome da sessão na tabela whatsapp_auth. Um teste local com outro nome não
 * mexe na sessão da produção (que é 'principal').
 */
const SESSAO = process.env.WHATSAPP_SESSION || 'principal';

// O Baileys loga muito, inclusive em `info`. Só aviso e erro chegam ao log.
const logger = {
  level: 'warn',
  child() {
    return logger;
  },
  trace() {},
  debug() {},
  info() {},
  warn(obj: unknown, msg?: string) {
    console.warn('[whatsapp]', msg ?? obj);
  },
  error(obj: unknown, msg?: string) {
    console.error('[whatsapp]', msg ?? obj);
  },
};

/** O que chega no WhatsApp da loja, já traduzido para o que interessa. */
export interface MensagemRecebida {
  /** Só dígitos, com DDI. */
  phone: string;
  /** Nome que o cliente usa no WhatsApp. */
  nome: string | null;
  texto: string | null;
  /** Áudio (mensagem de voz), para transcrever. */
  audio: Buffer | null;
  /** Foto, figurinha, documento... que o bot não lê. */
  outraMidia: boolean;
}

export interface Receptor {
  mensagem(m: MensagemRecebida): Promise<void>;
  /** Alguém da loja escreveu para este número pelo celular. */
  lojaRespondeu(phone: string): Promise<void>;
}

let receptor: Receptor | null = null;

/** Quem trata as mensagens recebidas (o bot). Sem receptor, elas são ignoradas. */
export function definirReceptor(r: Receptor) {
  receptor = r;
}

/**
 * IDs das mensagens que o próprio servidor mandou. O WhatsApp devolve
 * essas mensagens como "fromMe" igual às que o dono digita no celular;
 * é por aqui que se sabe qual foi qual.
 */
const enviadasPeloServidor = new Set<string>();
function lembrarEnvio(id: string | null | undefined) {
  if (!id) return;
  enviadasPeloServidor.add(id);
  if (enviadasPeloServidor.size > 2000) {
    const primeira = enviadasPeloServidor.values().next().value;
    if (primeira) enviadasPeloServidor.delete(primeira);
  }
}

/** Mensagem mais velha que isto é replay de reconexão, não conversa. */
const IDADE_MAXIMA_S = 5 * 60;

/**
 * Telefone de quem mandou. No WhatsApp novo o remetente pode vir como LID
 * (um id anônimo, "123@lid"); o número de verdade vem no remoteJidAlt.
 */
function telefoneDe(msg: WAMessage): string | null {
  const key = msg.key as WAMessage['key'] & { remoteJidAlt?: string };
  for (const jid of [key.remoteJid, key.remoteJidAlt]) {
    if (jid?.endsWith('@s.whatsapp.net')) return jid.split('@')[0].split(':')[0];
  }
  return null;
}

function textoDe(msg: WAMessage): string | null {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.ephemeralMessage?.message?.conversation ||
    m.ephemeralMessage?.message?.extendedTextMessage?.text ||
    null
  )?.trim() || null;
}

async function tratarMensagens(baileys: typeof import('baileys'), sock: WASocket, mensagens: WAMessage[], tipo: string) {
  if (!receptor) return;

  for (const msg of mensagens) {
    const jid = msg.key.remoteJid || '';
    // Grupo, status, canal: o bot não se mete
    if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@newsletter')) continue;
    if (!msg.message || msg.message.protocolMessage || msg.message.reactionMessage) continue;

    const enviadaEm = Number(msg.messageTimestamp || 0);
    if (enviadaEm && Date.now() / 1000 - enviadaEm > IDADE_MAXIMA_S) continue;

    const phone = telefoneDe(msg);
    if (!phone) {
      console.warn('[whatsapp] Mensagem sem número de telefone (só LID), ignorada:', jid);
      continue;
    }

    if (msg.key.fromMe) {
      // O eco da mensagem que o servidor mandou chega ANTES do sendMessage
      // devolver o id. Esperar um pouco evita pausar o bot pela própria fala.
      const id = msg.key.id;
      const r = receptor;
      setTimeout(() => {
        if (id && enviadasPeloServidor.has(id)) return;
        r.lojaRespondeu(phone).catch((e) => console.error('Erro ao pausar bot:', e));
      }, 5_000);
      continue;
    }

    // 'append' é histórico sincronizado, não mensagem nova
    if (tipo !== 'notify') continue;

    const m = msg.message;
    let audio: Buffer | null = null;
    if (m.audioMessage) {
      try {
        audio = (await baileys.downloadMediaMessage(msg, 'buffer', {})) as Buffer;
      } catch (erro) {
        console.error('[whatsapp] Não consegui baixar o áudio:', erro);
      }
    }

    const texto = textoDe(msg);
    const outraMidia = !texto && !m.audioMessage;

    await receptor
      .mensagem({ phone, nome: msg.pushName || null, texto, audio, outraMidia })
      .catch((e) => console.error('Erro ao tratar mensagem recebida:', e));
  }
}

/**
 * O status também vai para o banco (bot_settings), porque o app desktop não
 * tem como perguntar ao servidor: ele só fala com o Supabase. O `at` serve
 * de batimento — status velho no banco quer dizer servidor fora do ar.
 */
export const STATUS_KEY = `whatsapp_status:${SESSAO}`;
const BATIMENTO_MS = 60_000;
let ultimoPublicado = '';

function publicarStatus(forcar = false) {
  const chave = `${conexao.estado}|${conexao.numero ?? ''}`;
  if (!forcar && chave === ultimoPublicado) return;
  ultimoPublicado = chave;

  setBotSetting(
    STATUS_KEY,
    {
      estado: conexao.estado,
      numero: conexao.numero,
      // A página Atendente IA mostra se falta a chave da OpenAI
      ia: Boolean(process.env.OPENAI_API_KEY),
      at: new Date().toISOString(),
    },
    getSupabaseAdmin()
  ).catch((e) => console.error('Erro ao publicar status do WhatsApp:', e));
}

const gStatus = globalThis as unknown as { __whatsappBatimento?: NodeJS.Timeout };

/** Começa a publicar o status (e o batimento). Idempotente. */
export function ligarPublicacaoDeStatus() {
  if (gStatus.__whatsappBatimento) return;
  publicarStatus(true);
  gStatus.__whatsappBatimento = setInterval(() => publicarStatus(true), BATIMENTO_MS);
}

export function statusWhatsapp() {
  return { estado: conexao.estado, qr: conexao.qr, numero: conexao.numero };
}

/**
 * Abre a conexão. Com sessão salva, entra direto; sem, gera QR Code.
 *
 * `soComSessao`: no boot do servidor só vale reconectar quem já estava
 * conectado. Sem isso, o servidor ficaria gerando QR Code a cada restart
 * sem ninguém olhando.
 */
export async function conectarWhatsapp({ soComSessao = false } = {}) {
  if (conexao.sock && conexao.estado !== 'desligado') return statusWhatsapp();
  if (conexao.abrindo) {
    await conexao.abrindo;
    return statusWhatsapp();
  }

  conexao.abrindo = abrir(soComSessao);
  try {
    await conexao.abrindo;
  } finally {
    conexao.abrindo = null;
  }
  return statusWhatsapp();
}

async function abrir(soComSessao: boolean) {
  const baileys = await import('baileys');
  const { default: makeWASocket, DisconnectReason, Browsers } = baileys;

  const { state, saveCreds } = await carregarSessao(baileys, SESSAO);

  if (soComSessao && !state.creds.registered && !state.creds.me) {
    console.log('📵 WhatsApp sem sessão salva. Conecte pelo painel (Configurações).');
    return;
  }

  conexao.saindo = false;
  conexao.estado = 'conectando';
  publicarStatus();

  const sock = makeWASocket({
    auth: state,
    logger,
    browser: Browsers.ubuntu('3 Porquinhos Delivery'),
    // Sem isso o celular da loja para de tocar notificação: o WhatsApp acha
    // que alguém está com o "Web" aberto lendo as conversas.
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  conexao.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (sock !== conexao.sock) return;
    tratarMensagens(baileys, sock, messages, type).catch((e) => console.error('Erro em messages.upsert:', e));
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (sock !== conexao.sock) return;

    if (qr) {
      conexao.estado = 'qrcode';
      conexao.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      publicarStatus();
    }

    if (connection === 'open') {
      conexao.estado = 'conectado';
      conexao.qr = null;
      conexao.tentativas = 0;
      conexao.numero = sock.user?.id?.split(':')[0]?.split('@')[0] ?? null;
      console.log(`✅ WhatsApp conectado (${conexao.numero})`);
      publicarStatus();
      return;
    }

    if (connection !== 'close') return;

    const codigo = (lastDisconnect?.error as any)?.output?.statusCode as number | undefined;
    const tinhaSessao = Boolean(state.creds.me);

    conexao.sock = null;
    conexao.qr = null;
    conexao.estado = 'desligado';
    publicarStatus();

    if (conexao.saindo) return;

    // Desconectado pelo celular (Aparelhos conectados → Sair). As chaves
    // salvas não valem mais nada.
    if (codigo === DisconnectReason.loggedOut) {
      console.warn('📵 WhatsApp desconectado pelo celular. Precisa ler o QR Code de novo.');
      conexao.numero = null;
      publicarStatus();
      await apagarSessao(SESSAO).catch((e) => console.error('Erro ao apagar sessão:', e));
      return;
    }

    // Logo depois de ler o QR, o WhatsApp manda reiniciar: é o fluxo normal.
    if (codigo === DisconnectReason.restartRequired) {
      conectarWhatsapp().catch((e) => console.error('Erro ao reconectar WhatsApp:', e));
      return;
    }

    // QR Code expirou sem ninguém ler. Para aqui; o painel gera outro.
    if (!tinhaSessao) return;

    // Queda de rede, restart do WhatsApp etc. Tenta de novo, cada vez esperando
    // mais (até 1 min), para não martelar o servidor deles.
    conexao.tentativas += 1;
    const espera = Math.min(60_000, 2_000 * 2 ** Math.min(conexao.tentativas, 5));
    console.warn(`⚠️ WhatsApp caiu (código ${codigo}). Reconectando em ${espera / 1000}s...`);
    setTimeout(() => {
      conectarWhatsapp().catch((e) => console.error('Erro ao reconectar WhatsApp:', e));
    }, espera);
  });
}

export async function desconectarWhatsapp() {
  conexao.saindo = true;
  const sock = conexao.sock;

  try {
    // logout() avisa o WhatsApp: o aparelho some da lista do celular
    if (sock && conexao.estado === 'conectado') await sock.logout();
    else sock?.end(undefined);
  } catch (error) {
    console.error('Erro ao sair do WhatsApp:', error);
  }

  conexao.sock = null;
  conexao.estado = 'desligado';
  conexao.qr = null;
  conexao.numero = null;
  publicarStatus();
  await apagarSessao(SESSAO);
}

/**
 * Celular brasileiro tem o 9 na frente, mas número antigo pode estar
 * registrado no WhatsApp sem ele. Testa os dois formatos.
 */
function candidatos(telefone: string): string[] {
  const digitos = telefone.replace(/\D/g, '');
  // Mesmo critério do resto do sistema: 10/11 dígitos = sem DDI
  const comDdi = digitos.length >= 12 ? digitos : `55${digitos}`;
  const lista = [comDdi];

  if (comDdi.startsWith('55') && comDdi.length === 13 && comDdi[4] === '9') {
    lista.push(comDdi.slice(0, 4) + comDdi.slice(5));
  } else if (comDdi.startsWith('55') && comDdi.length === 12 && /[6-9]/.test(comDdi[4])) {
    lista.push(comDdi.slice(0, 4) + '9' + comDdi.slice(4));
  }

  return lista;
}

export class WhatsappDesconectado extends Error {
  constructor() {
    super('WhatsApp da loja não está conectado');
  }
}

type Conteudo = { text: string } | { image: { url: string }; caption?: string };

async function enviar(telefone: string, conteudo: Conteudo) {
  const sock = conexao.sock;
  if (!sock || conexao.estado !== 'conectado') throw new WhatsappDesconectado();

  for (const numero of candidatos(telefone)) {
    const [resultado] = (await sock.onWhatsApp(numero)) ?? [];
    if (resultado?.exists) {
      const enviada = await sock.sendMessage(resultado.jid, conteudo);
      lembrarEnvio(enviada?.key?.id);
      return { enviado: true as const, jid: resultado.jid };
    }
  }

  return { enviado: false as const, motivo: 'Número não tem WhatsApp' };
}

export function enviarTexto(telefone: string, texto: string) {
  return enviar(telefone, { text: texto });
}

/** Foto por URL pública (o Baileys baixa e manda como imagem de verdade). */
export function enviarImagem(telefone: string, url: string, legenda?: string) {
  return enviar(telefone, { image: { url }, caption: legenda || undefined });
}

export function whatsappConectado() {
  return conexao.estado === 'conectado';
}

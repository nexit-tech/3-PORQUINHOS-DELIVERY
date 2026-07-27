import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { addMessageToBuffer, sendPauseMessage } from '@/services/messageBuffer';
import { BOT_SETTING_KEYS, getBotFlag } from '@/services/botSettings';
import { requireSecret } from '@/lib/apiAuth';

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

export async function POST(request: Request) {
  const unauthorized = requireSecret(request, 'WEBHOOK_SECRET');
  if (unauthorized) return unauthorized;

  // service_role: sem usuário logado, a RLS bloquearia as tabelas do bot
  const db = getSupabaseAdmin();

  try {
    const payload = await request.json();
    
    const messageData = payload.data || payload;
    const key = messageData.key;

    // 1. Ignora mensagens enviadas pelo próprio bot (fromMe)
    if (!key || key.fromMe) {
      return NextResponse.json({ success: true, message: 'Message from me, ignored' });
    }

    const phone = key.remoteJid?.replace('@s.whatsapp.net', '') || '';
    
    // 🔥 2. IGNORA MENSAGENS DE GRUPO
    // Grupos terminam com '@g.us' ao invés de '@s.whatsapp.net'
    if (key.remoteJid?.includes('@g.us')) {
      console.log('🚫 Mensagem de GRUPO ignorada:', key.remoteJid);
      return NextResponse.json({ success: true, message: 'Group message ignored' });
    }
    
    const messageText = messageData.message?.conversation || 
                       messageData.message?.extendedTextMessage?.text || '';
    
    if (!phone || !messageText) {
      return NextResponse.json({ success: true, message: 'No text or phone' });
    }

    console.log(`📱 Mensagem de: ${phone} | Conteúdo: ${messageText}`);

    // 🔥 0. VERIFICAÇÃO GLOBAL: O BOT ESTÁ LIGADO?
    // Se não existir config, assume true (ligado)
    const isBotActive = await getBotFlag(BOT_SETTING_KEYS.BOT_ACTIVE, true, db);

    if (!isBotActive) {
       console.log('🔴 Bot está DESLIGADO globalmente. Ignorando mensagem.');
       return NextResponse.json({ success: true, message: 'Bot globally disabled' });
    }

    // 🔥 1. DETECTA PEDIDO DE ATENDIMENTO HUMANO
    const needsHuman = HUMAN_TRIGGERS.some(pattern => pattern.test(messageText));

    if (needsHuman) {
      console.log('🚨 Cliente solicitou atendimento humano!');
      
      // Pausa o bot automaticamente por 24h
      const unpauseAt = new Date();
      unpauseAt.setHours(unpauseAt.getHours() + 24);
      
      // Registra pausa no banco
      await db.from('bot_paused_numbers').upsert({
        phone: phone,
        is_paused: true,
        paused_at: new Date().toISOString(),
        notes: `Solicitou atendimento: "${messageText}"`,
        auto_paused: true,
        auto_unpause_at: unpauseAt.toISOString()
      }, { onConflict: 'phone' });

      // Cria notificação para o painel (Navbar)
      await db.from('bot_notifications').insert({
        phone: phone,
        message: messageText,
        type: 'HUMAN_REQUEST',
        is_read: false,
        created_at: new Date().toISOString()
      });

      // Envia mensagem avisando que pausou
      await sendPauseMessage(phone);

      return NextResponse.json({ success: true, message: 'Human assistance requested, bot paused' });
    }

    // 🔥 2. VERIFICA SE O BOT ESTÁ PAUSADO PARA ESSE NÚMERO ESPECÍFICO
    const { data: pauseRow } = await db
      .from('bot_paused_numbers')
      .select('id, is_paused, auto_paused, auto_unpause_at, notes')
      .eq('phone', phone)
      .maybeSingle();

    if (pauseRow?.is_paused) {
      // Despausa preguiçosa: a pausa automática de 24h dependia de um cron
      // configurado em vercel.json, mas o deploy é Railway — ou seja, nunca
      // rodava e o número ficava pausado para sempre. Aqui a própria mensagem
      // que chega faz a verificação.
      const expired =
        pauseRow.auto_paused &&
        pauseRow.auto_unpause_at &&
        new Date(pauseRow.auto_unpause_at) <= new Date();

      if (expired) {
        console.log(`⏰ Pausa automática de ${phone} expirou. Reativando o bot.`);
        await db
          .from('bot_paused_numbers')
          .update({
            is_paused: false,
            auto_unpause_at: null,
            notes: `${pauseRow.notes || ''} [Auto-despausado em ${new Date().toLocaleString('pt-BR')}]`,
          })
          .eq('id', pauseRow.id);
      } else {
        console.log(`⏸️ Bot pausado para ${phone}, ignorando...`);
        return NextResponse.json({ success: true, message: 'Bot paused for this number' });
      }
    }

    // 🔥 3. ADICIONA AO BUFFER (Se não estiver pausado, processa a IA)
    addMessageToBuffer(phone, messageText);

    return NextResponse.json({ success: true, message: 'Message buffered' });

  } catch (error: any) {
    console.error('❌ Erro no webhook:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
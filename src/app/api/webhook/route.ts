import { NextResponse } from 'next/server';
import { supabase } from '@/services/supabase';
import { addMessageToBuffer, sendPauseMessage } from '@/services/messageBuffer';

export async function POST(request: Request) {
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
    const { data: globalSettings } = await supabase
      .from('bot_settings')
      .select('value')
      .eq('key', 'is_bot_active')
      .single();

    // Se não existir config, assume true (ligado)
    const isBotActive = globalSettings?.value?.enabled ?? true;

    if (!isBotActive) {
       console.log('🔴 Bot está DESLIGADO globalmente. Ignorando mensagem.');
       return NextResponse.json({ success: true, message: 'Bot globally disabled' });
    }

    // 🔥 1. DETECTA PALAVRAS-CHAVE PARA ATENDIMENTO HUMANO
    const triggerWords = ['atendente', 'humano', 'pessoa', 'falar com', 'alguém', 'ajuda'];
    const needsHuman = triggerWords.some(word => messageText.toLowerCase().includes(word));

    if (needsHuman) {
      console.log('🚨 Cliente solicitou atendimento humano!');
      
      // Pausa o bot automaticamente por 24h
      const unpauseAt = new Date();
      unpauseAt.setHours(unpauseAt.getHours() + 24);
      
      // Registra pausa no banco
      await supabase.from('bot_paused_numbers').upsert({
        phone: phone,
        is_paused: true,
        paused_at: new Date().toISOString(),
        notes: `Solicitou atendimento: "${messageText}"`,
        auto_paused: true,
        auto_unpause_at: unpauseAt.toISOString()
      }, { onConflict: 'phone' });

      // Cria notificação para o painel (Navbar)
      await supabase.from('bot_notifications').insert({
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
    const { data: botStatus } = await supabase
      .from('bot_paused_numbers')
      .select('*')
      .eq('phone', phone)
      .eq('is_paused', true)
      .single();

    if (botStatus) {
      console.log(`⏸️ Bot pausado para ${phone}, ignorando...`);
      return NextResponse.json({ success: true, message: 'Bot paused for this number' });
    }

    // 🔥 3. ADICIONA AO BUFFER (Se não estiver pausado, processa a IA)
    addMessageToBuffer(phone, messageText);

    return NextResponse.json({ success: true, message: 'Message buffered' });

  } catch (error: any) {
    console.error('❌ Erro no webhook:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
// src/app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/services/supabase';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://seu-n8n.com/webhook/whatsapp';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    console.log('📥 Webhook recebido:', JSON.stringify(payload, null, 2));

    // Extrai dados da mensagem
    const messageData = payload.data || payload;
    const phone = messageData.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
    const messageText = messageData.message?.conversation || 
                       messageData.message?.extendedTextMessage?.text || '';
    
    if (!phone || !messageText) {
      console.log('⚠️ Mensagem sem telefone ou texto, ignorando...');
      return NextResponse.json({ success: true, message: 'Ignored' });
    }

    console.log(`📱 Mensagem de: ${phone}`);
    console.log(`💬 Conteúdo: ${messageText}`);

    // 🔥 DETECTA PALAVRAS-CHAVE PARA ATENDIMENTO HUMANO
    const triggerWords = [
      'atendente',
      'humano', 
      'pessoa',
      'falar com',
      'alguém',
      'ajuda'
    ];

    const needsHuman = triggerWords.some(word => 
      messageText.toLowerCase().includes(word)
    );

    if (needsHuman) {
      console.log('🚨 Cliente solicitou atendimento humano!');
      
      // Pausa o bot automaticamente
      await supabase
        .from('bot_paused_numbers')
        .upsert({
          phone: phone,
          is_paused: true,
          paused_at: new Date().toISOString(),
          notes: `Solicitou atendimento: "${messageText}"`,
          auto_paused: true
        }, {
          onConflict: 'phone'
        });

      // Cria notificação para o painel
      await supabase
        .from('bot_notifications')
        .insert({
          phone: phone,
          message: messageText,
          type: 'HUMAN_REQUEST',
          is_read: false,
          created_at: new Date().toISOString()
        });

      console.log('✅ Bot pausado e notificação criada!');

      // Retorna sucesso sem enviar para N8N
      return NextResponse.json({ 
        success: true, 
        message: 'Human assistance requested, bot paused' 
      });
    }

    // 🔥 VERIFICA SE O BOT ESTÁ PAUSADO PARA ESSE NÚMERO
    const { data: botStatus } = await supabase
      .from('bot_paused_numbers')
      .select('*')
      .eq('phone', phone)
      .eq('is_paused', true)
      .single();

    if (botStatus) {
      console.log(`⏸️ Bot pausado para ${phone}, não enviando para N8N`);
      
      // Registra mensagem mesmo com bot pausado (para histórico)
      await supabase
        .from('bot_notifications')
        .insert({
          phone: phone,
          message: messageText,
          type: 'MESSAGE_WHILE_PAUSED',
          is_read: false,
          created_at: new Date().toISOString()
        });

      return NextResponse.json({ 
        success: true, 
        message: 'Bot paused for this number' 
      });
    }

    // 🔥 ENVIA PARA O N8N
    console.log(`🚀 Enviando para N8N: ${N8N_WEBHOOK_URL}`);
    
    const n8nPayload = {
      phone: phone,
      message: messageText,
      timestamp: new Date().toISOString(),
      rawData: payload
    };

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload)
    });

    if (!n8nResponse.ok) {
      throw new Error(`N8N respondeu com status ${n8nResponse.status}`);
    }

    console.log('✅ Mensagem enviada para N8N com sucesso!');

    return NextResponse.json({ 
      success: true, 
      message: 'Forwarded to N8N' 
    });

  } catch (error: any) {
    console.error('❌ Erro no webhook:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      }, 
      { status: 500 }
    );
  }
}
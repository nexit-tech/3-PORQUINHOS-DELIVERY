// src/services/messageBuffer.ts
// Este arquivo roda SÓ NO SERVIDOR (chamado por /api/webhook), por isso usa o
// cliente com service_role e fala com a Evolution API direto.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendTextMessage } from './evolutionApi';
import { BOT_SETTING_KEYS, getBotSetting } from './botSettings';
import { isStoreOpen, getStoreParts, type DayHours } from '@/lib/storeHours';
import { VIP_NUMBERS } from '@/config/store';

interface BufferedMessage {
  phone: string;
  messages: string[];
  timer: NodeJS.Timeout;
}

// Armazena buffers por telefone
const messageBuffers = new Map<string, BufferedMessage>();

// Tempo de espera (30 segundos)
const BUFFER_TIME = 30000;

/**
 * Verifica se o número é VIP (responde mesmo fora do horário).
 * A lista vem de src/config/store.ts / variável VIP_NUMBERS.
 */
function isVIPNumber(phone: string): boolean {
  const cleanPhone = phone.replace(/\D/g, '');
  return VIP_NUMBERS.includes(cleanPhone);
}

/**
 * Adiciona mensagem ao buffer
 * Se já existe buffer, reseta o timer
 * Se não existe, cria novo buffer
 */
export function addMessageToBuffer(phone: string, message: string) {
  console.log(`📨 Buffer: Adicionando mensagem de ${phone}`);
  
  const existing = messageBuffers.get(phone);
  
  if (existing) {
    // Já existe buffer - adiciona mensagem e reseta timer
    console.log(`🔄 Buffer: Resetando timer para ${phone}`);
    
    clearTimeout(existing.timer);
    existing.messages.push(message);
    
    // Cria novo timer
    existing.timer = setTimeout(() => {
      processBuffer(phone);
    }, BUFFER_TIME);
    
  } else {
    // Novo buffer
    console.log(`🆕 Buffer: Criando novo buffer para ${phone}`);
    
    const timer = setTimeout(() => {
      processBuffer(phone);
    }, BUFFER_TIME);
    
    messageBuffers.set(phone, {
      phone,
      messages: [message],
      timer
    });
  }
}

/**
 * Processa e envia todas as mensagens agrupadas
 */
async function processBuffer(phone: string) {
  const buffer = messageBuffers.get(phone);
  
  if (!buffer) {
    console.log(`⚠️ Buffer: Nenhum buffer encontrado para ${phone}`);
    return;
  }
  
  console.log(`🚀 Buffer: Processando ${buffer.messages.length} mensagens de ${phone}`);
  
  // Agrupa todas as mensagens
  const combinedMessage = buffer.messages.join('\n\n---\n\n');
  
  // Remove buffer
  messageBuffers.delete(phone);
  
  // 🔥 VERIFICA SE É NÚMERO VIP
  const isVIP = isVIPNumber(phone);
  
  if (isVIP) {
    console.log(`⭐ NÚMERO VIP DETECTADO (${phone}) - Responderá mesmo fora do horário`);
  }
  
  // 🔥 VERIFICA SE A LOJA ESTÁ ABERTA (OU SE É VIP)
  const isOpen = await checkStoreOpen();
  
  if (!isOpen && !isVIP) {
    console.log(`🔒 IGNORADO: Mensagem de ${phone} recebida FORA DO HORÁRIO (17:30-01:00). Não responderá.`);
    return;
  }
  
  // 🔥 ENVIA PARA O N8N
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
  
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        message: combinedMessage,
        timestamp: new Date().toISOString(),
        buffered: true,
        messageCount: buffer.messages.length,
        isVIP: isVIP
      })
    });
    
    if (response.ok) {
      console.log('✅ Mensagens enviadas para N8N com sucesso!');
    } else {
      console.error('❌ Erro ao enviar para N8N:', response.status);
    }
  } catch (error) {
    console.error('❌ Erro ao processar buffer:', error);
  }
}

/**
 * Verifica se a loja está aberta agora.
 * Lê a grade cadastrada em store_settings (mesma fonte do painel e do cardápio)
 * em vez de horário chumbado no código.
 */
async function checkStoreOpen(): Promise<boolean> {
  try {
    const { data, error } = await getSupabaseAdmin().from('store_settings').select('*');

    if (error) throw error;

    const schedule = (data as DayHours[]) || [];
    const { hour, minute } = getStoreParts();
    const clock = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    if (schedule.length === 0) {
      console.warn(`⚠️ store_settings vazio - assumindo FECHADA (${clock})`);
      return false;
    }

    const open = isStoreOpen(schedule);
    console.log(`${open ? '✅ Loja ABERTA' : '🔒 Loja FECHADA'} - Horário atual: ${clock}`);
    return open;
  } catch (error) {
    console.error('Erro ao verificar horário:', error);
    return false; // Em caso de erro, assume que está fechado
  }
}

/**
 * Envia mensagem de pausa (atendimento humano)
 */
export async function sendPauseMessage(phone: string) {
  try {
    const setting = await getBotSetting<{ text?: string }>(
      BOT_SETTING_KEYS.PAUSE_MESSAGE,
      getSupabaseAdmin()
    );

    const message =
      setting?.text || '⏸️ Atendimento humano ativado. Aguarde, em breve te responderemos!';

    // Direto na Evolution: o evolutionService usa baseURL relativa e não
    // funciona fora do navegador
    await sendTextMessage(phone, message);
    console.log('✅ Mensagem de pausa enviada!');
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem de pausa:', error);
  }
}

// 🔥 REMOVIDO: Função sendClosedMessage não é mais necessária
// 🔥 REMOVIDO: Função getNextOpening não é mais necessária
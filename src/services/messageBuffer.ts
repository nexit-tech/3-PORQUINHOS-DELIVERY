// src/services/messageBuffer.ts
import { supabase } from './supabase';
import { evolutionService } from './evolution';

interface BufferedMessage {
  phone: string;
  messages: string[];
  timer: NodeJS.Timeout;
}

// Armazena buffers por telefone
const messageBuffers = new Map<string, BufferedMessage>();

// Tempo de espera (30 segundos)
const BUFFER_TIME = 30000;

// 🔥 NÚMEROS VIP (sempre respondem, mesmo fora do horário)
const VIP_NUMBERS = [
  '5522998151575', // Seu número
  // Adicione mais números aqui se necessário
];

/**
 * Verifica se o número é VIP
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
 * Verifica se a loja está aberta agora
 * Horário fixo: 17:30 às 01:00 todos os dias
 */
async function checkStoreOpen(): Promise<boolean> {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinutes;
    
    // 🔥 HORÁRIO FIXO: 17:30 (1050 min) às 01:00 (60 min do dia seguinte)
    const openTime = 17 * 60 + 30; // 17:30 = 1050 minutos
    const closeTime = 1 * 60; // 01:00 = 60 minutos
    
    // Lógica especial porque fecha depois da meia-noite
    // Se for depois das 17:30 OU antes da 01:00, está aberto
    const isOpen = currentTime >= openTime || currentTime < closeTime;
    
    if (isOpen) {
      console.log(`✅ Loja ABERTA - Horário atual: ${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`);
    } else {
      console.log(`🔒 Loja FECHADA - Horário atual: ${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')} (Abre às 17:30)`);
    }
    
    return isOpen;
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
    const { data: settingData } = await supabase
      .from('bot_settings')
      .select('value')
      .eq('key', 'pause_message')
      .single();
    
    const message = settingData?.value?.text || '⏸️ Atendimento humano ativado. Aguarde, em breve te responderemos!';
    
    await evolutionService.sendMessage(phone, message);
    console.log('✅ Mensagem de pausa enviada!');
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem de pausa:', error);
  }
}

// 🔥 REMOVIDO: Função sendClosedMessage não é mais necessária
// 🔥 REMOVIDO: Função getNextOpening não é mais necessária
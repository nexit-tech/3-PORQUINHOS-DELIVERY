// src/services/evolutionApi.ts
// Cliente da Evolution API para código que roda NO SERVIDOR.
//
// Por que existe: src/services/evolution.ts usa
//   axios.create({ baseURL: '/api/evolution' })
// que é um caminho RELATIVO. No navegador funciona; no Node, não — axios não
// tem como resolver "/api/evolution" sem uma origem. Ou seja, o
// sendPauseMessage() disparado pelo webhook nunca chegou a enviar mensagem
// nenhuma: quebrava antes disso.
//
// Aqui a chamada vai direto para a Evolution, sem passar pelo proxy.
import axios from 'axios';

function getClient() {
  const baseURL = process.env.EVOLUTION_API_URL || '';
  const apiKey = process.env.EVOLUTION_API_KEY || '';

  if (!baseURL || !apiKey) {
    throw new Error('EVOLUTION_API_URL / EVOLUTION_API_KEY não configuradas');
  }

  return axios.create({
    baseURL,
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    timeout: 15_000,
  });
}

function getInstanceName(): string {
  const instance = process.env.EVOLUTION_INSTANCE_NAME || '';
  if (!instance) throw new Error('EVOLUTION_INSTANCE_NAME não configurada');
  return instance;
}

/**
 * Normaliza para o formato que a Evolution espera: 55DDDNUMERO@s.whatsapp.net
 *
 * A decisão de já ter DDI é pelo TAMANHO, não pelo prefixo "55": o DDD 55
 * existe (Santa Maria/RS), então um número como (55) 99988-7766 começa com 55
 * sem ser DDI. Local tem 10 ou 11 dígitos; com o DDI, 12 ou 13.
 */
export function toWhatsappJid(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const withCountryCode = digits.length >= 12 ? digits : `55${digits}`;

  return `${withCountryCode}@s.whatsapp.net`;
}

export async function sendTextMessage(phone: string, message: string) {
  const api = getClient();
  const { data } = await api.post(`/message/sendText/${getInstanceName()}`, {
    number: toWhatsappJid(phone),
    text: message,
  });
  return data;
}

export async function getConnectionState() {
  const api = getClient();

  try {
    const { data } = await api.get(`/instance/connectionState/${getInstanceName()}`);
    return data;
  } catch (error: any) {
    if (error.response?.status === 404) return { state: 'not_found' };
    throw error;
  }
}

export async function createInstance() {
  const api = getClient();
  const { data } = await api.post('/instance/create', {
    instanceName: getInstanceName(),
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
  });
  return data;
}

export async function connectInstance() {
  const api = getClient();
  const { data } = await api.get(`/instance/connect/${getInstanceName()}`);
  return data;
}

export async function logoutInstance() {
  const api = getClient();
  await api.delete(`/instance/logout/${getInstanceName()}`);
  return { success: true };
}

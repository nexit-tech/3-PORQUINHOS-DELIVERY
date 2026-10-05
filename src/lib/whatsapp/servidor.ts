// src/lib/whatsapp/servidor.ts
// Ponto único para ligar o WhatsApp do servidor: a conexão e o envio dos
// status de pedido andam juntos.
import { conectarWhatsapp } from './conexao';
import { ligarNotificador } from './notificador';

/**
 * Ligado por padrão só em produção. No `npm run dev`, o servidor local usa o
 * mesmo banco da produção: se abrisse a sessão 'principal' daqui, o WhatsApp
 * veria o mesmo aparelho conectado em dois lugares e derrubaria a loja.
 * Para testar local: WHATSAPP_ENABLED=true e WHATSAPP_SESSION=teste.
 */
export function whatsappHabilitado(): boolean {
  const flag = process.env.WHATSAPP_ENABLED;
  if (flag) return flag === 'true';
  return process.env.NODE_ENV === 'production';
}

export async function ligarWhatsapp(opcoes?: { soComSessao?: boolean }) {
  ligarNotificador();
  return conectarWhatsapp(opcoes);
}

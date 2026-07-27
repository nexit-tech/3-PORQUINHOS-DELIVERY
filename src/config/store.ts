// src/config/store.ts
// Dados da loja que estavam chumbados em vários arquivos.
//
// O telefone aparecia em três lugares com DDDs DIFERENTES:
//   services/notifications.ts   -> (21) 97389-6869
//   app/pedido/historico        -> 5521973896869
//   services/messageBuffer.ts   -> 5522998151575 (número VIP)
//
// Agora tudo sai daqui e dá para sobrescrever por variável de ambiente,
// sem precisar editar código.

/** Telefone de contato divulgado ao cliente, formatado. */
export const STORE_PHONE_DISPLAY =
  process.env.NEXT_PUBLIC_STORE_PHONE_DISPLAY || '(21) 97389-6869';

/** Mesmo telefone em formato E.164 sem símbolos, para links do WhatsApp. */
export const STORE_PHONE_E164 =
  process.env.NEXT_PUBLIC_STORE_PHONE_E164 || '5521973896869';

export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || '3 Porquinhos';

export const STORE_SITE = process.env.NEXT_PUBLIC_STORE_SITE || 'www.3porquinhos.com.br';

/**
 * Números que o bot sempre responde, mesmo com a loja fechada.
 * Configure com NUMEROS separados por vírgula: VIP_NUMBERS=5522998151575,5521999999999
 */
export const VIP_NUMBERS: string[] = (process.env.VIP_NUMBERS || '5522998151575')
  .split(',')
  .map((n) => n.replace(/\D/g, ''))
  .filter(Boolean);

/** Monta o link wa.me para falar com a loja. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${STORE_PHONE_E164}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

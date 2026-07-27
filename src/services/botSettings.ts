// src/services/botSettings.ts
// Acesso centralizado à tabela bot_settings (formato chave/valor).
//
// Por que existe: o código usava `.upsert({ key, value })` sem `onConflict`.
// Como `key` não é a primary key da tabela, o upsert INSERIA uma linha nova a
// cada clique — e aí o `.single()` da leitura quebrava com "multiple rows".
// Aqui a gravação é update-primeiro-insert-depois, que funciona com ou sem
// constraint de unicidade, e a leitura tolera duplicatas legadas.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const BOT_SETTING_KEYS = {
  BOT_ACTIVE: 'is_bot_active',
  AUTO_ACCEPT: 'auto_accept_orders',
  PAUSE_MESSAGE: 'pause_message',
} as const;

// O `client` é opcional porque estas funções rodam nos dois lados:
// no painel usam o cliente do navegador (sessão do admin), e nas rotas de API
// recebem o cliente com service_role — sem ele a RLS bloqueia o bot.
type Client = SupabaseClient;

/**
 * Guarda contra o pior modo de falha aqui: se uma rota de servidor esquecer de
 * passar o cliente com service_role, o padrão (cliente do navegador, anônimo)
 * NÃO dá erro — a RLS simplesmente devolve vazio, e o bot passa a se comportar
 * como se toda configuração estivesse desligada, sem nada no log.
 * Melhor estourar na cara.
 */
function assertClient(client: Client | undefined): Client {
  if (client) return client;

  if (typeof window === 'undefined') {
    throw new Error(
      'botSettings: no servidor é obrigatório passar o cliente com service_role ' +
        '(getSupabaseAdmin()). Sem ele a RLS devolve vazio silenciosamente.'
    );
  }

  return supabase;
}

export async function getBotSetting<T = any>(
  key: string,
  client?: Client
): Promise<T | null> {
  const { data, error } = await assertClient(client)
    .from('bot_settings')
    .select('value')
    .eq('key', key)
    .limit(1);

  if (error) throw error;

  return (data?.[0]?.value as T) ?? null;
}

export async function setBotSetting(
  key: string,
  value: unknown,
  client?: Client
): Promise<void> {
  const db = assertClient(client);

  const { data, error } = await db
    .from('bot_settings')
    .update({ value })
    .eq('key', key)
    .select('key');

  if (error) throw error;

  // Nenhuma linha atualizada = a chave ainda não existe
  if (!data || data.length === 0) {
    const { error: insertError } = await db.from('bot_settings').insert({ key, value });
    if (insertError) throw insertError;
  }
}

/** Lê uma flag booleana no formato { enabled: boolean }. */
export async function getBotFlag(
  key: string,
  fallback: boolean,
  client?: Client
): Promise<boolean> {
  const value = await getBotSetting<{ enabled?: boolean }>(key, client);
  return value?.enabled ?? fallback;
}

export async function setBotFlag(
  key: string,
  enabled: boolean,
  client?: Client
): Promise<void> {
  await setBotSetting(key, { enabled }, client);
}

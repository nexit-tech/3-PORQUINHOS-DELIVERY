// src/lib/supabaseAdmin.ts
// Cliente Supabase para código que roda NO SERVIDOR (rotas de API).
//
// Duas razões para existir:
//
// 1. O cliente de src/services/supabase.ts é um createBrowserClient: ele
//    guarda a sessão em document.cookie e não deve ser usado no Node.
//
// 2. Depois da RLS (supabase/04-rls-pedidos.sql), as tabelas do bot só são
//    acessíveis por `authenticated`. O webhook e o cron não têm usuário
//    logado, então precisam da service_role — que nunca chega ao navegador.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada');
  }

  if (!serviceKey) {
    // Sem service_role o webhook continua rodando enquanto a RLS não estiver
    // ligada. Depois de rodar o 04-rls-pedidos.sql, ele para de conseguir
    // gravar — por isso o aviso é barulhento.
    console.warn(
      '⚠️ SUPABASE_SERVICE_ROLE_KEY não configurada. Usando a anon key nas rotas de servidor. ' +
        'Depois de aplicar a RLS, o bot vai falhar sem essa variável.'
    );
  }

  const key = serviceKey || anonKey;
  if (!key) {
    throw new Error('Nenhuma chave do Supabase configurada');
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}

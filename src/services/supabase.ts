import { createBrowserClient } from '@supabase/ssr';

// 1. Tenta pegar do ambiente padrão (Web/Local)
// IMPORTANTE: O Next.js precisa ler "process.env.NEXT_PUBLIC_..." escrito exatamente assim para substituir no build.
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 2. Tenta pegar do Electron (se existir injetado no window)
const runtimeUrl =
  typeof window !== 'undefined'
    ? (window as any).__RUNTIME_CONFIG__?.NEXT_PUBLIC_SUPABASE_URL
    : null;
const runtimeKey =
  typeof window !== 'undefined'
    ? (window as any).__RUNTIME_CONFIG__?.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : null;

// 3. Define a final (Electron ganha prioridade se estiver rodando lá)
const supabaseUrl = runtimeUrl || envUrl || '';
const supabaseKey = runtimeKey || envKey || '';

console.log('🔧 [Supabase Config] URL:', supabaseUrl ? 'OK (Carregado)' : '❌ VAZIO');

if (!supabaseUrl || !supabaseKey) {
  console.error('🚨 ERRO CRÍTICO: Variáveis do Supabase não encontradas.');
  console.error('Verifique seu arquivo .env e se as chaves começam com NEXT_PUBLIC_');
}

/**
 * Cliente do navegador.
 *
 * Usa createBrowserClient (@supabase/ssr) em vez do createClient comum porque
 * ele guarda a sessão em COOKIE, não em localStorage. Isso é o que permite o
 * middleware (que roda no servidor) enxergar se o admin está logado — antes a
 * proteção do painel era só um redirect feito no próprio navegador.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

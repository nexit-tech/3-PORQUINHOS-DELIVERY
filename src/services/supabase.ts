import { createClient } from '@supabase/supabase-js';

// 1. Tenta pegar do ambiente padrão (Web/Local)
// IMPORTANTE: O Next.js precisa ler "process.env.NEXT_PUBLIC_..." escrito exatamente assim para substituir no build.
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 2. Tenta pegar do Electron (se existir injetado no window)
const runtimeUrl = typeof window !== 'undefined' ? (window as any).__RUNTIME_CONFIG__?.NEXT_PUBLIC_SUPABASE_URL : null;
const runtimeKey = typeof window !== 'undefined' ? (window as any).__RUNTIME_CONFIG__?.NEXT_PUBLIC_SUPABASE_ANON_KEY : null;

// 3. Define a final (Electron ganha prioridade se estiver rodando lá)
const supabaseUrl = runtimeUrl || envUrl || '';
const supabaseKey = runtimeKey || envKey || '';

// Logs para debug (pode remover depois que funcionar)
console.log('🔧 [Supabase Config] URL:', supabaseUrl ? 'OK (Carregado)' : '❌ VAZIO');
// console.log('🔧 [Supabase Config] KEY:', supabaseKey ? 'OK (Carregado)' : '❌ VAZIO'); // Evite logar a chave em produção

if (!supabaseUrl || !supabaseKey) {
  console.error('🚨 ERRO CRÍTICO: Variáveis do Supabase não encontradas.');
  console.error('Verifique seu arquivo .env.local e se as chaves começam com NEXT_PUBLIC_');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
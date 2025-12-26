import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';

// 🔥 BUSCA AS VARIÁVEIS
const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// 🚨 DEBUG: Mostra no console se as variáveis foram carregadas
console.log('[Supabase] URL:', supabaseUrl ? '✅ OK' : '❌ VAZIO');
console.log('[Supabase] Key:', supabaseKey ? '✅ OK' : '❌ VAZIO');

// ⚠️ VALIDAÇÃO: Se estiver vazio, tenta pegar direto do process.env
let finalUrl = supabaseUrl;
let finalKey = supabaseKey;

if (!finalUrl && typeof process !== 'undefined') {
  console.warn('[Supabase] Tentando fallback para process.env...');
  finalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  finalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
}

// 🔥 ÚLTIMO RECURSO: Se ainda estiver vazio, usa valores hardcoded temporários
if (!finalUrl || !finalKey) {
  console.error('❌ [Supabase] ERRO CRÍTICO: Variáveis de ambiente não encontradas!');
  console.error('Verifique se o arquivo .env existe e está correto.');
  
  // ⚠️ TEMPORÁRIO: Substitua pelos seus valores reais para testar
  // finalUrl = 'https://seu-projeto.supabase.co';
  // finalKey = 'sua-anon-key-aqui';
}

// ✅ Cria o cliente Supabase
export const supabase = createClient(finalUrl, finalKey);
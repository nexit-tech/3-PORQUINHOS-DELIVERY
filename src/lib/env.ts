// Função helper para pegar variáveis de ambiente com DEBUG
export function getEnv(key: string): string {
  console.log(`[ENV] Buscando variável: ${key}`);
  
  // 🔥 Prioridade 1: Runtime Config (injetado pelo server.js no Electron)
  if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__) {
    const value = (window as any).__RUNTIME_CONFIG__[key];
    if (value) {
      console.log(`[ENV] ✅ Encontrado no Runtime Config: ${key}`);
      return value;
    }
    console.log(`[ENV] ⚠️ Runtime Config existe, mas "${key}" não está nele`);
  }
  
  // 🔥 Prioridade 2: process.env (Next.js build time)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    console.log(`[ENV] ✅ Encontrado no process.env: ${key}`);
    return process.env[key] || '';
  }
  
  // 🔥 Prioridade 3: Variáveis públicas do Next.js (NEXT_PUBLIC_*)
  if (typeof process !== 'undefined' && process.env) {
    const nextPublicKey = key.startsWith('NEXT_PUBLIC_') ? key : `NEXT_PUBLIC_${key}`;
    if (process.env[nextPublicKey]) {
      console.log(`[ENV] ✅ Encontrado com prefixo NEXT_PUBLIC_: ${nextPublicKey}`);
      return process.env[nextPublicKey] || '';
    }
  }
  
  // ❌ Fallback vazio
  console.error(`[ENV] ❌ Variável "${key}" NÃO ENCONTRADA em nenhum lugar!`);
  console.error('[ENV] Verifique:');
  console.error('  1. Se o arquivo .env existe na raiz do projeto');
  console.error('  2. Se as variáveis começam com NEXT_PUBLIC_');
  console.error('  3. Se você reiniciou o servidor após adicionar o .env');
  
  return '';
}
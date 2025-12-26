// Função helper para pegar variáveis de ambiente
export function getEnv(key: string): string {
  // Prioridade 1: Runtime Config (injetado pelo server.js)
  if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__) {
    const value = (window as any).__RUNTIME_CONFIG__[key];
    if (value) return value;
  }
  
  // Prioridade 2: process.env (Next.js build time)
  if (process.env[key]) {
    return process.env[key] || '';
  }
  
  // Fallback vazio
  console.warn(`[ENV] Variável "${key}" não encontrada!`);
  return '';
}
/**
 * Build do Next.js no modo estático, para empacotar no Electron.
 *
 * O Electron não roda servidor Next: o server.js (Express) serve a pasta `out`
 * e reimplementa as poucas rotas de API que o app desktop precisa. Por isso o
 * build precisa sair com `output: 'export'`, e nesse modo o Next recusa
 * Route Handlers e Middleware. A solução é escondê-los durante o build.
 *
 * O que mudou em relação à versão anterior:
 *
 * 1. Os arquivos escondidos vão para `.electron-build-backup/` DENTRO do
 *    projeto. Antes iam para `../api-temp-backup`, ou seja, para fora do
 *    repositório — se o build fosse interrompido, a pasta `src/app/api`
 *    simplesmente sumia do projeto e o git nem acusava.
 *
 * 2. O `src/middleware.ts` também é escondido. Ele não existia antes; com ele
 *    presente, `next build` com output 'export' falha.
 *
 * 3. A restauração roda também em Ctrl+C e em erro não tratado, não só no
 *    finally.
 *
 * O antigo scripts/build-desktop.js fazia a mesma coisa de outro jeito (movia
 * a API para src/app/_api_temp, que o Next ainda enxerga) e não era chamado
 * por nenhum script do package.json. Foi removido.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const BACKUP_DIR = path.join(ROOT, '.electron-build-backup');

const CONFIG_FILE = path.join(ROOT, 'next.config.ts');
const CONFIG_BACKUP = path.join(BACKUP_DIR, 'next.config.ts');

// Coisas que precisam sumir para o `output: export` funcionar
const HIDDEN_PATHS = [
  { label: 'Rotas de API', from: path.join(ROOT, 'src', 'app', 'api'), to: path.join(BACKUP_DIR, 'api') },
  { label: 'Middleware', from: path.join(ROOT, 'src', 'middleware.ts'), to: path.join(BACKUP_DIR, 'middleware.ts') },
];

const ELECTRON_CONFIG = `import type { NextConfig } from "next";

// Arquivo temporário gerado por build-electron.js. Não edite: ele é
// sobrescrito a cada build e restaurado no final.
const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',

  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },

  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'nathan-supabase-3-porquinhos.7rdajt.easypanel.host' },
    ],
  },
};

export default nextConfig;
`;

let restored = false;

function restore() {
  if (restored) return;
  restored = true;

  console.log('\n🔄 Restaurando arquivos originais...');

  if (fs.existsSync(CONFIG_BACKUP)) {
    fs.copyFileSync(CONFIG_BACKUP, CONFIG_FILE);
    fs.rmSync(CONFIG_BACKUP, { force: true });
    console.log('✅ next.config.ts restaurado');
  }

  for (const item of HIDDEN_PATHS) {
    if (!fs.existsSync(item.to)) continue;

    if (fs.existsSync(item.from)) {
      fs.rmSync(item.from, { recursive: true, force: true });
    }

    fs.renameSync(item.to, item.from);
    console.log(`✅ ${item.label} restaurado`);
  }

  if (fs.existsSync(BACKUP_DIR) && fs.readdirSync(BACKUP_DIR).length === 0) {
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  }
}

// Restaura mesmo se o build for interrompido no meio
process.on('SIGINT', () => {
  restore();
  process.exit(130);
});
process.on('SIGTERM', () => {
  restore();
  process.exit(143);
});
process.on('uncaughtException', (error) => {
  console.error('\n❌ Erro inesperado:', error);
  restore();
  process.exit(1);
});

console.log('🔧 Preparando build para Electron...\n');

try {
  // Sobra de um build anterior interrompido: devolve antes de começar
  if (fs.existsSync(BACKUP_DIR)) {
    console.log('♻️  Encontrei sobras de um build anterior. Restaurando primeiro.');
    restored = false;
    restore();
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  restored = false;

  fs.copyFileSync(CONFIG_FILE, CONFIG_BACKUP);
  console.log('✅ Backup do next.config.ts criado');

  for (const item of HIDDEN_PATHS) {
    if (!fs.existsSync(item.from)) continue;
    fs.renameSync(item.from, item.to);
    console.log(`✅ ${item.label} escondido temporariamente`);
  }

  fs.writeFileSync(CONFIG_FILE, ELECTRON_CONFIG);
  console.log('✅ Config temporário criado\n');

  const nextCacheDir = path.join(ROOT, '.next');
  if (fs.existsSync(nextCacheDir)) {
    console.log('🗑️  Limpando cache do Next.js...');
    fs.rmSync(nextCacheDir, { recursive: true, force: true });
  }

  console.log('🚀 Iniciando build do Next.js...\n');
  // Caminho explícito do binário: chamar só `next` só funciona via npm run
  // (que injeta node_modules/.bin no PATH). Rodando `node build-electron.js`
  // direto, quebrava com "'next' não é reconhecido como um comando".
  execSync('npx --no-install next build', { stdio: 'inherit', cwd: ROOT });
  console.log('\n✅ Build concluído!');
} catch (error) {
  console.error('\n❌ Erro no build:', error.message);
  restore();
  process.exit(1);
} finally {
  restore();
}

console.log('\n🎉 Processo concluído!');
console.log('📂 Verifique se a pasta "out" foi criada.\n');

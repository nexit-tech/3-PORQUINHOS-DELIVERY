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
  // Liga o WhatsApp no boot do servidor; o desktop não tem servidor Next
  { label: 'Instrumentation', from: path.join(ROOT, 'src', 'instrumentation.ts'), to: path.join(BACKUP_DIR, 'instrumentation.ts') },
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

// O instalador NÃO leva o .env inteiro. Antes levava, e junto ia a
// SUPABASE_SERVICE_ROLE_KEY (acesso total ao banco, passando por cima da
// RLS), os segredos do webhook/cron e as chaves de API: qualquer um com o
// .exe extraía tudo. O desktop só precisa disto — o resto é do servidor web.
const ENV_FILE = path.join(ROOT, '.env');
const ENV_DESKTOP = path.join(ROOT, '.env.desktop');
const ENV_DESKTOP_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'NEXT_PUBLIC_STORE_NAME',
  'NEXT_PUBLIC_STORE_PHONE_DISPLAY',
  'NEXT_PUBLIC_STORE_PHONE_E164',
  'NEXT_PUBLIC_STORE_SITE',
  'NEXT_PUBLIC_APP_URL',
];

function writeDesktopEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    throw new Error('.env não encontrado: o desktop precisa dele para conectar no Supabase.');
  }

  const vars = require('dotenv').parse(fs.readFileSync(ENV_FILE));
  const lines = ENV_DESKTOP_KEYS.filter((k) => vars[k]).map((k) => `${k}=${vars[k]}`);
  const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'].filter(
    (k) => !vars[k]
  );
  if (missing.length) throw new Error(`Faltam no .env: ${missing.join(', ')}`);

  fs.writeFileSync(
    ENV_DESKTOP,
    '# Gerado por build-electron.js. É ESTE arquivo que vai no instalador, não o .env.\n' +
      lines.join('\n') +
      '\n'
  );
  console.log(`✅ .env.desktop gerado (${lines.length} variáveis; segredos de servidor ficam de fora)`);
}

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
  console.log('✅ Config temporário criado');

  writeDesktopEnv();
  console.log('');

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

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Preparando build para Electron...\n');

// Caminhos
const originalConfig = path.join(__dirname, 'next.config.ts');
const backupConfig = path.join(__dirname, 'next.config.ts.backup');
const apiDir = path.join(__dirname, 'src', 'app', 'api');
const apiBackupDir = path.join(__dirname, '..', 'api-temp-backup'); // 🔥 FORA DO PROJETO

try {
  // 1. Backup do next.config.ts
  if (fs.existsSync(originalConfig)) {
    fs.copyFileSync(originalConfig, backupConfig);
    console.log('✅ Backup do next.config.ts criado');
  }

  // 2. MOVE a pasta API para FORA do projeto (Next.js não vai ver)
  if (fs.existsSync(apiDir)) {
    // Remove backup antigo se existir
    if (fs.existsSync(apiBackupDir)) {
      fs.rmSync(apiBackupDir, { recursive: true, force: true });
    }
    fs.renameSync(apiDir, apiBackupDir);
    console.log('✅ Pasta /api movida para fora do projeto temporariamente');
  }

  // 3. Cria config temporário para Electron
  const electronConfig = `
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  
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

  fs.writeFileSync(originalConfig, electronConfig);
  console.log('✅ Config temporário criado\n');

  // 4. Limpa cache do Next.js (importante!)
  const nextCacheDir = path.join(__dirname, '.next');
  if (fs.existsSync(nextCacheDir)) {
    console.log('🗑️  Limpando cache do Next.js...');
    fs.rmSync(nextCacheDir, { recursive: true, force: true });
  }

  // 5. Executa o build
  console.log('🚀 Iniciando build do Next.js...\n');
  execSync('next build', { stdio: 'inherit' });
  console.log('\n✅ Build concluído!\n');
  
} catch (error) {
  console.error('\n❌ Erro no build:', error.message);
  process.exit(1);
  
} finally {
  // 6. RESTAURA TUDO (mesmo se der erro)
  console.log('🔄 Restaurando arquivos originais...');
  
  // Restaura config
  if (fs.existsSync(backupConfig)) {
    fs.copyFileSync(backupConfig, originalConfig);
    fs.unlinkSync(backupConfig);
    console.log('✅ next.config.ts restaurado');
  }

  // Restaura pasta API
  if (fs.existsSync(apiBackupDir)) {
    // Remove a pasta api se existir
    if (fs.existsSync(apiDir)) {
      fs.rmSync(apiDir, { recursive: true, force: true });
    }
    fs.renameSync(apiBackupDir, apiDir);
    console.log('✅ Pasta /api restaurada');
  }
}

console.log('\n🎉 Processo concluído!');
console.log('📂 Verifique se a pasta "out" foi criada.\n');
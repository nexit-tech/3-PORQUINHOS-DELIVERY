const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Caminhos das pastas
const apiPath = path.join(__dirname, '..', 'src', 'app', 'api');
const tempPath = path.join(__dirname, '..', 'src', 'app', '_api_temp');

console.log('🚀 Iniciando Build do Electron...');

// 1. Esconde a pasta API (se ela existir)
if (fs.existsSync(apiPath)) {
    console.log('🙈 Escondendo pasta API temporariamente...');
    fs.renameSync(apiPath, tempPath);
}

try {
    // 2. Tenta fazer o Build
    console.log('🔨 Gerando arquivos estáticos (Next.js)...');
    // Roda o build forçando modo Electron
    execSync('npx cross-env IS_ELECTRON=true next build', { stdio: 'inherit' });
    
    console.log('📦 Empacotando executável (Electron)...');
    execSync('npx electron-builder', { stdio: 'inherit' });

    console.log('✅ SUCESSO! Executável gerado na pasta dist/');

} catch (error) {
    console.error('❌ Erro durante o build:', error.message);
} finally {
    // 3. Devolve a pasta API pro lugar (MESMO SE DER ERRO)
    if (fs.existsSync(tempPath)) {
        console.log('👀 Devolvendo pasta API...');
        fs.renameSync(tempPath, apiPath);
    }
}
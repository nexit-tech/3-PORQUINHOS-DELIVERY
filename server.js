const express = require('express');
const path = require('path');
const fs = require('fs');

function startServer() {
  const app = express();
  const port = 3001;

  // 🔥 Gera arquivo de configuração runtime com as variáveis do .env
  const configPath = path.join(__dirname, 'out', 'runtime-config.js');
  const configContent = `
    window.__RUNTIME_CONFIG__ = {
      NEXT_PUBLIC_SUPABASE_URL: "${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}",
      ADMIN_USERNAME: "${process.env.ADMIN_USERNAME || ''}",
      ADMIN_PASSWORD: "${process.env.ADMIN_PASSWORD || ''}"
    };
  `;
  
  fs.writeFileSync(configPath, configContent);
  console.log('[Server] Runtime config gerado com sucesso!');

  // Serve arquivos estáticos
  app.use(express.static(path.join(__dirname, 'out')));

  // Fallback para index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'out', 'index.html'));
  });

  app.listen(port, () => {
    console.log(`[Server] Rodando em http://localhost:${port}`);
    console.log('[Server] Variáveis carregadas:', {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌',
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌',
      adminUser: process.env.ADMIN_USERNAME ? '✅' : '❌',
      adminPass: process.env.ADMIN_PASSWORD ? '✅' : '❌'
    });
  });

  return `http://localhost:${port}`;
}

module.exports = { startServer };
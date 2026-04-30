const express = require('express');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const axios = require('axios');

function startServer() {
  console.log('[Server] 🚀 Iniciando servidor Express...');
  
  const expressApp = express();
  const port = 3001;

  expressApp.use(express.json());

  try {
    // 🔥 CORREÇÃO: Caminho absoluto para a pasta out
    const outPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'out')
      : path.join(__dirname, 'out');
    
    console.log('[Server] 📂 Caminho da pasta out:', outPath);
    console.log('[Server] 📂 Existe?', fs.existsSync(outPath));
    
    if (!fs.existsSync(outPath)) {
      console.error('[Server] ❌ ERRO CRÍTICO: Pasta "out" não encontrada!');
      console.error('[Server] 📂 Caminho esperado:', outPath);
      
      // Lista o conteúdo do diretório pai para debug
      const parentDir = path.dirname(outPath);
      console.log('[Server] 📂 Conteúdo do diretório pai:', fs.readdirSync(parentDir));
      
      throw new Error('Pasta "out" não encontrada! Execute "npm run build" antes de compilar o Electron.');
    }

    // ========================================
    // 🔥 ROTA: /runtime-config.js (Memória)
    // ========================================
    expressApp.get('/runtime-config.js', (req, res) => {
      console.log('[Server] 🧠 Servindo runtime-config da memória...');
      res.type('application/javascript');
      res.send(`
        window.__RUNTIME_CONFIG__ = {
          NEXT_PUBLIC_SUPABASE_URL: "${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}",
          ADMIN_USERNAME: "${process.env.ADMIN_USERNAME || ''}",
          ADMIN_PASSWORD: "${process.env.ADMIN_PASSWORD || ''}"
        };
      `);
    });

    // ========================================
    // 🔥 ROTA: /api/evolution
    // ========================================
    expressApp.post('/api/evolution', async (req, res) => {
      const EVOLUTION_URL = process.env.EVOLUTION_API_URL || '';
      const API_KEY = process.env.EVOLUTION_API_KEY || '';
      const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || '';

      const api = axios.create({
        baseURL: EVOLUTION_URL,
        headers: {
          'apikey': API_KEY,
          'Content-Type': 'application/json',
        },
      });

      try {
        const { action, phone, message } = req.body;
        let responseData;

        switch (action) {
          case 'check':
            try {
              const { data } = await api.get(`/instance/connectionState/${INSTANCE_NAME}`);
              responseData = data;
            } catch (error) {
              if (error.response?.status === 404) {
                responseData = { state: 'not_found' };
              } else {
                throw error;
              }
            }
            break;

          case 'create':
            const { data: createData } = await api.post('/instance/create', {
              instanceName: INSTANCE_NAME,
              qrcode: true,
              integration: 'WHATSAPP-BAILEYS',
            });
            responseData = createData;
            break;

          case 'connect':
            const { data: connectData } = await api.get(`/instance/connect/${INSTANCE_NAME}`);
            responseData = connectData;
            break;

          case 'logout':
            await api.delete(`/instance/logout/${INSTANCE_NAME}`);
            responseData = { success: true };
            break;

          case 'send':
            if (!phone || !message) {
              return res.status(400).json({ error: 'Phone e message são obrigatórios' });
            }

            const cleanPhone = phone.replace(/\D/g, '');
            
            const { data: sendData } = await api.post(`/message/sendText/${INSTANCE_NAME}`, {
              number: `55${cleanPhone}@s.whatsapp.net`,
              text: message
            });
            
            responseData = sendData;
            break;

          default:
            return res.status(400).json({ error: 'Ação inválida' });
        }

        res.json(responseData);

      } catch (error) {
        console.error('[API Evolution] Erro:', error.response?.data || error.message);
        res.status(500).json({ 
          error: 'Erro ao comunicar com a Evolution API',
          details: error.response?.data || error.message
        });
      }
    });

    // 🔥 ROTA: /api/auth/login
    expressApp.post('/api/auth/login', (req, res) => {
      const { username, password } = req.body;

      const validUsername = process.env.ADMIN_USERNAME;
      const validPassword = process.env.ADMIN_PASSWORD;

      if (username === validUsername && password === validPassword) {
        res.json({ success: true });
      } else {
        res.status(401).json({ 
          success: false, 
          message: 'Usuário ou senha incorretos' 
        });
      }
    });

    // ========================================
    // Serve arquivos estáticos (DEPOIS das rotas da API)
    // ========================================
    expressApp.use(express.static(outPath));
    console.log('[Server] ✅ Servindo arquivos de:', outPath);

    // Fallback para index.html
    expressApp.get('*', (req, res) => {
      const indexPath = path.join(outPath, 'index.html');
      
      if (!fs.existsSync(indexPath)) {
        console.error('[Server] ❌ index.html não encontrado em:', indexPath);
        res.status(404).send('index.html não encontrado');
        return;
      }
      
      res.sendFile(indexPath);
    });

    // Inicia o servidor
    const server = expressApp.listen(port, '127.0.0.1', () => {
      console.log(`[Server] ✅ Servidor rodando em http://127.0.0.1:${port}`);
      console.log('[Server] 📋 Rotas ativas:');
      console.log('  - GET  /runtime-config.js');
      console.log('  - POST /api/evolution');
      console.log('  - POST /api/auth/login');
    });

    server.on('error', (error) => {
      console.error('[Server] ❌ ERRO NO SERVIDOR:', error.message);
      throw error;
    });

    return `http://127.0.0.1:${port}`;
    
  } catch (error) {
    console.error('[Server] ❌ ERRO FATAL:', error.message);
    throw error;
  }
}

module.exports = { startServer };
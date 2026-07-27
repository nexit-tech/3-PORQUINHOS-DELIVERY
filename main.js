// ⚠️ CARREGA .ENV DA RAIZ DO APP (Electron)
const path = require('path');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');

// 🔥 SISTEMA DE LOGS
const fs = require('fs');
const logPath = path.join(app.getPath('userData'), 'app.log');

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage);
  try {
    fs.appendFileSync(logPath, logMessage);
  } catch (err) {
    console.error('Erro ao escrever log:', err);
  }
}

log('========================================');
log('🚀 APLICAÇÃO INICIANDO...');
log(`Versão do Electron: ${process.versions.electron}`);
log(`Versão do Node: ${process.versions.node}`);
log(`Plataforma: ${process.platform}`);
log(`Modo: ${app.isPackaged ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
log(`Caminho do userData: ${app.getPath('userData')}`);
log(`Caminho do exe: ${app.getAppPath()}`);
log(`Caminho do log: ${logPath}`);

// Define o caminho do .env baseado no ambiente
const envPath = app.isPackaged 
  ? path.join(process.resourcesPath, '.env')
  : path.join(__dirname, '.env');

log(`Tentando carregar .env de: ${envPath}`);

try {
  const dotenv = require('dotenv');
  dotenv.config({ path: envPath });
  log('✅ dotenv carregado com sucesso!');
} catch (error) {
  log(`❌ ERRO ao carregar dotenv: ${error.message}`);
  log(`Stack: ${error.stack}`);
}

// Verifica variáveis
log('🔍 Verificando variáveis de ambiente...');
log(`SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ OK' : '❌ FALTANDO'}`);
log(`SUPABASE_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ OK' : '❌ FALTANDO'}`);
log(`ADMIN_EMAIL: ${process.env.ADMIN_EMAIL ? '✅ OK' : '❌ FALTANDO'}`);
log(`ADMIN_PASS: ${process.env.ADMIN_PASSWORD ? '✅ OK' : '❌ FALTANDO'}`);

let mainWindow;
let serverUrl;

function createWindow() {
  log('🪟 Criando janela principal...');
  
  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      title: "3 Porquinhos Delivery",
      icon: path.join(__dirname, 'public', 'favicon.ico'),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      autoHideMenuBar: true,
      show: false, // 🔥 NÃO MOSTRA ATÉ CARREGAR
      backgroundColor: '#ffffff' // 🔥 FUNDO BRANCO
    });

    log(`Carregando URL: ${serverUrl}`);
    
    mainWindow.loadURL(serverUrl);

    // 🔥 TIMEOUT DE SEGURANÇA (Mostra a janela mesmo se não carregar 100%)
    const showTimeout = setTimeout(() => {
      log('⚠️ Timeout atingido - Mostrando janela de qualquer forma');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      }
    }, 5000); // 5 segundos

    // 🔥 MOSTRA A JANELA QUANDO ESTIVER PRONTA
    mainWindow.once('ready-to-show', () => {
      clearTimeout(showTimeout);
      log('✅ Janela pronta! Exibindo...');
      mainWindow.show();
    });

    // 🔥 LOGS DE ERRO DA PÁGINA
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      log(`❌ ERRO AO CARREGAR PÁGINA: ${errorCode} - ${errorDescription}`);
      log(`URL que falhou: ${validatedURL}`);
      
      // Mostra erro pro usuário
      dialog.showErrorBox(
        'Erro ao Carregar',
        `Não foi possível carregar a aplicação.\n\nErro: ${errorDescription}\nURL: ${validatedURL}\n\nVerifique o log em:\n${logPath}`
      );
    });

    mainWindow.webContents.on('did-finish-load', () => {
      log('✅ Página carregada com sucesso!');
    });

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      log(`[RENDERER] ${message}`);
    });

    // 🔥 LOG QUANDO A JANELA FOR FECHADA
    mainWindow.on('closed', () => {
      log('🚪 Janela principal fechada');
      mainWindow = null;
    });

    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }

    log('✅ Janela criada com sucesso!');
  } catch (error) {
    log(`❌ ERRO FATAL ao criar janela: ${error.message}`);
    log(`Stack: ${error.stack}`);
    
    dialog.showErrorBox(
      'Erro Fatal',
      `Não foi possível criar a janela:\n\n${error.message}\n\nLog: ${logPath}`
    );
  }
}

app.whenReady().then(async () => {
  log('📦 App pronto! Iniciando servidor...');
  
  try {
    if (app.isPackaged) {
      log('Modo PRODUÇÃO: Iniciando servidor Express...');
      
      // 🔥 CARREGA O SERVER.JS
      const { startServer } = require('./server');
      
      log('Chamando startServer()...');
      serverUrl = startServer();
      log(`✅ Servidor iniciado em: ${serverUrl}`);
      
      // 🔥 AGUARDA O SERVIDOR ESTAR PRONTO (3 segundos)
      log('⏳ Aguardando servidor inicializar completamente...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      log('✅ Servidor deve estar pronto agora!');
      
      // 🔥 TESTA SE O SERVIDOR RESPONDE
      log('🔍 Testando conexão com o servidor...');
      try {
        const http = require('http');
        await new Promise((resolve, reject) => {
          const req = http.get(serverUrl, (res) => {
            log(`✅ Servidor respondeu com status: ${res.statusCode}`);
            resolve();
          });
          req.on('error', (err) => {
            log(`❌ Servidor não respondeu: ${err.message}`);
            reject(err);
          });
          req.setTimeout(5000, () => {
            log('⚠️ Timeout ao testar servidor');
            reject(new Error('Timeout'));
          });
        });
      } catch (testError) {
        log(`⚠️ Erro ao testar servidor, mas continuando: ${testError.message}`);
      }
      
    } else {
      log('Modo DEV: Usando localhost:3000');
      serverUrl = 'http://localhost:3000';
    }

    log('🪟 Criando janela...');
    createWindow();
    
  } catch (error) {
    log(`❌ ERRO FATAL ao iniciar: ${error.message}`);
    log(`Stack: ${error.stack}`);
    
    // 🔥 MOSTRA ALERTA DE ERRO PRO USUÁRIO
    dialog.showErrorBox(
      'Erro ao Iniciar', 
      `Não foi possível iniciar a aplicação:\n\n${error.message}\n\nVerifique o arquivo de log em:\n${logPath}`
    );
    
    // Encerra o app
    app.quit();
  }

  // ========================================
  // IPC HANDLERS (Impressão)
  // ========================================
  
  ipcMain.handle('get-printers', async (event) => {
    try {
      log('🖨️ Listando impressoras...');
      const printers = await mainWindow.webContents.getPrintersAsync();
      log(`✅ Impressoras encontradas: ${printers.length}`);
      return printers;
    } catch (err) {
      log(`❌ Erro ao listar impressoras: ${err.message}`);
      return [];
    }
  });

  ipcMain.handle('print-silent', async (event, { content, printerName, width }) => {
    log(`🖨️ Iniciando impressão em: ${printerName} (${width})`);
    
    try {
      const printers = await event.sender.getPrintersAsync();
      let targetPrinter = printers.find(p => p.name === printerName);
      
      if (!targetPrinter) {
        log('⚠️ Impressora especificada não encontrada, usando padrão...');
        targetPrinter = printers.find(p => p.isDefault);
      }
      
      if (!targetPrinter) {
        throw new Error('Nenhuma impressora disponível');
      }

      log(`Usando impressora: ${targetPrinter.name}`);

      const printWindow = new BrowserWindow({
        show: false,
        width: width === '58mm' ? 220 : 302,
        height: 600,
        webPreferences: { 
          nodeIntegration: false, 
          contextIsolation: true 
        }
      });

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const success = await new Promise((resolve) => {
        printWindow.webContents.print({
          silent: true,
          deviceName: targetPrinter.name,
          printBackground: true,
          color: false,
          margins: { marginType: 'none' },
          pageSize: { 
            width: width === '58mm' ? 58000 : 80000, 
            height: 297000 
          }
        }, (success) => {
          log(`Resultado da impressão: ${success ? 'sucesso' : 'falha'}`);
          resolve(success);
        });
      });

      setTimeout(() => { 
        if (!printWindow.isDestroyed()) {
          printWindow.close();
        }
      }, 2000);
      
      log(`✅ Impressão ${success ? 'bem-sucedida' : 'falhou'}`);
      return success;
      
    } catch (error) {
      log(`❌ Erro na impressão: ${error.message}`);
      log(`Stack: ${error.stack}`);
      throw error;
    }
  });
});

app.on('window-all-closed', () => {
  log('🚪 Todas as janelas fechadas');
  if (process.platform !== 'darwin') {
    log('Encerrando aplicação...');
    app.quit();
  }
});

app.on('activate', () => {
  log('🔄 App ativado');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 🔥 CAPTURA ERROS NÃO TRATADOS
process.on('uncaughtException', (error) => {
  log(`💥 ERRO NÃO CAPTURADO: ${error.message}`);
  log(`Stack: ${error.stack}`);
  
  dialog.showErrorBox(
    'Erro Não Tratado',
    `Ocorreu um erro inesperado:\n\n${error.message}\n\nLog: ${logPath}`
  );
});

process.on('unhandledRejection', (reason, promise) => {
  log(`💥 PROMISE REJEITADA: ${reason}`);
  log(`Promise: ${JSON.stringify(promise)}`);
});

log('✅ main.js carregado completamente!');
log('========================================');
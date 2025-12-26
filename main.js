// ⚠️ CARREGA .ENV DA RAIZ DO APP (Electron)
const path = require('path');
const { app } = require('electron');

// Define o caminho do .env baseado no ambiente
const envPath = app.isPackaged 
  ? path.join(process.resourcesPath, '.env')  // Produção
  : path.join(__dirname, '.env');              // Dev

require('dotenv').config({ path: envPath });

// Agora sim, importa o resto
const { BrowserWindow, ipcMain } = require('electron');
const { startServer } = require('./server');

let mainWindow;
let serverUrl;

function createWindow() {
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
  });

  mainWindow.loadURL(serverUrl);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // 🔥 VALIDA SE AS VARIÁVEIS FORAM CARREGADAS
  console.log('[Main] Verificando variáveis de ambiente...');
  console.log('[Main] SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌ FALTANDO');
  console.log('[Main] SUPABASE_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌ FALTANDO');
  console.log('[Main] ADMIN_USER:', process.env.ADMIN_USERNAME ? '✅' : '❌ FALTANDO');
  console.log('[Main] ADMIN_PASS:', process.env.ADMIN_PASSWORD ? '✅' : '❌ FALTANDO');

  if (app.isPackaged) {
    serverUrl = startServer();
  } else {
    serverUrl = 'http://localhost:3000';
  }

  createWindow();

  // ... (resto do código de impressão permanece igual)
  ipcMain.handle('get-printers', async (event) => {
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return printers;
    } catch (err) {
      console.error('[Electron] Erro ao listar impressoras:', err);
      return [];
    }
  });

  ipcMain.handle('print-silent', async (event, { content, printerName, width }) => {
    console.log(`[Electron] 🖨️ Iniciando impressão...`);
    
    try {
      const printers = await event.sender.getPrintersAsync();
      let targetPrinter = printers.find(p => p.name === printerName);
      
      if (!targetPrinter) targetPrinter = printers.find(p => p.isDefault);
      if (!targetPrinter) throw new Error('Nenhuma impressora disponível');

      const printWindow = new BrowserWindow({
        show: false,
        width: width === '58mm' ? 220 : 302,
        height: 600,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
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
          pageSize: { width: width === '58mm' ? 58000 : 80000, height: 297000 }
        }, (success) => resolve(success));
      });

      setTimeout(() => { if (!printWindow.isDestroyed()) printWindow.close(); }, 2000);
      return success;
    } catch (error) {
      console.error('[Electron] ❌ Erro na impressão:', error);
      throw error;
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
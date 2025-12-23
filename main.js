const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "3 Porquinhos Delivery",
    icon: path.join(__dirname, 'public/favicon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
  createWindow();

  // Lista impressoras
  ipcMain.handle('get-printers', async (event) => {
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return printers;
    } catch (err) {
      console.error('[Electron] Erro ao listar impressoras:', err);
      return [];
    }
  });

  // IMPRESSÃO SILENCIOSA OTIMIZADA
  ipcMain.handle('print-silent', async (event, { content, printerName, width }) => {
    console.log(`[Electron] 🖨️ Iniciando impressão...`);
    console.log(`[Electron] 📄 Impressora: ${printerName || 'Padrão'}`);
    console.log(`[Electron] 📏 Largura: ${width}`);

    try {
      const printers = await event.sender.getPrintersAsync();
      let targetPrinter = printers.find(p => p.name === printerName);
      
      if (!targetPrinter) {
        targetPrinter = printers.find(p => p.isDefault);
      }

      if (!targetPrinter) {
        throw new Error('Nenhuma impressora disponível');
      }

      console.log(`[Electron] ✅ Usando impressora: ${targetPrinter.name}`);

      // Janela invisível para impressão
      const printWindow = new BrowserWindow({
        show: false, // IMPORTANTE: Invisível
        width: width === '58mm' ? 220 : 302,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        }
      });

      // Carrega o HTML
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);

      // Aguarda renderização completa
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Configurações de impressão OTIMIZADAS
      const printOptions = {
        silent: true,
        deviceName: targetPrinter.name,
        printBackground: true,
        color: false,
        margins: {
          marginType: 'none'
        },
        pageSize: {
          width: width === '58mm' ? 58000 : 80000, // em microns
          height: 297000 // Tamanho máximo, será ajustado pelo conteúdo
        },
        scaleFactor: 100,
        landscape: false,
        pagesPerSheet: 1,
        collate: false,
        copies: 1
      };

      // Executa impressão
      const success = await new Promise((resolve) => {
        printWindow.webContents.print(printOptions, (success, failureReason) => {
          if (success) {
            console.log('[Electron] ✅ Impressão enviada com sucesso!');
            resolve(true);
          } else {
            console.error('[Electron] ❌ Falha na impressão:', failureReason);
            resolve(false);
          }
        });
      });

      // Fecha janela após impressão
      setTimeout(() => {
        if (!printWindow.isDestroyed()) {
          printWindow.close();
        }
      }, 2000);

      return success;

    } catch (error) {
      console.error('[Electron] ❌ Erro fatal na impressão:', error);
      throw error;
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
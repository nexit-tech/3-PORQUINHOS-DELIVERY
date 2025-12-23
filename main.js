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

  ipcMain.handle('get-printers', async (event) => {
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return printers;
    } catch (err) {
      return [];
    }
  });

  // --- IMPRESSÃO BRUTAL (AJUSTADA) ---
  ipcMain.handle('print-silent', async (event, { content, printerName }) => {
    console.log(`[Electron] 🏁 Imprimindo ticket...`);

    const printers = await event.sender.getPrintersAsync();
    let targetPrinter = printers.find(p => p.name === printerName) || printers.find(p => p.isDefault);

    if (!targetPrinter) throw new Error('Sem impressora.');

    const workerWindow = new BrowserWindow({ 
      show: true, // Mantive true para você conferir visualmente
      width: 400, 
      height: 600,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });

    try {
      await workerWindow.loadURL('about:blank');

      // INJEÇÃO DE HTML + CSS CORRIGIDO
      await workerWindow.webContents.executeJavaScript(`
        document.write(decodeURIComponent("${encodeURIComponent(content)}"));
        
        const style = document.createElement('style');
        style.innerHTML = \`
          @media print {
            body, html { 
              background-color: #fff !important; 
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important; /* IMPORTANTE: Permite a nota crescer */
            }
            * { 
              color: #000 !important; 
              text-shadow: none !important; 
            }
            
            /* AQUI ESTÁ O SEGREDO DO "NÃO CORTAR" */
            .safe-zone {
              margin: 0 !important;
              padding-left: 10px !important;  /* Margem esquerda de segurança */
              padding-right: 15px !important; /* Margem direita de segurança */
              padding-bottom: 50px !important; /* Espaço extra no fundo */
              width: auto !important;
            }
          }
        \`;
        document.head.appendChild(style);
        document.close();
      `);

      // Espera renderizar
      await new Promise(resolve => setTimeout(resolve, 1500));

      const options = {
        silent: true,
        deviceName: targetPrinter.name, 
        printBackground: true,
        // Sem margens no driver, controlamos via CSS acima
      };

      workerWindow.webContents.print(options, (success, failureReason) => {
          if (!success) console.error(`[Electron] Erro: ${failureReason}`);
          
          // Fecha depois de 5s
          setTimeout(() => { 
            if(!workerWindow.isDestroyed()) workerWindow.close(); 
          }, 5000);
      });

    } catch (error) {
      console.error('[Electron] Erro fatal:', error);
      if (!workerWindow.isDestroyed()) workerWindow.close();
      throw error;
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
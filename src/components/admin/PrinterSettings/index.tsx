// src/components/admin/PrinterSettings/index.tsx
import { useState, useEffect } from 'react';
import { Printer, Save, RefreshCw, FileText, CheckCircle } from 'lucide-react';
import styles from './styles.module.css';
import { printReceipt } from '@/utils/printReceipt';
import { PrinterSettings as IPrinterSettings } from '@/types/settings'; // Agora existe!

// MOCK para teste (Estrutura compatível)
const MOCK_ORDER: any = {
  id: "TESTE-PRINT",
  customerName: "CLIENTE TESTE",
  customerPhone: "(11) 99999-9999",
  address: { street: "Rua de Teste", number: "123" },
  items: [
    { name: "Hamburguer Teste", quantity: 1, price: 25.00, observation: "Bem passado" },
    { name: "Refri Lata", quantity: 2, price: 5.00 }
  ],
  deliveryFee: 5.00,
  total: 40.00,
  paymentMethod: "Dinheiro",
  createdAt: new Date().toISOString()
};

export function PrinterSettings() {
  // Estado tipado corretamente
  const [localSettings, setLocalSettings] = useState<IPrinterSettings>({
    printerName: '',
    paperWidth: '80mm',
    autoPrint: false,
    cutPaper: true
  });

  const [availablePrinters, setAvailablePrinters] = useState<any[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('printer_settings');
    if (saved) {
      try {
        setLocalSettings(JSON.parse(saved));
      } catch (e) { console.error(e); }
    }
    handleScanPrinters(true);
  }, []);

  const handleTestPrint = async () => {
    // Salva antes de testar
    localStorage.setItem('printer_settings', JSON.stringify(localSettings));
    
    try {
      console.log("Iniciando teste...", localSettings);
      await printReceipt(MOCK_ORDER, localSettings, 1);
    } catch (error) {
      console.error("Erro no teste:", error);
      alert("Erro ao testar. Verifique o console.");
    }
  };

  const handleScanPrinters = async (isAuto = false) => {
    if (typeof window === 'undefined') return;

    if ((window as any).require) {
      if (!isAuto) setLoadingPrinters(true);
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const printers = await ipcRenderer.invoke('get-printers');
        setAvailablePrinters(printers);
        
        if (printers.length > 0 && !localSettings.printerName) {
           const defaultPrinter = printers.find((p: any) => p.isDefault);
           if (defaultPrinter) {
             // CORREÇÃO DO ERRO 'prev implicitly has any type'
             setLocalSettings((prev: IPrinterSettings) => ({ 
               ...prev, 
               printerName: defaultPrinter.name 
             }));
           }
        }
      } catch (error) {
        console.error("Erro Electron:", error);
        if (!isAuto) alert("Erro ao buscar impressoras.");
      } finally {
        setLoadingPrinters(false);
      }
    }
  };

  const handleChange = (field: keyof IPrinterSettings, value: any) => {
    // CORREÇÃO DO ERRO 'prev implicitly has any type'
    setLocalSettings((prev: IPrinterSettings) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveClick = () => {
    localStorage.setItem('printer_settings', JSON.stringify(localSettings));
    setMsg('Salvo!');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleContainer}>
          <Printer size={24} className={styles.icon} />
          <h2 className={styles.title}>Impressora</h2>
        </div>
        
        <div className={styles.actions}>
          <button type="button" onClick={handleTestPrint} className={styles.testButton}>
            <FileText size={18} /> Testar
          </button>
          <button type="button" onClick={handleSaveClick} className={styles.saveButton}>
            <Save size={18} /> Salvar
          </button>
        </div>
      </div>

      {msg && <div style={{ color: 'green', marginBottom: 15 }}><CheckCircle size={16}/> {msg}</div>}

      <div className={styles.form}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Impressora</label>
          <div className={styles.row}>
            {availablePrinters.length > 0 ? (
              <select 
                value={localSettings.printerName || ''} 
                onChange={(e) => handleChange('printerName', e.target.value)}
                className={styles.select}
              >
                <option value="">Selecione...</option>
                {availablePrinters.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={localSettings.printerName || ''}
                onChange={(e) => handleChange('printerName', e.target.value)}
                placeholder="Nome da impressora"
                className={styles.input}
              />
            )}
            <button onClick={() => handleScanPrinters(false)} className={styles.scanButton}>
              <RefreshCw size={20} className={loadingPrinters ? styles.spin : ''} />
            </button>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Largura do Papel</label>
          <select
            value={localSettings.paperWidth || '80mm'}
            onChange={(e) => handleChange('paperWidth', e.target.value)}
            className={styles.select}
          >
            <option value="80mm">80mm (Padrão)</option>
            <option value="58mm">58mm (Pequena)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
// src/lib/printerSettings.ts
// Configuração da impressora é POR MÁQUINA, então mora no localStorage.
//
// O código antigo salvava aqui mas lia da tabela `settings` (key='printer'),
// que nada nunca escrevia — por isso a impressão automática nunca disparava e
// o botão de reimprimir sempre reclamava "Configure a impressora".
import type { PrinterSettings } from '@/types/settings';

const STORAGE_KEY = 'printer_settings';

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  printerName: '',
  paperWidth: '80mm',
  autoPrint: false,
  cutPaper: true,
};

export function loadPrinterSettings(): PrinterSettings {
  if (typeof window === 'undefined') return DEFAULT_PRINTER_SETTINGS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRINTER_SETTINGS;

    return { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(raw) };
  } catch (error) {
    console.error('Erro ao ler configuração da impressora:', error);
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export function savePrinterSettings(settings: PrinterSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Esta máquina está configurada para imprimir sozinha ao aceitar um pedido? */
export function shouldAutoPrint(settings = loadPrinterSettings()): boolean {
  return Boolean(settings.autoPrint && settings.printerName);
}

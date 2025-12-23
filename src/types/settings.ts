// src/types/settings.ts

export type WeekDay = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

export interface DaySchedule {
  day: WeekDay;
  label: string;
  isOpen: boolean;
  openTime: string; // Formato "HH:mm"
  closeTime: string; // Formato "HH:mm"
}

export interface StoreSettings {
  schedule: DaySchedule[];
  // Futuramente entra aqui: taxa de entrega, tempo médio, etc.
}

// ADICIONEI ISSO AQUI QUE FALTAVA:
export interface PrinterSettings {
  printerName: string;
  paperWidth: '80mm' | '58mm';
  autoPrint: boolean;
  cutPaper: boolean;
}
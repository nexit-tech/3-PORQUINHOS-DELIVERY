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
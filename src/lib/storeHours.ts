// src/lib/storeHours.ts
// Fonte única da verdade sobre "a loja está aberta agora?".
// Trata dois problemas que o código antigo ignorava:
//   1. Horário que vira a meia-noite (ex: 17:30 -> 01:00)
//   2. Fuso: o servidor (Railway) roda em UTC, então new Date().getHours() vem 3h adiantado

export const STORE_TZ = 'America/Sao_Paulo';

export const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export interface DayHours {
  day_of_week: string;
  is_open: boolean;
  open_time: string | null; // "HH:mm" ou "HH:mm:ss"
  close_time: string | null;
}

/** Converte "HH:mm" ou "HH:mm:ss" em minutos desde a meia-noite. */
function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Data/hora "de verdade" no fuso da loja, independente de onde o código roda. */
export function getStoreParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  // Alguns runtimes devolvem "24" para meia-noite com hour12: false
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);

  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday,
    dayKey: DAY_KEYS[weekday],
    minutes: hour * 60 + minute,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`, // YYYY-MM-DD no fuso da loja
  };
}

/** Atalho: "2026-07-27" no fuso da loja (para agrupar relatórios). */
export function storeDateKey(date: Date | string): string {
  return getStoreParts(typeof date === 'string' ? new Date(date) : date).dateKey;
}

/** Dia da semana ('dom'..'sab') no fuso da loja. */
export function storeDayKey(date: Date = new Date()): DayKey {
  return getStoreParts(date).dayKey;
}

/**
 * A loja está aberta agora, dada a grade completa da semana?
 *
 * Precisa da semana inteira (não só de hoje) porque uma janela que abre
 * 17:30 de segunda e fecha 01:00 ainda está aberta às 00:30 de terça.
 */
export function isStoreOpen(schedule: DayHours[], date: Date = new Date()): boolean {
  if (!schedule || schedule.length === 0) return false;

  const { weekday, minutes } = getStoreParts(date);
  const todayKey = DAY_KEYS[weekday];
  const yesterdayKey = DAY_KEYS[(weekday + 6) % 7];

  // 1. Janela que começou hoje
  const today = schedule.find((d) => d.day_of_week === todayKey);
  if (today?.is_open) {
    const open = toMinutes(today.open_time);
    const close = toMinutes(today.close_time);

    if (open !== null && close !== null) {
      if (close > open) {
        // Horário normal (ex: 11:00 -> 23:00)
        if (minutes >= open && minutes < close) return true;
      } else {
        // Vira a meia-noite (ex: 17:30 -> 01:00): hoje fica aberto de open até 23:59
        if (minutes >= open) return true;
      }
    }
  }

  // 2. Janela de ontem que atravessou a meia-noite e ainda não fechou
  const yesterday = schedule.find((d) => d.day_of_week === yesterdayKey);
  if (yesterday?.is_open) {
    const open = toMinutes(yesterday.open_time);
    const close = toMinutes(yesterday.close_time);

    if (open !== null && close !== null && close <= open && minutes < close) {
      return true;
    }
  }

  return false;
}

/** Próxima abertura, para exibir "Abrimos terça às 17:30". */
export function getNextOpening(
  schedule: DayHours[],
  date: Date = new Date()
): { dayKey: DayKey; openTime: string } | null {
  const { weekday, minutes } = getStoreParts(date);

  for (let i = 0; i < 8; i++) {
    const checkIndex = (weekday + i) % 7;
    const key = DAY_KEYS[checkIndex];
    const day = schedule.find((d) => d.day_of_week === key);

    if (!day?.is_open) continue;

    const open = toMinutes(day.open_time);
    if (open === null) continue;

    // Hoje só serve se o horário de abertura ainda não passou
    if (i === 0 && minutes >= open) continue;

    return { dayKey: key, openTime: (day.open_time || '').slice(0, 5) };
  }

  return null;
}

export const DAY_LABELS: Record<DayKey, string> = {
  dom: 'Domingo',
  seg: 'Segunda-feira',
  ter: 'Terça-feira',
  qua: 'Quarta-feira',
  qui: 'Quinta-feira',
  sex: 'Sexta-feira',
  sab: 'Sábado',
};

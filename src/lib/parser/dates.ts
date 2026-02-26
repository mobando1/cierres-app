/**
 * Parseo y formateo de fechas para el POS colombiano.
 * Portado de 03_Helpers.gs
 */

const MESES_ES: Record<string, number> = {
  'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
  'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
  'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
  'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
  'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
};

const MESES_ABREV_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

/**
 * Parsea texto de fecha en múltiples formatos a Date.
 * Formatos:
 * - "09 Febrero 2026 , 7:19:41 pm" (formato POS)
 * - "09 Feb 2026, 02:57:49 PM" (formato POS corto)
 * - "DD/MM/YYYY" o "DD-MM-YYYY"
 * - "YYYY-MM-DD"
 */
export function parseDate(text: string | null | undefined): Date | null {
  if (!text) return null;
  const s = String(text).trim();

  // Formato POS: "09 Febrero 2026 , 7:19:41 pm"
  const posFmt = s.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s*,?\s*(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)?/i);
  if (posFmt) {
    const day = parseInt(posFmt[1]);
    const monthStr = posFmt[2].toLowerCase();
    const year = parseInt(posFmt[3]);
    let hours = parseInt(posFmt[4]);
    const minutes = parseInt(posFmt[5]);
    const seconds = parseInt(posFmt[6]);
    const ampm = posFmt[7]?.toLowerCase() || null;

    let month = MESES_ES[monthStr];
    if (month === undefined) {
      month = MESES_ES[monthStr.substring(0, 3)];
    }
    if (month === undefined) return null;

    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    return new Date(year, month, day, hours, minutes, seconds);
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
  }

  // Formato YYYY-MM-DD
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
  }

  return null;
}

/** Formatea Date a "2026-02-09" (ISO) */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Formatea Date a "09-feb-2026" (display colombiano) */
export function formatDateDisplay(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = MESES_ABREV_ES[date.getMonth()];
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

/** Retorna fecha ISO de hoy en timezone Colombia */
export function todayISO(): string {
  return formatDateISO(nowColombia());
}

/** Retorna Date actual (Colombia timezone awareness for server) */
export function nowColombia(): Date {
  return new Date();
}

/** Retorna timestamp ISO actual */
export function nowTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Parseo de moneda colombiana.
 * Portado de 03_Helpers.gs:parseMoney()
 *
 * Maneja: $300,000 → 300000, $1,121,000 → 1121000, $-37,150 → -37150
 * El POS usa COMAS como separador de miles.
 */
export function parseMoney(text: string | number | null | undefined): number {
  if (text === null || text === undefined) return 0;
  let s = String(text).trim();
  if (s === '' || s === '-') return 0;

  // Remover $ y espacios
  s = s.replace(/\$/g, '').replace(/\s/g, '');

  // Detectar signo negativo
  let negative = false;
  if (s.charAt(0) === '-') {
    negative = true;
    s = s.substring(1);
  }

  // Remover comas (separador de miles del POS)
  s = s.replace(/,/g, '');

  // Manejar puntos
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts[parts.length - 1].length > 2) {
      // Es separador de miles
      s = s.replace(/\./g, '');
    }
  }

  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  return negative ? -Math.round(num) : Math.round(num);
}

/**
 * Extrae un monto de dinero del texto usando un regex.
 */
export function extractMoney(text: string, regex: RegExp): number {
  const match = text.match(regex);
  if (!match) return 0;
  return parseMoney(match[1]);
}

/**
 * Formatea un número como moneda colombiana: 1234567 → "1,234,567"
 */
export function formatMoney(n: number): string {
  return Math.abs(n).toLocaleString('es-CO');
}

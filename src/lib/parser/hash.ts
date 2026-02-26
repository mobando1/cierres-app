/**
 * Hash de deduplicación para cierres.
 * Reemplaza Utilities.computeDigest() de GAS con crypto nativo de Node.
 */

import { createHash } from 'crypto';
import type { ParsedCierre } from '../types';

/**
 * Genera un hash SHA-256 de los campos clave del cierre para detectar duplicados.
 */
export function hashRecord(cierre: ParsedCierre): string {
  const key = [
    cierre.fecha,
    cierre.punto,
    cierre.id_cierre,
    cierre.efectivo_total,
    cierre.total_ingresos,
    cierre.sobrante_faltante_monto,
  ].join('|');

  return createHash('sha256').update(key).digest('hex').substring(0, 16);
}

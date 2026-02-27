import { describe, it, expect } from 'vitest';
import { CONFIG } from '../config';

/**
 * Tests para el cálculo del sobre.
 * Fórmula: sobre_esperado = declarado - apertura_valor
 *          diferencia = contado - sobre_esperado
 */

function calcularSobre(declarado: number, apertura: number, contado: number) {
  const sobreEsperado = declarado - apertura;
  const diferencia = contado - sobreEsperado;
  const absDif = Math.abs(diferencia);
  const estado = absDif <= CONFIG.TOLERANCIA_COP ? 'CONFIRMADO' : 'DISCREPANCIA';
  return { sobreEsperado, diferencia, estado };
}

describe('Cálculo del sobre', () => {
  it('debe cuadrar cuando contado = declarado - apertura', () => {
    // Declaró 388,000, dejó base 300,000, sobre tiene 88,000
    const r = calcularSobre(388000, 300000, 88000);
    expect(r.sobreEsperado).toBe(88000);
    expect(r.diferencia).toBe(0);
    expect(r.estado).toBe('CONFIRMADO');
  });

  it('debe detectar faltante en el sobre', () => {
    // Declaró 388,000, dejó base 300,000, sobre tiene 80,000 (faltante de 8,000)
    const r = calcularSobre(388000, 300000, 80000);
    expect(r.sobreEsperado).toBe(88000);
    expect(r.diferencia).toBe(-8000);
    expect(r.estado).toBe('DISCREPANCIA');
  });

  it('debe detectar sobrante en el sobre', () => {
    const r = calcularSobre(388000, 300000, 95000);
    expect(r.sobreEsperado).toBe(88000);
    expect(r.diferencia).toBe(7000);
    expect(r.estado).toBe('DISCREPANCIA');
  });

  it('debe confirmar con tolerancia de $500', () => {
    // Diferencia de $300 → dentro de tolerancia
    const r = calcularSobre(388000, 300000, 88300);
    expect(r.diferencia).toBe(300);
    expect(r.estado).toBe('CONFIRMADO');
  });

  it('debe marcar discrepancia fuera de tolerancia', () => {
    // Diferencia de $600 → fuera de tolerancia
    const r = calcularSobre(388000, 300000, 88600);
    expect(r.diferencia).toBe(600);
    expect(r.estado).toBe('DISCREPANCIA');
  });

  it('debe funcionar sin apertura (base 0)', () => {
    // Sin base, todo el declarado va al sobre
    const r = calcularSobre(200000, 0, 200000);
    expect(r.sobreEsperado).toBe(200000);
    expect(r.diferencia).toBe(0);
    expect(r.estado).toBe('CONFIRMADO');
  });
});

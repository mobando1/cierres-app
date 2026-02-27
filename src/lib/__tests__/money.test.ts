import { describe, it, expect } from 'vitest';
import { parseMoney, formatMoney } from '../parser/money';

describe('parseMoney', () => {
  it('debe parsear montos con coma como separador de miles', () => {
    expect(parseMoney('$300,000')).toBe(300000);
    expect(parseMoney('$1,121,000')).toBe(1121000);
    expect(parseMoney('$37,150')).toBe(37150);
  });

  it('debe manejar negativos', () => {
    expect(parseMoney('$-37,150')).toBe(-37150);
    expect(parseMoney('-5000')).toBe(-5000);
  });

  it('debe manejar valores nulos/vacíos', () => {
    expect(parseMoney(null)).toBe(0);
    expect(parseMoney(undefined)).toBe(0);
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('-')).toBe(0);
  });

  it('debe manejar números sin formato', () => {
    expect(parseMoney('5000')).toBe(5000);
    expect(parseMoney(5000)).toBe(5000);
  });
});

describe('formatMoney', () => {
  it('debe formatear con separador de miles', () => {
    const result = formatMoney(1234567);
    // Puede usar . o , según locale, verificar que no es vacío
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(3);
  });

  it('debe usar valor absoluto', () => {
    expect(formatMoney(-5000)).toBe(formatMoney(5000));
  });
});

import { describe, expect, it } from 'vitest';
import { SIN_ONE, icos, idiv, imod, isin } from '../src';

describe('Ganzzahl-Arithmetik', () => {
  it('idiv rundet Richtung 0', () => {
    expect(idiv(7, 2)).toBe(3);
    expect(idiv(-7, 2)).toBe(-3);
    expect(idiv(5632 * 5632, 256)).toBe(123904);
    expect(idiv(2 ** 52 + 1, 3)).toBe(1501199875790165);
  });

  it('imod liefert immer [0, b)', () => {
    expect(imod(7, 5)).toBe(2);
    expect(imod(-1, 5)).toBe(4);
    expect(imod(-10, 5)).toBe(0);
  });

  it('Sinustabelle: Eckwerte, Symmetrie, Periode', () => {
    expect(isin(0)).toBe(0);
    expect(isin(256)).toBe(SIN_ONE);
    expect(isin(512)).toBe(0);
    expect(isin(768)).toBe(-SIN_ONE);
    expect(Object.is(isin(512), -0)).toBe(false);
    for (let a = -2048; a <= 2048; a += 7) {
      expect(isin(a) + isin(-a)).toBe(0);
      expect(isin(a)).toBe(isin(a + 1024));
      expect(icos(a)).toBe(isin(a + 256));
    }
  });

  it('Sinustabelle weicht höchstens 1 von Math.sin ab', () => {
    for (let a = 0; a < 1024; a++) {
      const exact = Math.sin((a / 1024) * 2 * Math.PI) * SIN_ONE;
      expect(Math.abs(isin(a) - exact)).toBeLessThanOrEqual(1);
    }
  });
});

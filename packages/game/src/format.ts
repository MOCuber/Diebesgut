import { TICKS_PER_SECOND } from '@diebesgut/sim';

/** Ticks als Sekunden mit Komma, z. B. „12,34“. */
export function seconds(ticks: number, digits = 2): string {
  return (ticks / TICKS_PER_SECOND).toFixed(digits).replace('.', ',');
}

/** Zahl mit deutschem Dezimalkomma. */
export function num(v: number, digits = 2): string {
  return v.toFixed(digits).replace('.', ',');
}

export function keyCount(mask: number): number {
  return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
}

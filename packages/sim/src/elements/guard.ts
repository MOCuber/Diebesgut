import type { Dungeon, Element } from '../dungeon';
import { solid } from '../terrain';
import { imod } from '../units';
import type { ElementBehavior } from './behavior';

// Wächter: läuft auf seinem Boden hin und her und wendet an Kante oder Wand. Der Weg hängt nur vom
// festen Gelände ab, deshalb ist der Wächter eine reine Funktion des Ticks. p = [tempo].

/** SE pro Tick: 1,9 / 2,8 / 3,8 Kacheln pro Sekunde */
export const GUARD_SPEED: readonly number[] = [8, 12, 16];
export const GUARD_W = 176;
export const GUARD_H = 240;

/** Erste und letzte Kachel, die der Wächter von seiner Kachel aus erreicht. */
export function guardRange(el: Element, d: Dungeon): { x0: number; x1: number } {
  let x0 = el.x;
  while (!solid(d, x0 - 1, el.y) && solid(d, x0 - 1, el.y + 1)) x0--;
  let x1 = el.x;
  while (!solid(d, x1 + 1, el.y) && solid(d, x1 + 1, el.y + 1)) x1++;
  return { x0, x1 };
}

/** Linke obere Ecke des Wächters zum Tick t und seine Laufrichtung. */
export function guardPos(el: Element, d: Dungeon, t: number): { x: number; y: number; dir: 1 | -1 } {
  const { x0, x1 } = guardRange(el, d);
  const L = ((x1 - x0 + 1) << 8) - GUARD_W;
  const s0 = ((el.x - x0) << 8) + ((256 - GUARD_W) >> 1);
  const y = (el.y << 8) + 256 - GUARD_H;
  if (L <= 0) return { x: (x0 << 8) + ((256 - GUARD_W) >> 1), y, dir: 1 };
  const v = GUARD_SPEED[el.p[0]] ?? GUARD_SPEED[1];
  const u = imod(s0 + t * v, 2 * L);
  return u <= L ? { x: (x0 << 8) + u, y, dir: 1 } : { x: (x0 << 8) + 2 * L - u, y, dir: -1 };
}

export const guard: ElementBehavior = {
  dynSize: 0,

  footprint(el, d, out) {
    const { x0, x1 } = guardRange(el, d);
    for (let x = x0; x <= x1; x++) out.push({ x, y: el.y });
  },

  check(el, d, report) {
    if (!solid(d, el.x, el.y + 1)) report('Der Wächter braucht Boden unter sich');
  },

  shapes(el, d, t, _dyn, _off, id, out) {
    const p = guardPos(el, d, t);
    out.rect(id, p.x + 16, p.y + 24, GUARD_W - 32, GUARD_H - 24, true);
  },
};

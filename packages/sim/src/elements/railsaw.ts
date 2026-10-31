import { TEMPO } from '../constants';
import type { Element } from '../dungeon';
import { inGrid, solid } from '../terrain';
import { imod } from '../units';
import type { ElementBehavior } from './behavior';
import { SAW_RADIUS } from './saw';

// Schienensäge: pendelt zwischen der eigenen Kachel und (x + dx, y + dy), waagerecht oder
// senkrecht, höchstens 6 Kacheln. p = [dx, dy, tempo, phase].

export const RAIL_MAX = 6;

/** Zurückgelegte Strecke in SE vom Startpunkt zum Tick t (Dreieckswelle). */
export function railsawOffset(el: Element, t: number): number {
  const len = (Math.abs(el.p[0]) + Math.abs(el.p[1])) << 8;
  if (len === 0) return 0;
  const v = TEMPO[el.p[2]] ?? TEMPO[1];
  // Die Phase verschiebt um Achtel des Zyklus (2 · len); len ist ein Vielfaches von 256.
  const u = imod(t * v + el.p[3] * (len >> 2), 2 * len);
  return u <= len ? u : 2 * len - u;
}

/** Mittelpunkt der Säge zum Tick t in SE. */
export function railsawCenter(el: Element, t: number): { x: number; y: number } {
  const s = railsawOffset(el, t);
  return { x: (el.x << 8) + 128 + Math.sign(el.p[0]) * s, y: (el.y << 8) + 128 + Math.sign(el.p[1]) * s };
}

export const railsaw: ElementBehavior = {
  dynSize: 0,

  footprint(el, _d, out) {
    const n = Math.abs(el.p[0]) + Math.abs(el.p[1]);
    const sx = Math.sign(el.p[0]);
    const sy = Math.sign(el.p[1]);
    for (let i = 0; i <= n; i++) out.push({ x: el.x + sx * i, y: el.y + sy * i });
  },

  check(el, d, report) {
    const [dx, dy] = el.p;
    if ((dx === 0) === (dy === 0)) {
      report('Die Schiene läuft entweder waagerecht oder senkrecht');
      return;
    }
    if (Math.abs(dx) + Math.abs(dy) > RAIL_MAX) report(`Die Schiene ist höchstens ${RAIL_MAX} Kacheln lang`);
    const n = Math.abs(dx) + Math.abs(dy);
    for (let i = 1; i <= n; i++) {
      const x = el.x + Math.sign(dx) * i;
      const y = el.y + Math.sign(dy) * i;
      if (!inGrid(x, y) || solid(d, x, y)) {
        report('Die Schiene läuft durch eine Wand');
        return;
      }
    }
  },

  shapes(el, _d, t, _dyn, _off, id, out) {
    const s = railsawOffset(el, t);
    out.circle(id, (el.x << 8) + 128 + Math.sign(el.p[0]) * s, (el.y << 8) + 128 + Math.sign(el.p[1]) * s, SAW_RADIUS, true);
  },
};

import type { Dungeon, Element } from '../dungeon';
import { solid } from '../terrain';
import { imod } from '../units';
import type { ElementBehavior } from './behavior';
import { DIR_DX, DIR_DY } from './info';

// Flammendüse: Strahl bis 3 Kacheln lang, an/aus im Takt. Die Düse sitzt an der Wand gegenüber
// der Strahlrichtung; der Strahl endet an der ersten festen Kachel. p = [dir, takt, phase].

export const FLAME_LEN = 3;
export const FLAME_PERIOD = 120;
/** Ticks aus/an je Takt: 1/1 s, 0,5/1,5 s und 1,5/0,5 s (an/aus). */
export const FLAME_TAKT: readonly (readonly [number, number])[] = [
  [60, 60],
  [90, 30],
  [30, 90],
];
/** Grafik: Strahlbreite 176 SE; Trefferfläche schmaler und an beiden Enden gekürzt. */
export const FLAME_DRAW_WIDTH = 176;
const HIT_WIDTH = 136;
const HIT_BASE = 40;
const HIT_TIP = 24;

/** Position im Zyklus zum Tick t; brennt, sobald pos ≥ off. */
export function flameCycle(el: Element, t: number): { pos: number; off: number } {
  return { pos: imod(t + el.p[2] * 15, FLAME_PERIOD), off: (FLAME_TAKT[el.p[1]] ?? FLAME_TAKT[0])[0] };
}

/** Strahllänge in Kacheln (1…3), ab der Düsenkachel bis vor die erste Wand. */
export function flameLength(el: Element, d: Dungeon): number {
  const dx = DIR_DX[el.p[0]];
  const dy = DIR_DY[el.p[0]];
  let n = 0;
  while (n < FLAME_LEN && !solid(d, el.x + dx * n, el.y + dy * n)) n++;
  return n;
}

export const flame: ElementBehavior = {
  dynSize: 0,

  footprint(el, d, out) {
    const n = Math.max(1, flameLength(el, d));
    for (let i = 0; i < n; i++) out.push({ x: el.x + DIR_DX[el.p[0]] * i, y: el.y + DIR_DY[el.p[0]] * i });
  },

  check(el, d, report) {
    const dir = el.p[0];
    if (!solid(d, el.x - DIR_DX[dir], el.y - DIR_DY[dir])) report('Die Flammendüse braucht Boden, Wand oder Decke dahinter');
  },

  shapes(el, d, t, _dyn, _off, id, out) {
    const pos = imod(t + el.p[2] * 15, FLAME_PERIOD);
    const on = pos >= (FLAME_TAKT[el.p[1]] ?? FLAME_TAKT[0])[0];
    const n = Math.max(1, flameLength(el, d));
    const X = el.x << 8;
    const Y = el.y << 8;
    const along = (n << 8) - HIT_BASE - HIT_TIP;
    const side = (256 - HIT_WIDTH) >> 1;
    switch (el.p[0]) {
      case 0: // nach oben, Düse am Boden
        out.rect(id, X + side, Y + 256 - (n << 8) + HIT_TIP, HIT_WIDTH, along, on);
        break;
      case 1: // nach rechts, Düse an der linken Wand
        out.rect(id, X + HIT_BASE, Y + side, along, HIT_WIDTH, on);
        break;
      case 2: // nach unten, Düse an der Decke
        out.rect(id, X + side, Y + HIT_BASE, HIT_WIDTH, along, on);
        break;
      default: // nach links, Düse an der rechten Wand
        out.rect(id, X + 256 - (n << 8) + HIT_TIP, Y + side, along, HIT_WIDTH, on);
    }
  },
};

import type { Dungeon, Element } from '../dungeon';
import { freeRun, solid } from '../terrain';
import { idiv, imod } from '../units';
import type { ElementBehavior } from './behavior';

// Stampfer: hängt an der Decke, fällt bis zu 5 Kacheln (bis zum Boden), bleibt kurz unten und
// hebt sich langsam wieder. p = [takt, phase]. Tödlich ist der Kopf, nicht die Stange.

/** Zyklus in Ticks: 2 / 3 / 4 s */
export const STOMPER_PERIOD: readonly number[] = [120, 180, 240];
export const STOMPER_MAX = 5;

/** Weiteste Fallhöhe in SE: freie Kacheln unter dem Kopf, höchstens 5. */
export function stomperMaxDrop(el: Element, d: Dungeon): number {
  return freeRun(d, el.x, el.y + 1, 0, 1, STOMPER_MAX) << 8;
}

/** Fallhöhe des Kopfes zum Tick t in SE. */
export function stomperDrop(el: Element, d: Dungeon, t: number): number {
  const P = STOMPER_PERIOD[el.p[0]] ?? STOMPER_PERIOD[1];
  const D = stomperMaxDrop(el, d);
  const c = imod(t + idiv(P * el.p[1], 8), P);
  const hold = idiv(P * 2, 5); // 40 % oben warten
  const down = hold + idiv(P, 4); // 25 % fallen und unten bleiben
  if (c < hold) return 0;
  if (c < down) {
    const k = c - hold;
    return Math.min(D, 4 * k * k);
  }
  return D - idiv(D * (c - down), P - down);
}

export const stomper: ElementBehavior = {
  dynSize: 0,

  footprint(el, d, out) {
    const n = stomperMaxDrop(el, d) >> 8;
    for (let k = 0; k <= n; k++) out.push({ x: el.x, y: el.y + k });
  },

  check(el, d, report) {
    if (!solid(d, el.x, el.y - 1)) report('Der Stampfer braucht eine Decke darüber');
    else if (stomperMaxDrop(el, d) === 0) report('Der Stampfer braucht Platz nach unten');
  },

  shapes(el, d, t, _dyn, _off, id, out) {
    out.rect(id, (el.x << 8) + 20, (el.y << 8) + stomperDrop(el, d, t) + 20, 216, 216, true);
  },
};

import type { Element } from '../dungeon';
import { SIN_ONE, icos, idiv, imod, isin } from '../units';
import type { ElementBehavior } from './behavior';
import { SAW_RADIUS } from './saw';

// Kreisbahnsäge: kreist um die Mitte ihrer Kachel. p = [radius 1…3, umlauf, dreh, phase].

/** Umlaufzeit in Ticks: 4 / 3 / 2 s */
export const ORBIT_PERIOD: readonly number[] = [240, 180, 120];

/** Winkel in 1/1024 Umdrehungen zum Tick t; im Uhrzeigersinn wächst er (y zeigt nach unten). */
export function orbitAngle(el: Element, t: number): number {
  const P = ORBIT_PERIOD[el.p[1]] ?? ORBIT_PERIOD[1];
  const a = idiv(imod(t, P) * 1024, P) + el.p[3] * 128;
  return el.p[2] === 0 ? a : 0 - a;
}

export function orbitCenter(el: Element, t: number): { x: number; y: number } {
  const a = orbitAngle(el, t);
  const R = el.p[0] << 8;
  return {
    x: (el.x << 8) + 128 + idiv(R * icos(a), SIN_ONE),
    y: (el.y << 8) + 128 + idiv(R * isin(a), SIN_ONE),
  };
}

export const orbitsaw: ElementBehavior = {
  dynSize: 0,

  footprint(el, _d, out) {
    const r = el.p[0] + 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) out.push({ x: el.x + dx, y: el.y + dy });
    }
  },

  shapes(el, _d, t, _dyn, _off, id, out) {
    const a = orbitAngle(el, t);
    const R = el.p[0] << 8;
    out.circle(id, (el.x << 8) + 128 + idiv(R * icos(a), SIN_ONE), (el.y << 8) + 128 + idiv(R * isin(a), SIN_ONE), SAW_RADIUS, true);
  },
};

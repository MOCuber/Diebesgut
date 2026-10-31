import type { Element } from '../dungeon';
import { solid } from '../terrain';
import { SIN_ONE, icos, idiv, imod, isin } from '../units';
import type { ElementBehavior } from './behavior';

// Pendelklinge: hängt an der Decke über ihrer Kachel und schwingt ±60° an einer Kette.
// p = [kette 2…4 Kacheln, periode, phase].

/** Periode in Ticks: 3 / 2,5 / 2 s */
export const PENDULUM_PERIOD: readonly number[] = [180, 150, 120];
/** ±60° in 1/1024 Umdrehungen */
export const PENDULUM_AMPLITUDE = 171;
export const PENDULUM_BLADE = 120;
/** sin 60° · SIN_ONE */
const SIN60 = 14189;

/** Auslenkung in 1/1024 Umdrehungen zum Tick t (0 = senkrecht nach unten). */
export function pendulumAngle(el: Element, t: number): number {
  const P = PENDULUM_PERIOD[el.p[1]] ?? PENDULUM_PERIOD[0];
  const a = idiv(imod(t, P) * 1024, P) + el.p[2] * 128;
  return idiv(PENDULUM_AMPLITUDE * isin(a), SIN_ONE);
}

/** Aufhängung (Oberkante der Kachel) und Mitte der Klinge zum Tick t, in SE. */
export function pendulumPos(el: Element, t: number): { px: number; py: number; bx: number; by: number } {
  const phi = pendulumAngle(el, t);
  const L = el.p[0] << 8;
  const px = (el.x << 8) + 128;
  const py = el.y << 8;
  return { px, py, bx: px + idiv(L * isin(phi), SIN_ONE), by: py + idiv(L * icos(phi), SIN_ONE) };
}

export const pendulum: ElementBehavior = {
  dynSize: 0,

  footprint(el, _d, out) {
    const L = el.p[0] << 8;
    const reach = idiv(L * SIN60, SIN_ONE) + PENDULUM_BLADE;
    const px = (el.x << 8) + 128;
    const x0 = (px - reach) >> 8;
    const x1 = (px + reach) >> 8;
    const y1 = ((el.y << 8) + L + PENDULUM_BLADE) >> 8;
    for (let y = el.y; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y });
  },

  check(el, d, report) {
    if (!solid(d, el.x, el.y - 1)) report('Die Pendelklinge braucht eine Decke darüber');
  },

  shapes(el, _d, t, _dyn, _off, id, out) {
    const p = pendulumPos(el, t);
    out.circle(id, p.bx, p.by, PENDULUM_BLADE, true);
  },
};

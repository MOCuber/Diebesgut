import { BOLT_SPEED } from '../constants';
import type { Dungeon, Element } from '../dungeon';
import type { ShapeList } from '../shapes';
import { freeRun, solid } from '../terrain';
import { idiv } from '../units';
import type { ElementBehavior } from './behavior';
import { DIR_DX, DIR_DY } from './info';

// Armbrust: an der Wand gegenüber der Schussrichtung, schießt im festen Intervall Bolzen bis zur
// nächsten Wand. Periodisch: Die Bolzen zum Tick t ergeben sich allein aus t. p = [dir, intervall, phase].

/** Intervall in Ticks: 1 / 1,5 / 2 s */
export const CROSSBOW_INTERVAL: readonly number[] = [60, 90, 120];
export const BOLT_LENGTH = 72;
export const BOLT_WIDTH = 20;
/** Abstand der Bolzenspitze beim Abschuss von der Befestigung */
const MOUTH = 120;

/** Flugstrecke ab der Befestigung bis zur Wand, in SE. */
export function crossbowRange(el: Element, d: Dungeon): number {
  return freeRun(d, el.x, el.y, DIR_DX[el.p[0]], DIR_DY[el.p[0]], 22) << 8;
}

/**
 * Spitze des Bolzens in Fach 0 oder 1 (abwechselnd belegt, damit ein Bolzen sein Fach behält),
 * gemessen ab der Befestigung, oder -1, wenn dort gerade keiner fliegt.
 */
export function crossbowBolt(el: Element, range: number, t: number, slot: number): number {
  const I = CROSSBOW_INTERVAL[el.p[1]] ?? CROSSBOW_INTERVAL[1];
  const shift = idiv(I * el.p[2], 8);
  const m = idiv(t + shift, I);
  const k = (m & 1) === slot ? m : m - 1;
  const fired = k * I - shift;
  if (k < 0 || fired < 0) return -1;
  const tip = MOUTH + (t - fired) * BOLT_SPEED;
  return tip <= range ? tip : -1;
}

function boltShape(el: Element, tip: number, id: number, on: boolean, out: ShapeList): void {
  const X = el.x << 8;
  const Y = el.y << 8;
  const side = (256 - BOLT_WIDTH) >> 1;
  const a = Math.max(0, tip - BOLT_LENGTH);
  switch (el.p[0]) {
    case 0:
      out.rect(id, X + side, Y + 256 - tip, BOLT_WIDTH, tip - a, on);
      break;
    case 1:
      out.rect(id, X + a, Y + side, tip - a, BOLT_WIDTH, on);
      break;
    case 2:
      out.rect(id, X + side, Y + a, BOLT_WIDTH, tip - a, on);
      break;
    default:
      out.rect(id, X + 256 - tip, Y + side, tip - a, BOLT_WIDTH, on);
  }
}

export const crossbow: ElementBehavior = {
  dynSize: 0,

  footprint(el, d, out) {
    const n = Math.max(1, crossbowRange(el, d) >> 8);
    for (let i = 0; i < n; i++) out.push({ x: el.x + DIR_DX[el.p[0]] * i, y: el.y + DIR_DY[el.p[0]] * i });
  },

  check(el, d, report) {
    const dir = el.p[0];
    if (!solid(d, el.x - DIR_DX[dir], el.y - DIR_DY[dir])) report('Die Armbrust braucht Boden, Wand oder Decke dahinter');
  },

  shapes(el, d, t, _dyn, _off, id, out) {
    const range = crossbowRange(el, d);
    for (let slot = 0; slot < 2; slot++) {
      const tip = crossbowBolt(el, range, t, slot);
      boltShape(el, tip < 0 ? MOUTH : tip, id, tip >= 0, out);
    }
  },
};

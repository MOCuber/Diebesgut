import { solid } from '../terrain';
import type { ElementBehavior } from './behavior';
import { DIR_DX, DIR_DY } from './info';

// Stacheln: statisch, 1 Kachel. p[0] = Ausrichtung der Spitzen (0 oben, 1 rechts, 2 unten,
// 3 links); befestigt sind sie auf der gegenüberliegenden Seite.

/** Grafik: ein 112 SE tiefes Band an der Befestigungsseite. */
export const SPIKE_DEPTH = 112;
// Trefferfläche rund 15 % kleiner als die Grafik.
const HIT_DEPTH = 88;
const HIT_INSET = 16;
const HIT_LEN = 256 - 2 * HIT_INSET;

export const spikes: ElementBehavior = {
  dynSize: 0,

  footprint(el, _d, out) {
    out.push({ x: el.x, y: el.y });
  },

  check(el, d, report) {
    const dir = el.p[0];
    if (!solid(d, el.x - DIR_DX[dir], el.y - DIR_DY[dir])) report('Stacheln brauchen Boden, Wand oder Decke dahinter');
  },

  shapes(el, _d, _t, _dyn, _off, id, out) {
    const X = el.x << 8;
    const Y = el.y << 8;
    switch (el.p[0]) {
      case 0:
        out.rect(id, X + HIT_INSET, Y + 256 - HIT_DEPTH, HIT_LEN, HIT_DEPTH, true);
        break;
      case 1:
        out.rect(id, X, Y + HIT_INSET, HIT_DEPTH, HIT_LEN, true);
        break;
      case 2:
        out.rect(id, X + HIT_INSET, Y, HIT_LEN, HIT_DEPTH, true);
        break;
      default:
        out.rect(id, X + 256 - HIT_DEPTH, Y + HIT_INSET, HIT_DEPTH, HIT_LEN, true);
    }
  },
};

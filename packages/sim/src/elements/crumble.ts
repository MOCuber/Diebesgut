import { GRID_W } from '../constants';
import { rectsOverlap } from '../shapes';
import type { ElementBehavior } from './behavior';

// Bröckelboden: eine feste Kachel, die 0,4 s nach dem Betreten bricht und nach 3 s wiederkommt.
// dyn = [Zustand, Zähler]; Zustand 0 = intakt, 1 = bröckelt, 2 = weg.

export const CRUMBLE_DELAY = 24;
export const CRUMBLE_RESPAWN = 180;

export const crumble: ElementBehavior = {
  dynSize: 2,

  footprint(el, _d, out) {
    out.push({ x: el.x, y: el.y });
  },

  update(el, _d, run, _t, off) {
    const dyn = run.dyn;
    const th = run.thief;
    const W = run.phys.thiefW;
    const H = run.phys.thiefH;
    const X = el.x << 8;
    const Y = el.y << 8;
    switch (dyn[off]) {
      case 0:
        // Betreten: der Dieb steht genau auf dieser Kachel
        if (th.ground && th.y + H === Y && th.x < X + 256 && th.x + W > X) {
          dyn[off] = 1;
          dyn[off + 1] = CRUMBLE_DELAY;
        }
        break;
      case 1:
        if (--dyn[off + 1] <= 0) {
          dyn[off] = 2;
          dyn[off + 1] = CRUMBLE_RESPAWN;
        }
        break;
      default:
        // kommt erst zurück, wenn der Dieb nicht in der Kachel steckt
        if (dyn[off + 1] > 0) dyn[off + 1]--;
        else if (!rectsOverlap(th.x, th.y, W, H, X, Y, 256, 256)) dyn[off] = 0;
    }
  },

  blocks(el, dyn, off, block) {
    if (dyn[off] !== 2) block[el.y * GRID_W + el.x] = 1;
  },
};

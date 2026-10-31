import { solid } from '../terrain';
import type { ElementBehavior } from './behavior';

// Prallbrett: hängt an einer Wand. Läuft der Dieb auf seiner Höhe gegen diese Wand, am Boden oder
// in der Luft, drückt es ihn in die andere Richtung. Gegenstück zum Stehenbleiben an Wänden.
// p = [seite]: 0 = Wand links (drückt nach rechts), 1 = Wand rechts (drückt nach links).

export const BUMPER_DEPTH = 56;

export const bumper: ElementBehavior = {
  dynSize: 0,

  footprint(el, _d, out) {
    out.push({ x: el.x, y: el.y });
  },

  check(el, d, report) {
    const wx = el.p[0] === 0 ? el.x - 1 : el.x + 1;
    if (!solid(d, wx, el.y)) report('Das Prallbrett braucht eine Wand auf dieser Seite');
  },

  update(el, _d, run) {
    const th = run.thief;
    const X = el.x << 8;
    const Y = el.y << 8;
    if (th.y >= Y + 256 || th.y + run.phys.thiefH <= Y) return;
    if (el.p[0] === 0) {
      if (th.dir === -1 && th.x === X) {
        th.dir = 1;
        th.wall = 0;
      }
    } else if (th.dir === 1 && th.x + run.phys.thiefW === X + 256) {
      th.dir = -1;
      th.wall = 0;
    }
  },
};

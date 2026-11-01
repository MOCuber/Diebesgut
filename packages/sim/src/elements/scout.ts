import { BOLT_SPEED, GRID_W } from '../constants';
import type { Dungeon, Element } from '../dungeon';
import { rectsOverlap } from '../shapes';
import { freeRun } from '../terrain';
import type { ElementBehavior } from './behavior';
import { BOLT_LENGTH, BOLT_WIDTH } from './crossbow';

// Späher: blickt nach links oder rechts. Betritt der Dieb seine Sichtlinie, schießt er 0,4 s später
// einen Bolzen, danach macht er 1,5 s Pause. p = [blick]; dyn = [Zustand, Zähler, Bolzenspitze oder -1].
// Zustand 0 = wacht, 1 = zielt, 2 = Pause.

export const SCOUT_AIM = 24;
export const SCOUT_PAUSE = 90;

export function scoutDir(el: Element): 1 | -1 {
  return el.p[0] === 0 ? -1 : 1;
}

/** Sichtlinie in SE: vom Auge (Kachelmitte) bis zur nächsten Wand. */
export function scoutSight(el: Element, d: Dungeon): { from: number; to: number } {
  const dir = scoutDir(el);
  const eye = (el.x << 8) + 128;
  const n = freeRun(d, el.x + dir, el.y, dir, 0, GRID_W);
  return dir > 0 ? { from: eye, to: (el.x + 1 + n) << 8 } : { from: (el.x - n) << 8, to: eye };
}

export const scout: ElementBehavior = {
  dynSize: 3,

  footprint(el, d, out) {
    const s = scoutSight(el, d);
    for (let x = s.from >> 8; x <= (s.to - 1) >> 8; x++) out.push({ x, y: el.y });
  },

  init(_el, _d, dyn, off) {
    dyn[off + 2] = -1;
  },

  update(el, d, run, _t, off) {
    const dyn = run.dyn;
    const th = run.thief;
    const dir = scoutDir(el);
    const sight = scoutSight(el, d);
    const Y = el.y << 8;

    // Fliegender Bolzen
    let tip = dyn[off + 2];
    if (tip >= 0) {
      tip += dir * BOLT_SPEED;
      dyn[off + 2] = tip > sight.to || tip < sight.from ? -1 : tip;
    }

    switch (dyn[off]) {
      case 0:
        if (rectsOverlap(th.x, th.y, run.phys.thiefW, run.phys.thiefH, sight.from, Y + 16, sight.to - sight.from, 224)) {
          dyn[off] = 1;
          dyn[off + 1] = SCOUT_AIM;
        }
        break;
      case 1:
        if (--dyn[off + 1] <= 0) {
          dyn[off + 2] = (el.x << 8) + 128;
          dyn[off] = 2;
          dyn[off + 1] = SCOUT_PAUSE;
        }
        break;
      default:
        if (--dyn[off + 1] <= 0) dyn[off] = 0;
    }
  },

  shapes(el, _d, _t, dyn, off, id, out) {
    const tip = dyn[off + 2];
    const y = (el.y << 8) + ((256 - BOLT_WIDTH) >> 1);
    const x = tip < 0 ? (el.x << 8) + 128 : tip;
    if (scoutDir(el) > 0) out.rect(id, x - BOLT_LENGTH, y, BOLT_LENGTH, BOLT_WIDTH, tip >= 0);
    else out.rect(id, x, y, BOLT_LENGTH, BOLT_WIDTH, tip >= 0);
  },
};

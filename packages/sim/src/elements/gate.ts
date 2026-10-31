import { GRID_H, GRID_W } from '../constants';
import type { Element } from '../dungeon';
import { rectsOverlap } from '../shapes';
import { inGrid, solid } from '../terrain';
import type { ElementBehavior } from './behavior';

// Schalter + Tor: Die Schalterplatte liegt auf der Elementkachel, das Tor (1 × 3 Kacheln, senkrecht)
// bei (x + gx, y + gy). Betritt der Dieb die Platte, öffnet das Tor für die eingestellte Dauer.
// p = [gx, gy, dauer]; dyn = [Restzeit, offen].

export const GATE_DURATION: readonly number[] = [120, 240, 360];
export const GATE_HEIGHT = 3;
/** Schalterplatte im unteren Teil der Kachel (relativ zur Kachel, SE). */
export const SWITCH_BOX = { dx: 36, dy: 214, w: 184, h: 42 } as const;

/** Oberste Torkachel. */
export function gateTile(el: Element): { x: number; y: number } {
  return { x: el.x + el.p[0], y: el.y + el.p[1] };
}

export const gate: ElementBehavior = {
  dynSize: 2,

  footprint(el, _d, out) {
    out.push({ x: el.x, y: el.y });
    const g = gateTile(el);
    for (let k = 0; k < GATE_HEIGHT; k++) out.push({ x: g.x, y: g.y + k });
  },

  check(el, d, report) {
    if (!solid(d, el.x, el.y + 1)) report('Der Schalter braucht Boden darunter');
    const g = gateTile(el);
    for (let k = 0; k < GATE_HEIGHT; k++) {
      const y = g.y + k;
      if (!inGrid(g.x, y) || solid(d, g.x, y)) {
        report('Das Tor steckt in einer Wand');
        return;
      }
      if (g.x === el.x && y === el.y) {
        report('Tor und Schalter liegen übereinander');
        return;
      }
      for (const o of [d.start, d.chest, d.keys[0], d.keys[1], d.keys[2]]) {
        if (o.x === g.x && o.y === y) {
          report('Das Tor versperrt Start, Truhe oder einen Schlüssel');
          return;
        }
      }
    }
  },

  update(el, _d, run, _t, off) {
    const dyn = run.dyn;
    const th = run.thief;
    const W = run.phys.thiefW;
    const H = run.phys.thiefH;
    if (rectsOverlap(th.x, th.y, W, H, (el.x << 8) + SWITCH_BOX.dx, (el.y << 8) + SWITCH_BOX.dy, SWITCH_BOX.w, SWITCH_BOX.h)) {
      dyn[off] = GATE_DURATION[el.p[2]] ?? GATE_DURATION[1];
      dyn[off + 1] = 1;
    } else if (dyn[off] > 0) {
      dyn[off]--;
    }
    if (dyn[off] === 0 && dyn[off + 1] === 1) {
      // schließt erst, wenn der Dieb nicht im Tor steht
      const g = gateTile(el);
      if (!rectsOverlap(th.x, th.y, W, H, g.x << 8, g.y << 8, 256, GATE_HEIGHT << 8)) dyn[off + 1] = 0;
    }
  },

  blocks(el, dyn, off, block) {
    if (dyn[off + 1] === 1) return;
    const g = gateTile(el);
    for (let k = 0; k < GATE_HEIGHT; k++) {
      const y = g.y + k;
      if (g.x >= 0 && g.x < GRID_W && y >= 0 && y < GRID_H) block[y * GRID_W + g.x] = 1;
    }
  },
};

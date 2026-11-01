import { rectsOverlap } from '../shapes';
import { solid } from '../terrain';
import type { ElementBehavior } from './behavior';

// Sprungfeder: schleudert den Dieb mit vy = springVy (84) nach oben, 4,4 Felder hoch (gut zwei Blöcke).

/** Auslösefläche: der Federteller im unteren Teil der Kachel (relativ zur Kachel, SE). */
export const SPRING_BOX = { dx: 40, dy: 150, w: 176, h: 106 } as const;

export const spring: ElementBehavior = {
  dynSize: 0,

  footprint(el, _d, out) {
    out.push({ x: el.x, y: el.y });
  },

  check(el, d, report) {
    if (!solid(d, el.x, el.y + 1)) report('Die Sprungfeder braucht Boden darunter');
  },

  update(el, _d, run) {
    const th = run.thief;
    const ph = run.phys;
    if (th.vy > 0) return;
    if (!rectsOverlap(th.x, th.y, ph.thiefW, ph.thiefH, (el.x << 8) + SPRING_BOX.dx, (el.y << 8) + SPRING_BOX.dy, SPRING_BOX.w, SPRING_BOX.h)) return;
    th.vy = ph.springVy;
    th.ground = false;
    th.coyote = 0;
    th.wall = 0;
    // kein eigener Absprung: Loslassen bremst die Feder nicht
    th.jumpTick = -1;
  },
};

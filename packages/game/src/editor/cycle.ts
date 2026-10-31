import {
  ET,
  GUARD_W,
  PENDULUM_AMPLITUDE,
  crossbowBolt,
  crossbowRange,
  flameCycle,
  guardPos,
  guardRange,
  orbitAngle,
  pendulumAngle,
  railsawOffset,
  stomperDrop,
  stomperMaxDrop,
  type Dungeon,
  type Element,
} from '@diebesgut/sim';

/** Was der Zyklus-Streifen eines Elements zeigt. */
export function cycleLabel(el: Element): string | null {
  switch (el.type) {
    case ET.FLAME:
      return 'an / aus';
    case ET.RAILSAW:
    case ET.GUARD:
      return 'hin / her';
    case ET.ORBITSAW:
      return 'Höhe der Säge';
    case ET.PENDULUM:
      return 'Ausschlag';
    case ET.STOMPER:
      return 'Fallhöhe';
    case ET.CROSSBOW:
      return 'Schüsse';
    default:
      return null;
  }
}

/** Zustand eines periodischen Elements zum Tick t als Wert 0…1; null = kein fester Zyklus. */
export function cycleLevel(el: Element, d: Dungeon, t: number): number | null {
  switch (el.type) {
    case ET.FLAME: {
      const c = flameCycle(el, t);
      return c.pos >= c.off ? 1 : c.pos >= c.off - 20 ? 0.4 : 0;
    }
    case ET.RAILSAW: {
      const len = (Math.abs(el.p[0]) + Math.abs(el.p[1])) * 256;
      return len ? railsawOffset(el, t) / len : 0;
    }
    case ET.ORBITSAW:
      return (1 + Math.sin((orbitAngle(el, t) / 1024) * 2 * Math.PI)) / 2;
    case ET.PENDULUM:
      return (pendulumAngle(el, t) + PENDULUM_AMPLITUDE) / (2 * PENDULUM_AMPLITUDE);
    case ET.STOMPER: {
      const m = stomperMaxDrop(el, d);
      return m ? stomperDrop(el, d, t) / m : 0;
    }
    case ET.CROSSBOW: {
      const r = crossbowRange(el, d);
      let level = 0;
      for (let slot = 0; slot < 2; slot++) {
        const tip = crossbowBolt(el, r, t, slot);
        if (tip >= 0) level = Math.max(level, 1 - tip / r);
      }
      return level;
    }
    case ET.GUARD: {
      const g = guardRange(el, d);
      const L = (g.x1 - g.x0 + 1) * 256 - GUARD_W;
      return L > 0 ? (guardPos(el, d, t).x - g.x0 * 256) / L : 0;
    }
    default:
      return null;
  }
}

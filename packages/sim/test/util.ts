import { fromJson, type Dungeon, type DungeonJson, type TickInput } from '../src';

/** Leerer Raum 14 × 8; außerhalb des Rasters ist alles fest, also Boden, Decke und Wände. */
export const FLAT_ROWS = ['..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............'];

/** Zeilen von FLAT_ROWS mit einzelnen geänderten Feldern [x, y, Zeichen]. */
export function rowsWith(changes: [number, number, string][]): string[] {
  const rows = [...FLAT_ROWS];
  for (const [x, y, ch] of changes) rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
  return rows;
}

/** Flacher Raum mit Start (2, 7) nach rechts und Schlüsseln/Truhe oben, außer Reichweite. */
export function flatRoom(extra: Partial<DungeonJson> = {}): Dungeon {
  return fromJson({
    name: 'Test',
    rows: FLAT_ROWS,
    start: { x: 2, y: 7, dir: 1 },
    chest: { x: 13, y: 1 },
    keys: [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 9, y: 1 },
    ],
    ...extra,
  });
}

export const NONE: TickInput = { held: false, pressed: false };
export const PRESS: TickInput = { held: true, pressed: true };
export const HOLD: TickInput = { held: true, pressed: false };
export const TAP: TickInput = { held: false, pressed: true };

/** Kleiner deterministischer Zufall (LCG) für Testeingaben. */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Zufällige, aber stimmige Eingabefolge: Drücke mit zufälliger Haltedauer und Pausen. */
export function randomInputs(seed: number, ticks: number): TickInput[] {
  const rnd = lcg(seed);
  const out: TickInput[] = [];
  let held = false;
  let left = 0;
  for (let t = 0; t < ticks; t++) {
    if (left <= 0) {
      if (held) {
        held = false;
        left = 2 + Math.floor(rnd() * 40);
        out.push(NONE);
      } else if (rnd() < 0.15) {
        out.push(TAP);
        left = 1 + Math.floor(rnd() * 20);
      } else {
        held = true;
        left = 1 + Math.floor(rnd() * 25);
        out.push(PRESS);
      }
      continue;
    }
    left--;
    out.push(held ? HOLD : NONE);
  }
  return out;
}

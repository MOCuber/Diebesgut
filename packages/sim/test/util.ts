import { fromJson, type Dungeon, type DungeonJson, type TickInput } from '../src';

export const FLAT_ROWS = [
  '######################',
  '#....................#',
  '#....................#',
  '#....................#',
  '#....................#',
  '#....................#',
  '#....................#',
  '#....................#',
  '#....................#',
  '#....................#',
  '#....................#',
  '######################',
];

/** Flacher Raum mit Start (3, 10) nach rechts und Schlüsseln/Truhe oben, außer Reichweite. */
export function flatRoom(extra: Partial<DungeonJson> = {}): Dungeon {
  return fromJson({
    name: 'Test',
    rows: FLAT_ROWS,
    start: { x: 3, y: 10, dir: 1 },
    chest: { x: 18, y: 1 },
    keys: [
      { x: 2, y: 1 },
      { x: 8, y: 1 },
      { x: 13, y: 1 },
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

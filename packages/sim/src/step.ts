import { DEFAULT_PHYSICS, GRID_H, GRID_W, MAX_RUN_TICKS, type Physics } from './constants';
import type { Dungeon } from './dungeon';
import { BEHAVIORS } from './elements';
import { ShapeList, rectsOverlap, shapeHitsRect, type Shape } from './shapes';
import { createThief, moveThief, type Thief, type TickInput } from './thief';

export type RunStatus = 'running' | 'dead' | 'won' | 'timeout';

export interface Run {
  /** Anzahl simulierter Ticks; der Zustand gehört zum Tick run.tick */
  tick: number;
  status: RunStatus;
  thief: Thief;
  /** Bitmaske 0b000 bis 0b111 */
  keys: number;
  /** Zustand reaktiver Elemente (Späher, Bröckelboden, Tor) */
  dyn: Int32Array;
  /** Element-ID der tödlichen Falle, -1 = keine */
  killer: number;
  phys: Physics;
  /** Kacheln, die Elemente gerade fest machen; abgeleitet aus dyn, deshalb nicht im Hash */
  block: Uint8Array;
}

/** Sammelflächen relativ zur Kachel in SE. */
export const KEY_BOX = { dx: 64, dy: 64, w: 128, h: 128 } as const;
export const CHEST_BOX = { dx: 32, dy: 96, w: 192, h: 160 } as const;

export function dynSize(d: Dungeon): number {
  let n = 0;
  for (const el of d.elements) n += BEHAVIORS[el.type]?.dynSize ?? 0;
  return n;
}

/** Erster Platz jedes Elements in run.dyn, Index = Element-ID. */
export function dynOffsets(d: Dungeon): number[] {
  const out: number[] = [];
  let off = 0;
  for (const el of d.elements) {
    out.push(off);
    off += BEHAVIORS[el.type]?.dynSize ?? 0;
  }
  return out;
}

function updateBlocks(d: Dungeon, dyn: Int32Array, block: Uint8Array): void {
  block.fill(0);
  let off = 0;
  for (const el of d.elements) {
    const b = BEHAVIORS[el.type];
    if (!b) continue;
    b.blocks?.(el, dyn, off, block);
    off += b.dynSize;
  }
}

/**
 * Neuer Lauf. from setzt den Dieb an eine andere Stelle („Test ab hier“) und zählt nie als Beweis.
 */
export function createRun(d: Dungeon, phys: Physics = DEFAULT_PHYSICS, from?: { x: number; y: number; dir: 1 | -1 }): Run {
  const s = from ?? d.start;
  const dyn = new Int32Array(dynSize(d));
  let off = 0;
  for (const el of d.elements) {
    const b = BEHAVIORS[el.type];
    if (!b) continue;
    b.init?.(el, d, dyn, off);
    off += b.dynSize;
  }
  const block = new Uint8Array(GRID_W * GRID_H);
  updateBlocks(d, dyn, block);
  return {
    tick: 0,
    status: 'running',
    thief: createThief(d, phys, s.x, s.y, s.dir, block),
    keys: 0,
    dyn,
    killer: -1,
    phys,
    block,
  };
}

export function cloneRun(r: Run): Run {
  return { ...r, thief: { ...r.thief }, dyn: r.dyn.slice(), block: r.block.slice() };
}

function collectShapes(d: Dungeon, t: number, dyn: Int32Array, out: ShapeList): void {
  out.clear();
  let off = 0;
  for (let i = 0; i < d.elements.length; i++) {
    const el = d.elements[i];
    const b = BEHAVIORS[el.type];
    if (!b) continue;
    b.shapes?.(el, d, t, dyn, off, i, out);
    off += b.dynSize;
  }
}

const scratch = new ShapeList();

/** Genau ein Tick in der verbindlichen Reihenfolge aus dem Spielkonzept. */
export function step(d: Dungeon, run: Run, input: TickInput): void {
  if (run.status !== 'running') return;
  const t = run.tick + 1;
  const th = run.thief;
  const ph = run.phys;
  const W = ph.thiefW;
  const H = ph.thiefH;

  // 1.–6. Eingabe, Sprung, Abbruch, Schwerkraft, Bewegung
  moveThief(d, th, ph, input, t, run.block);

  // 7. Fallen auf Tick t setzen (Reihenfolge nach Element-ID), dann Treffertest.
  let off = 0;
  for (let i = 0; i < d.elements.length; i++) {
    const el = d.elements[i];
    const b = BEHAVIORS[el.type];
    if (!b) continue;
    b.update?.(el, d, run, t, off);
    off += b.dynSize;
  }
  collectShapes(d, t, run.dyn, scratch);
  for (let i = 0; i < scratch.count; i++) {
    const s = scratch.items[i];
    if (s.on && shapeHitsRect(s, th.x, th.y, W, H)) {
      run.status = 'dead';
      run.killer = s.el;
      break;
    }
  }

  // 8. Schlüssel und Truhe prüfen.
  if (run.status === 'running') {
    for (let i = 0; i < 3; i++) {
      const k = d.keys[i];
      if ((run.keys & (1 << i)) === 0 && rectsOverlap(th.x, th.y, W, H, (k.x << 8) + KEY_BOX.dx, (k.y << 8) + KEY_BOX.dy, KEY_BOX.w, KEY_BOX.h)) {
        run.keys |= 1 << i;
      }
    }
    const c = d.chest;
    if (run.keys === 7 && rectsOverlap(th.x, th.y, W, H, (c.x << 8) + CHEST_BOX.dx, (c.y << 8) + CHEST_BOX.dy, CHEST_BOX.w, CHEST_BOX.h)) {
      run.status = 'won';
    }
  }

  // Feste Kacheln aus Elementen für den nächsten Tick
  updateBlocks(d, run.dyn, run.block);

  run.tick = t;
  if (run.status === 'running' && t >= MAX_RUN_TICKS) run.status = 'timeout';
}

/** Alle Formen zum Zustand des Laufs, als neue Objekte (Grafik, Editor-Vorschau, Hitbox-Anzeige). */
export function shapesAt(d: Dungeon, run: Pick<Run, 'tick' | 'dyn'>): Shape[] {
  const list = new ShapeList();
  collectShapes(d, run.tick, run.dyn, list);
  return list.items.slice(0, list.count);
}

export type { TickInput, Thief };

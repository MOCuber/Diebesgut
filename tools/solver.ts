/**
 * Lösbarkeits-Prüfer für Entwickler (nicht Teil des Spiels): sucht nach Go-Explore-Art eine
 * Eingabefolge, die den Dungeon schafft. Ein Archiv merkt sich pro grober Zelle (Position,
 * Richtung, Fallgeschwindigkeit, Schlüssel) den frühesten erreichten Zustand und erkundet von
 * dort zufällig weiter. Ein Fund beweist, dass der Dungeon lösbar ist; kein Fund beweist nichts.
 */
import { cloneRun, createRun, step, type Dungeon, type Physics, type Run, type RunStatus, type TickInput } from '@diebesgut/sim';

interface Cell {
  run: Run;
  toggles: number[];
  held: boolean;
  visits: number;
}

export interface Solution {
  toggles: number[];
  ticks: number;
}

export interface SolveResult {
  best: Solution | null;
  /** meiste Schlüssel, die die Suche in einem Lauf gesammelt hat */
  maxKeys: number;
  cells: number;
  /** weitester Lauf ohne Tod (meiste Schlüssel, dann längste Dauer), auch ohne Lösung */
  deepest: Solution;
}

export interface SolveOptions {
  iterations?: number;
  seed?: number;
  phys?: Physics;
  /** nach dem ersten Fund noch so viele Runden weitersuchen, um schneller zu werden */
  polish?: number;
}

function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function cellKey(r: Run, held: boolean): string {
  const t = r.thief;
  const vy = t.ground ? 0 : t.vy >> 4;
  return `${r.keys}|${t.x >> 6}|${t.y >> 6}|${t.dir}|${vy}|${held ? 1 : 0}`;
}

function popcount(v: number): number {
  return (v & 1) + ((v >> 1) & 1) + ((v >> 2) & 1);
}

export function solve(d: Dungeon, opts: SolveOptions = {}): SolveResult {
  const iterations = opts.iterations ?? 40000;
  const rnd = lcg(opts.seed ?? 1);
  const archive = new Map<string, Cell>();
  const byKeys: Cell[][] = [[], [], [], []];
  const all: Cell[] = [];
  const add = (c: Cell, key: string) => {
    archive.set(key, c);
    byKeys[popcount(c.run.keys)].push(c);
    all.push(c);
  };
  const start = createRun(d, opts.phys);
  add({ run: start, toggles: [], held: false, visits: 0 }, cellKey(start, false));

  let best: Solution | null = null;
  let polishLeft = opts.polish ?? 8000;

  for (let it = 0; it < iterations; it++) {
    if (best && polishLeft-- <= 0) break;

    // Zelle wählen: meist eine mit den meisten Schlüsseln; oft besuchte werden seltener genommen.
    let maxKeys = 3;
    while (byKeys[maxKeys].length === 0) maxKeys--;
    const pool = rnd() < 0.75 ? byKeys[maxKeys] : all;
    let cell = pool[Math.floor(rnd() * pool.length)];
    for (let tries = 0; tries < 8 && rnd() > 1 / Math.sqrt(1 + cell.visits); tries++) {
      cell = pool[Math.floor(rnd() * pool.length)];
    }
    cell.visits++;

    const run = cloneRun(cell.run);
    const toggles = cell.toggles.slice();
    let held = cell.held;
    let holdLeft = held ? 1 + Math.floor(rnd() * 12) : 0;
    const len = 8 + Math.floor(rnd() * 80);
    for (let k = 0; k < len && run.status === 'running'; k++) {
      if (best && run.tick >= best.ticks) break;
      let input: TickInput;
      if (held) {
        if (--holdLeft <= 0) {
          held = false;
          toggles.push(run.tick + 1);
          input = { held: false, pressed: false };
        } else {
          input = { held: true, pressed: false };
        }
      } else if (rnd() < 0.07) {
        held = true;
        holdLeft = 1 + Math.floor(rnd() * 22);
        toggles.push(run.tick + 1);
        input = { held: true, pressed: true };
      } else {
        input = { held: false, pressed: false };
      }
      step(d, run, input);
      // step() ändert den Status; TypeScript sieht das nicht
      const status = run.status as RunStatus;
      if (status === 'won') {
        if (!best || run.tick < best.ticks) best = { toggles: toggles.slice(), ticks: run.tick };
        break;
      }
      if (status !== 'running') break;
      const key = cellKey(run, held);
      const old = archive.get(key);
      if (!old) {
        add({ run: cloneRun(run), toggles: toggles.slice(), held, visits: 0 }, key);
      } else if (old.run.tick > run.tick) {
        old.run = cloneRun(run);
        old.toggles = toggles.slice();
        old.held = held;
      }
    }
  }
  let maxKeys = 3;
  while (byKeys[maxKeys].length === 0) maxKeys--;
  let deep = all[0];
  for (const c of all) {
    const score = popcount(c.run.keys) * 100000 + c.run.tick;
    if (score > popcount(deep.run.keys) * 100000 + deep.run.tick) deep = c;
  }
  return { best, maxKeys: best ? 3 : maxKeys, cells: all.length, deepest: { toggles: deep.toggles, ticks: deep.run.tick } };
}

import { describe, expect, it } from 'vitest';
import { DEFAULT_PHYSICS, MAX_RUN_TICKS, createRun, step, type Run, type TickInput } from '../src';
import { FLAT_ROWS, HOLD, NONE, PRESS, TAP, flatRoom } from './util';

/** Läuft, bis der Dieb wieder am Boden steht; liefert höchsten Punkt und Flugdauer. */
function jumpProfile(first: TickInput, rest: TickInput) {
  const d = flatRoom();
  const run = createRun(d);
  const y0 = run.thief.y;
  const x0 = run.thief.x;
  step(d, run, first);
  let minY = run.thief.y;
  let airX = run.thief.x;
  while (!run.thief.ground) {
    airX = run.thief.x;
    step(d, run, rest);
    minY = Math.min(minY, run.thief.y);
  }
  return { rise: y0 - minY, landTick: run.tick, airDist: airX - x0 };
}

describe('Sprungphysik laut Spielkonzept', () => {
  it('voller Sprung: 828 SE hoch (3,23 Kacheln), 4,4 Kacheln weit', () => {
    const p = jumpProfile(PRESS, HOLD);
    expect(p.rise).toBe(828);
    expect(p.landTick).toBe(48); // 47 Ticks in der Luft
    expect(p.airDist).toBe(47 * 24);
  });

  it('kürzester Sprung: 453 SE hoch (1,77 Kacheln)', () => {
    expect(jumpProfile(TAP, NONE).rise).toBe(453);
    expect(jumpProfile(PRESS, NONE).rise).toBe(453);
  });

  it('Haltedauer bestimmt die Höhe dazwischen', () => {
    const heights: number[] = [];
    for (let hold = 1; hold <= 20; hold++) {
      const d = flatRoom();
      const run = createRun(d);
      const y0 = run.thief.y;
      let minY = y0;
      for (let t = 1; t <= 60; t++) {
        step(d, run, t === 1 ? PRESS : t <= hold ? HOLD : NONE);
        minY = Math.min(minY, run.thief.y);
      }
      heights.push(y0 - minY);
    }
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
    expect(heights[0]).toBe(453);
    expect(heights[heights.length - 1]).toBe(828);
  });

  it('feste Sprunghöhe (A/B-Variante): Loslassen ändert nichts', () => {
    const d = flatRoom();
    const run = createRun(d, { ...DEFAULT_PHYSICS, variableJump: 0 });
    const y0 = run.thief.y;
    let minY = y0;
    step(d, run, TAP);
    for (let t = 0; t < 40; t++) {
      step(d, run, NONE);
      minY = Math.min(minY, run.thief.y);
    }
    expect(y0 - minY).toBe(828);
  });

  it('Walljump: 693 SE hoch (2,71 Kacheln) und Richtungswechsel', () => {
    // Säule rechts: der Dieb springt hinein, hängt an der Wand und springt ab.
    const rows = flatRoomRows();
    for (let y = 2; y <= 10; y++) rows[y] = setChar(rows[y], 12, '#');
    const d = flatRoom({ rows });
    const run = createRun(d);
    // bis zur Wand laufen, kurz davor voll springen
    while (run.thief.x + 152 < 12 * 256 - 60) step(d, run, NONE);
    step(d, run, PRESS);
    while (run.thief.wall === 0) step(d, run, HOLD);
    expect(run.thief.wall).toBe(1);
    step(d, run, NONE);
    const yWall = run.thief.y;
    step(d, run, PRESS);
    expect(run.thief.dir).toBe(-1);
    expect(run.thief.vy).toBe(63);
    let minY = run.thief.y;
    for (let t = 0; t < 30; t++) {
      step(d, run, HOLD);
      minY = Math.min(minY, run.thief.y);
    }
    // Absprung-Tick bewegt schon 63 SE; dazu der Rest bis zum Scheitel
    expect(yWall - minY).toBe(693);
  });

  it('am Boden dreht der Dieb an der Wand um und steckt nie in ihr', () => {
    const d = flatRoom();
    const run = createRun(d);
    let turned = -1;
    for (let t = 1; t <= 400; t++) {
      step(d, run, NONE);
      expect(run.thief.x + 152).toBeLessThanOrEqual(21 * 256);
      expect(run.thief.x).toBeGreaterThanOrEqual(256);
      if (turned < 0 && run.thief.dir === -1) turned = run.tick;
    }
    expect(turned).toBe(184);
  });

  it('an der Wand rutscht er höchstens 12 SE/Tick', () => {
    const rows = flatRoomRows();
    for (let y = 2; y <= 10; y++) rows[y] = setChar(rows[y], 12, '#');
    const d = flatRoom({ rows });
    const run = createRun(d);
    while (run.thief.x + 152 < 12 * 256 - 60) step(d, run, NONE);
    step(d, run, PRESS);
    while (run.thief.wall === 0) step(d, run, HOLD);
    for (let t = 0; t < 40 && !run.thief.ground; t++) {
      step(d, run, NONE);
      if (Math.abs(run.thief.wall) === 1) expect(run.thief.vy).toBeGreaterThanOrEqual(-12);
    }
  });

  it('Coyote-Zeit: Sprung bis 5 Ticks nach der Kante', () => {
    // run.tick ist der erste Tick in der Luft; gedrückt wird late + 1 Ticks danach.
    const results = [3, 4, 5].map((late) => {
      const { d, run } = ledgeRun();
      for (let i = 0; i < late; i++) step(d, run, NONE);
      const vyBefore = run.thief.vy;
      step(d, run, PRESS);
      return run.thief.vy > vyBefore;
    });
    expect(results).toEqual([true, true, false]);
  });

  it('Eingabepuffer: ein Tippen zählt 6 Ticks lang', () => {
    // Der volle Sprung landet in Tick 48, ab Tick 49 ist wieder ein Sprung möglich.
    const jumped = [43, 44, 49].map((tapTick) => {
      const d = flatRoom();
      const run = createRun(d);
      step(d, run, PRESS);
      while (run.tick < tapTick - 1) step(d, run, run.tick < 40 ? HOLD : NONE);
      step(d, run, TAP);
      while (run.tick < 60) step(d, run, NONE);
      return run.thief.jumpTick > 1;
    });
    expect(jumped).toEqual([false, true, true]);
  });

  it('ein Lauf endet nach 60 s', () => {
    const d = flatRoom();
    const run = createRun(d);
    while (run.status === 'running') step(d, run, NONE);
    expect(run.status).toBe('timeout');
    expect(run.tick).toBe(MAX_RUN_TICKS);
  });
});

describe('Fallen, Schlüssel und Truhe', () => {
  const runUntilEnd = (run: Run, d: ReturnType<typeof flatRoom>, max = 400) => {
    while (run.status === 'running' && run.tick < max) step(d, run, NONE);
  };

  it('Stacheln töten beim Hineinlaufen', () => {
    const d = flatRoom({ elements: [{ type: 'spikes', x: 8, y: 10, dir: 0 }] });
    const run = createRun(d);
    runUntilEnd(run, d);
    expect(run.status).toBe('dead');
    expect(run.killer).toBe(0);
    expect(run.tick).toBe(46);
  });

  it('Säge trifft über quadrierte Abstände', () => {
    const d = flatRoom({ elements: [{ type: 'saw', x: 8, y: 9 }] });
    const run = createRun(d);
    runUntilEnd(run, d);
    expect(run.status).toBe('dead');
    expect(run.tick).toBe(50);
  });

  it('Flammendüse tötet nur, wenn sie brennt', () => {
    const off = flatRoom({ elements: [{ type: 'flame', x: 8, y: 10, dir: 0, takt: 0, phase: 0 }] });
    const r1 = createRun(off);
    runUntilEnd(r1, off, 120);
    expect(r1.status).toBe('running');

    const on = flatRoom({ elements: [{ type: 'flame', x: 8, y: 10, dir: 0, takt: 0, phase: 4 }] });
    const r2 = createRun(on);
    runUntilEnd(r2, on, 120);
    expect(r2.status).toBe('dead');
    expect(r2.tick).toBe(48);
  });

  it('alle 3 Schlüssel öffnen die Truhe', () => {
    const d = flatRoom({
      start: { x: 1, y: 10, dir: 1 },
      keys: [
        { x: 6, y: 10 },
        { x: 11, y: 10 },
        { x: 16, y: 10 },
      ],
      chest: { x: 20, y: 10 },
    });
    const run = createRun(d);
    runUntilEnd(run, d);
    expect(run.keys).toBe(7);
    expect(run.status).toBe('won');
    expect(run.tick).toBe(196);
  });

  it('ohne alle Schlüssel bleibt die Truhe zu', () => {
    const d = flatRoom({
      start: { x: 1, y: 10, dir: 1 },
      keys: [
        { x: 6, y: 10 },
        { x: 11, y: 10 },
        { x: 16, y: 1 },
      ],
      chest: { x: 20, y: 10 },
    });
    const run = createRun(d);
    runUntilEnd(run, d, 600);
    // Schlüssel sind kanonisch nach (y, x) sortiert: (16, 1) ist Schlüssel 0 und fehlt.
    expect(run.keys).toBe(0b110);
    expect(run.status).toBe('running');
  });
});

function flatRoomRows(): string[] {
  return [...FLAT_ROWS];
}

function setChar(row: string, x: number, ch: string): string {
  return row.slice(0, x) + ch + row.slice(x + 1);
}

/** Dieb läuft auf einem Sims nach rechts und hat gerade die Kante verlassen. */
function ledgeRun() {
  const rows = flatRoomRows();
  rows[8] = '#########............#';
  const d = flatRoom({ rows, start: { x: 3, y: 7, dir: 1 } });
  const run = createRun(d);
  while (run.thief.ground) step(d, run, NONE);
  return { d, run };
}

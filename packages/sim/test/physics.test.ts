import { describe, expect, it } from 'vitest';
import { DEFAULT_PHYSICS, MAX_RUN_TICKS, createRun, step, type Physics, type Run, type TickInput } from '../src';
import { HOLD, NONE, PRESS, TAP, flatRoom, rowsWith } from './util';

const VARIABLE: Physics = { ...DEFAULT_PHYSICS, variableJump: 1 };

/** Läuft, bis der Dieb wieder am Boden steht; liefert höchsten Punkt und Flugdauer. */
function jumpProfile(first: TickInput, rest: TickInput, phys: Physics = DEFAULT_PHYSICS) {
  const d = flatRoom();
  const run = createRun(d, phys);
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

/** Säule bei x = 8 (Zeilen 2 bis 7): Der Dieb springt hinein und hängt an der Wand. */
function wallRun() {
  const d = flatRoom({ rows: rowsWith([2, 3, 4, 5, 6, 7].map((y) => [8, y, '#'] as [number, number, string])) });
  const run = createRun(d);
  while (run.thief.x + 152 < 8 * 256 - 60) step(d, run, NONE);
  step(d, run, PRESS);
  while (run.thief.wall === 0) step(d, run, HOLD);
  return { d, run };
}

describe('Sprungphysik (Blöcke aus 2 × 2 Feldern)', () => {
  it('eine feste Sprunghöhe: 630 SE (2,46 Felder), 3,84 Felder weit', () => {
    const p = jumpProfile(PRESS, HOLD);
    expect(p.rise).toBe(630);
    expect(p.landTick).toBe(42); // 41 Ticks in der Luft
    expect(p.airDist).toBe(41 * 24);
  });

  it('auch kurzes Tippen springt voll hoch', () => {
    expect(jumpProfile(TAP, NONE).rise).toBe(630);
    expect(jumpProfile(PRESS, NONE).rise).toBe(630);
  });

  it('ein Block (2 Felder) ist erreichbar, zwei Blöcke (4 Felder) nie', () => {
    expect(630).toBeGreaterThan(2 * 256);
    expect(630).toBeLessThan(4 * 256);
  });

  it('variable Sprunghöhe bleibt im Tuning wählbar: kurz 399 SE, gehalten 630 SE', () => {
    expect(jumpProfile(TAP, NONE, VARIABLE).rise).toBe(399);
    const heights: number[] = [];
    for (let hold = 1; hold <= 20; hold++) {
      const d = flatRoom();
      const run = createRun(d, VARIABLE);
      const y0 = run.thief.y;
      let minY = y0;
      for (let t = 1; t <= 60; t++) {
        step(d, run, t === 1 ? PRESS : t <= hold ? HOLD : NONE);
        minY = Math.min(minY, run.thief.y);
      }
      heights.push(y0 - minY);
    }
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
    expect(heights[0]).toBe(399);
    expect(heights[heights.length - 1]).toBe(630);
  });

  it('Walljump: 513 SE hoch (2,0 Felder) und Richtungswechsel', () => {
    const { d, run } = wallRun();
    expect(run.thief.wall).toBe(1);
    step(d, run, NONE);
    const yWall = run.thief.y;
    step(d, run, PRESS);
    expect(run.thief.dir).toBe(-1);
    expect(run.thief.vy).toBe(54);
    let minY = run.thief.y;
    for (let t = 0; t < 30; t++) {
      step(d, run, HOLD);
      minY = Math.min(minY, run.thief.y);
    }
    expect(yWall - minY).toBe(513);
  });

  it('am Boden bleibt der Dieb an der Wand stehen und steckt nie in ihr', () => {
    const d = flatRoom();
    const run = createRun(d);
    for (let t = 1; t <= 400; t++) {
      step(d, run, NONE);
      expect(run.thief.x + 152).toBeLessThanOrEqual(14 * 256);
    }
    expect(run.thief.x).toBe(14 * 256 - 152);
    expect(run.thief.dir).toBe(1);
    expect(run.thief.ground).toBe(true);
  });

  it('mit wallTurn = 1 dreht er um wie im ursprünglichen Spielkonzept', () => {
    const d = flatRoom();
    const run = createRun(d, { ...DEFAULT_PHYSICS, wallTurn: 1 });
    let turned = -1;
    for (let t = 1; t <= 400; t++) {
      step(d, run, NONE);
      expect(run.thief.x + 152).toBeLessThanOrEqual(14 * 256);
      expect(run.thief.x).toBeGreaterThanOrEqual(0);
      if (turned < 0 && run.thief.dir === -1) turned = run.tick;
    }
    expect(turned).toBe(120);
  });

  it('von der Wand weg geht es mit Sprung und Walljump', () => {
    const d = flatRoom();
    const run = createRun(d);
    while (run.thief.x + 152 < 14 * 256) step(d, run, NONE);
    step(d, run, PRESS);
    for (let i = 0; i < 8; i++) step(d, run, HOLD);
    expect(run.thief.wall).toBe(1);
    step(d, run, NONE);
    step(d, run, PRESS);
    expect(run.thief.dir).toBe(-1);
    for (let i = 0; i < 60; i++) step(d, run, NONE);
    expect(run.thief.x).toBeLessThan(11 * 256);
  });

  it('an der Wand rutscht er höchstens 12 SE/Tick', () => {
    const { d, run } = wallRun();
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
    // Der Sprung landet in Tick 42, ab Tick 43 ist wieder ein Sprung möglich.
    const jumped = [37, 38, 43].map((tapTick) => {
      const d = flatRoom();
      const run = createRun(d);
      step(d, run, PRESS);
      while (run.tick < tapTick - 1) step(d, run, NONE);
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
    const d = flatRoom({ elements: [{ type: 'spikes', x: 6, y: 7, dir: 0 }] });
    const run = createRun(d);
    runUntilEnd(run, d);
    expect(run.status).toBe('dead');
    expect(run.killer).toBe(0);
    expect(run.tick).toBe(35);
  });

  it('Säge trifft über quadrierte Abstände', () => {
    const d = flatRoom({ elements: [{ type: 'saw', x: 6, y: 6 }] });
    const run = createRun(d);
    runUntilEnd(run, d);
    expect(run.status).toBe('dead');
    expect(run.tick).toBe(39);
  });

  it('Flammendüse tötet nur, wenn sie brennt', () => {
    const off = flatRoom({ elements: [{ type: 'flame', x: 6, y: 7, dir: 0, takt: 0, phase: 0 }] });
    const r1 = createRun(off);
    runUntilEnd(r1, off, 120);
    expect(r1.status).toBe('running');

    const on = flatRoom({ elements: [{ type: 'flame', x: 6, y: 7, dir: 0, takt: 0, phase: 4 }] });
    const r2 = createRun(on);
    runUntilEnd(r2, on, 120);
    expect(r2.status).toBe('dead');
    expect(r2.tick).toBe(37);
  });

  it('alle 3 Schlüssel öffnen die Truhe', () => {
    const d = flatRoom({
      start: { x: 1, y: 7, dir: 1 },
      keys: [
        { x: 4, y: 7 },
        { x: 7, y: 7 },
        { x: 10, y: 7 },
      ],
      chest: { x: 13, y: 7 },
    });
    const run = createRun(d);
    runUntilEnd(run, d);
    expect(run.keys).toBe(7);
    expect(run.status).toBe('won');
    expect(run.tick).toBe(121);
  });

  it('ohne alle Schlüssel bleibt die Truhe zu', () => {
    const d = flatRoom({
      start: { x: 1, y: 7, dir: 1 },
      keys: [
        { x: 4, y: 7 },
        { x: 7, y: 7 },
        { x: 10, y: 1 },
      ],
      chest: { x: 13, y: 7 },
    });
    const run = createRun(d);
    runUntilEnd(run, d, 600);
    // Schlüssel sind kanonisch nach (y, x) sortiert: (10, 1) ist Schlüssel 0 und fehlt.
    expect(run.keys).toBe(0b110);
    expect(run.status).toBe('running');
  });
});

/** Dieb läuft auf einem Sims nach rechts und hat gerade die Kante verlassen. */
function ledgeRun() {
  const d = flatRoom({ rows: rowsWith([0, 1, 2, 3, 4, 5].map((x) => [x, 4, '#'] as [number, number, string])), start: { x: 2, y: 3, dir: 1 } });
  const run = createRun(d);
  while (run.thief.ground) step(d, run, NONE);
  return { d, run };
}

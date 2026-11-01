import { describe, expect, it } from 'vitest';
import {
  ET,
  FORTRESS_RULES,
  HASH_INTERVAL,
  PENDULUM_AMPLITUDE,
  cloneRun,
  countElements,
  createRun,
  crossbowBolt,
  crossbowRange,
  dynOffsets,
  fromJson,
  guardPos,
  guardRange,
  orbitCenter,
  pendulumAngle,
  shapesAt,
  stateHash,
  step,
  stomperDrop,
  stomperMaxDrop,
  validate,
  type Dungeon,
  type DungeonJson,
  type Element,
} from '../src';
import ALL_ELEMENTS from '../../../tests/fixtures/alle-elemente.json';
import { NONE, flatRoom, randomInputs, rowsWith } from './util';

function runFor(d: Dungeon, ticks: number) {
  const run = createRun(d);
  for (let i = 0; i < ticks && run.status === 'running'; i++) step(d, run, NONE);
  return run;
}

const el = (type: number, x: number, y: number, p: number[]) => ({ type, x, y, p }) as Element;

describe('Sprungfeder', () => {
  it('schleudert 1134 SE hoch (4,4 Felder, gut zwei Blöcke)', () => {
    const d = flatRoom({ elements: [{ type: 'spring', x: 8, y: 7 }] });
    const run = createRun(d);
    const y0 = run.thief.y;
    let minY = y0;
    for (let i = 0; i < 160; i++) {
      step(d, run, NONE);
      minY = Math.min(minY, run.thief.y);
    }
    expect(y0 - minY).toBe(1134);
  });
});

describe('Bröckelboden', () => {
  // Steg in Zeile 5, Feld 7 ist Bröckelboden, die Wand bei (8, 4) hält den Dieb darauf fest.
  const d = flatRoom({
    rows: rowsWith([...Array.from({ length: 14 }, (_, x) => [x, 5, x === 7 ? '.' : '#'] as [number, number, string]), [8, 4, '#']]),
    start: { x: 2, y: 4, dir: 1 },
    elements: [{ type: 'crumble', x: 7, y: 5 }],
  });

  it('trägt, bricht 0,4 s nach dem Betreten und kommt nach 3 s wieder', () => {
    const run = createRun(d);
    const off = dynOffsets(d)[0];
    let stepped = -1;
    let broken = -1;
    for (let i = 0; i < 400 && run.status === 'running'; i++) {
      step(d, run, NONE);
      if (stepped < 0 && run.dyn[off] === 1) stepped = run.tick;
      if (broken < 0 && run.dyn[off] === 2) broken = run.tick;
    }
    expect(stepped).toBeGreaterThan(0);
    expect(broken - stepped).toBe(24);
    // der Dieb ist durchgefallen und steht unten
    expect(run.thief.y).toBe(7 * 256 + 24);
    expect(run.dyn[off]).toBe(0);
  });
});

describe('Schalter + Tor', () => {
  // Das Tor steht bei x = 9 in den Zeilen 5 bis 7.
  const gate = (switchX: number) => flatRoom({ elements: [{ type: 'gate', x: switchX, y: 7, gx: 9 - switchX, gy: -2, dauer: 1 }] });

  it('geschlossen versperrt das Tor den Weg', () => {
    const run = runFor(gate(12), 300);
    expect(run.thief.x).toBe(9 * 256 - 152);
  });

  it('der Schalter öffnet es, danach schließt es wieder', () => {
    const d = gate(5);
    const run = createRun(d);
    const off = dynOffsets(d)[0];
    for (let i = 0; i < 300; i++) step(d, run, NONE);
    expect(run.thief.x).toBe(14 * 256 - 152);
    for (let i = 0; i < 300; i++) step(d, run, NONE);
    expect(run.dyn[off + 1]).toBe(0);
  });
});

describe('Kreisbahnsäge und Pendelklinge', () => {
  it('Kreisbahn im und gegen den Uhrzeigersinn', () => {
    const cw = el(ET.ORBITSAW, 10, 5, [2, 1, 0, 0]);
    const ccw = el(ET.ORBITSAW, 10, 5, [2, 1, 1, 0]);
    const cx = 10 * 256 + 128;
    const cy = 5 * 256 + 128;
    expect(orbitCenter(cw, 0)).toEqual({ x: cx + 512, y: cy });
    expect(orbitCenter(cw, 45)).toEqual({ x: cx, y: cy + 512 });
    expect(orbitCenter(ccw, 45)).toEqual({ x: cx, y: cy - 512 });
    expect(orbitCenter(cw, 180)).toEqual(orbitCenter(cw, 0));
  });

  it('Pendel schwingt ±60°', () => {
    const p = el(ET.PENDULUM, 10, 1, [3, 0, 0]);
    expect(pendulumAngle(p, 0)).toBe(0);
    expect(pendulumAngle(p, 45)).toBe(PENDULUM_AMPLITUDE);
    expect(pendulumAngle(p, 135)).toBe(-PENDULUM_AMPLITUDE);
  });
});

describe('Stampfer', () => {
  it('fällt höchstens 5 Felder oder bis zum Boden', () => {
    const d = flatRoom();
    const high = el(ET.STOMPER, 10, 1, [1, 0]);
    const low = el(ET.STOMPER, 10, 4, [1, 0]);
    expect(stomperMaxDrop(high, d)).toBe(5 * 256);
    expect(stomperMaxDrop(low, d)).toBe(3 * 256);
    expect(stomperDrop(high, d, 0)).toBe(0);
    expect(stomperDrop(high, d, 90)).toBe(1280);
    expect(stomperDrop(high, d, 179)).toBeLessThan(64);
  });

  it('zerquetscht den Dieb, der darunter an der Wand steht', () => {
    const d = flatRoom({ rows: rowsWith([[9, 7, '#']]), elements: [{ type: 'stomper', x: 8, y: 3, takt: 1 }] });
    const run = runFor(d, 400);
    expect(run.status).toBe('dead');
    expect(d.elements[run.killer].type).toBe(ET.STOMPER);
  });
});

describe('Armbrust', () => {
  it('Bolzen fliegen 48 SE pro Tick bis zur Wand, zwei Fächer im Wechsel', () => {
    const d = flatRoom();
    const c = el(ET.CROSSBOW, 0, 4, [1, 0, 0]);
    const range = crossbowRange(c, d);
    expect(range).toBe(14 * 256);
    expect(crossbowBolt(c, range, 0, 0)).toBe(120);
    expect(crossbowBolt(c, range, 0, 1)).toBe(-1);
    expect(crossbowBolt(c, range, 10, 0)).toBe(600);
    expect(crossbowBolt(c, range, 70, 1)).toBe(600);
    expect(crossbowBolt(c, range, 70, 0)).toBe(120 + 70 * 48);
    expect(crossbowBolt(c, range, 75, 0)).toBe(-1);
  });

  it('trifft den Dieb in der Schusslinie', () => {
    const d = flatRoom({ elements: [{ type: 'crossbow', x: 13, y: 7, dir: 3, intervall: 0 }] });
    const run = runFor(d, 300);
    expect(run.status).toBe('dead');
    expect(shapesAt(d, run).length).toBe(2);
  });
});

describe('Wächter', () => {
  it('läuft bis zur Kante und wendet dort', () => {
    const d = flatRoom({ rows: rowsWith([5, 6, 7, 8, 9].map((x) => [x, 5, '#'] as [number, number, string])) });
    const g = el(ET.GUARD, 7, 4, [1]);
    expect(guardRange(g, d)).toEqual({ x0: 5, x1: 9 });
    let minX = Infinity;
    let maxX = -Infinity;
    for (let t = 0; t < 400; t++) {
      const p = guardPos(g, d, t);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
    }
    expect(minX).toBe(5 * 256);
    expect(maxX).toBe(10 * 256 - 176);
  });

  it('tötet bei Berührung', () => {
    const d = flatRoom({ elements: [{ type: 'guard', x: 10, y: 7, tempo: 2 }] });
    const run = runFor(d, 300);
    expect(run.status).toBe('dead');
  });
});

describe('Späher', () => {
  it('schießt 0,4 s nach dem Betreten der Sichtlinie', () => {
    const d = flatRoom({ elements: [{ type: 'scout', x: 12, y: 7, blick: 0 }] });
    const run = createRun(d);
    const off = dynOffsets(d)[0];
    let aimed = -1;
    let fired = -1;
    for (let i = 0; i < 200 && run.status === 'running'; i++) {
      step(d, run, NONE);
      if (aimed < 0 && run.dyn[off] === 1) aimed = run.tick;
      if (fired < 0 && run.dyn[off + 2] >= 0) fired = run.tick;
    }
    expect(aimed).toBe(1);
    expect(fired - aimed).toBe(24);
    expect(run.status).toBe('dead');
  });
});

describe('Prallbrett', () => {
  it('drückt den Dieb von der Wand weg; ohne Brett bleibt er stehen', () => {
    const d = flatRoom({ elements: [{ type: 'bumper', x: 13, y: 7, seite: 1 }] });
    const run = runFor(d, 500);
    expect(run.thief.dir).toBe(-1);
    expect(run.thief.x).toBe(0);
  });
});

describe('Alle Elemente zusammen', () => {
  // Ein Raum mit allen 14 Elementtypen, auch Grundlage der Golden Replays „alle-*“.
  const d = fromJson(ALL_ELEMENTS as DungeonJson);

  it('sind 10 Fallen und 4 Hilfsmittel und erfüllen sonst alle Bauregeln', () => {
    expect(countElements(d)).toEqual({ traps: 10, helpers: 4 });
    expect(validate(d, { ...FORTRESS_RULES, traps: 10, maxHelpers: 4 })).toEqual([]);
  });

  it('rechnen bitgleich, auch nach einer Kopie des Laufs', () => {
    for (const seed of [3, 9, 27]) {
      const inputs = randomInputs(seed, 3600);
      const a = createRun(d);
      const b = createRun(d);
      const ha: number[] = [];
      const hb: number[] = [];
      let c = b;
      inputs.forEach((input, i) => {
        step(d, a, input);
        if (i === 600) c = cloneRun(b);
        step(d, c, input);
        if (a.tick % HASH_INTERVAL === 0) {
          ha.push(stateHash(a));
          hb.push(stateHash(c));
        }
      });
      expect(hb).toEqual(ha);
    }
  });
});

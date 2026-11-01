import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DUEL_RULES, decode, dungeonHash, encode, fromJson, sha256, toHex, toJson, validate, type BuildRules, type DungeonJson } from '../src';
import { flatRoom, rowsWith } from './util';

const utf8 = (s: string) => new TextEncoder().encode(s);

describe('SHA-256', () => {
  it('bekannte Testvektoren', () => {
    expect(toHex(sha256(new Uint8Array()))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(toHex(sha256(utf8('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('stimmt mit node:crypto überein, auch über Blockgrenzen', () => {
    for (const len of [1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
      const data = new Uint8Array(len).map((_, i) => (i * 31 + len) & 255);
      expect(toHex(sha256(data))).toBe(createHash('sha256').update(data).digest('hex'));
    }
  });
});

describe('Dungeon-Kodierung', () => {
  const d = flatRoom({
    name: 'Kodiertest ÄÖÜ ✓',
    elements: [
      { type: 'saw', x: 10, y: 5 },
      { type: 'spikes', x: 9, y: 7, dir: 0 },
      { type: 'railsaw', x: 12, y: 3, dx: -4, tempo: 2, phase: 5 },
      { type: 'flame', x: 11, y: 0, dir: 2, takt: 1, phase: 3 },
    ],
  });

  it('Elemente sind kanonisch nach Typ, y, x sortiert', () => {
    expect(d.elements.map((e) => e.type)).toEqual([0, 2, 4, 6]);
  });

  it('encode und decode sind verlustfrei', () => {
    const back = decode(encode(d));
    expect(back).toEqual(d);
    expect(toJson(back)).toEqual(toJson(d));
  });

  it('Hash hängt nicht von Reihenfolge oder Namen ab, wohl aber vom Inhalt', () => {
    const shuffled = { ...d, name: 'anders', elements: [...d.elements].reverse(), keys: [d.keys[2], d.keys[0], d.keys[1]] as typeof d.keys };
    expect(dungeonHash(shuffled)).toBe(dungeonHash(d));
    const moved = { ...d, chest: { x: d.chest.x - 1, y: d.chest.y } };
    expect(dungeonHash(moved)).not.toBe(dungeonHash(d));
  });

  it('ein Dungeon mit 30 Elementen bleibt klein', () => {
    const elements = Array.from({ length: 30 }, (_, i) => ({ type: 'saw', x: i % 14, y: (i * 3) % 8 }));
    const big = flatRoom({ elements });
    expect(encode(big).length).toBeLessThan(200);
  });

  it('das alte Format mit 22 × 12 Feldern wird mit klarer Meldung abgelehnt', () => {
    const old = encode(flatRoom());
    old[0] = 1;
    expect(() => decode(old)).toThrow(/Altes Dungeon-Format/);
  });
});

describe('Bauregeln', () => {
  // Vier Fallen, die keine andere Regel verletzen.
  const FOUR: NonNullable<DungeonJson['elements']> = [
    { type: 'spikes', x: 6, y: 7, dir: 0 },
    { type: 'spikes', x: 10, y: 7, dir: 0 },
    { type: 'saw', x: 7, y: 3 },
    { type: 'saw', x: 11, y: 4 },
  ];
  const codes = (j: Parameters<typeof flatRoom>[0], rules?: BuildRules) => validate(flatRoom(j), rules).map((p) => p.code);

  it('eine Base mit genau 4 Fallen ist gültig', () => {
    expect(validate(flatRoom({ elements: FOUR }))).toEqual([]);
  });

  it('genau 4 Fallen: weniger oder mehr sind ein Fehler', () => {
    const fewer = validate(flatRoom({ elements: FOUR.slice(0, 3) }));
    expect(fewer.map((p) => p.code)).toEqual(['traps']);
    expect(fewer[0].msg).toBe('Es fehlt noch 1 Falle (genau 4)');
    expect(validate(flatRoom()).map((p) => p.msg)).toEqual(['Es fehlen noch 4 Fallen (genau 4)']);
    const more = validate(flatRoom({ elements: [...FOUR, { type: 'saw', x: 4, y: 2 }] }));
    expect(more.map((p) => p.msg)).toEqual(['5 Fallen sind zu viele, genau 4 sind erlaubt']);
  });

  it('Hilfsmittel zählen nicht als Fallen, höchstens 2 sind erlaubt', () => {
    const springs = [
      { type: 'spring', x: 8, y: 7 },
      { type: 'spring', x: 12, y: 7 },
    ];
    expect(codes({ elements: [...FOUR, ...springs] })).toEqual([]);
    expect(codes({ elements: [...FOUR, ...springs, { type: 'bumper', x: 13, y: 4, seite: 1 }] })).toEqual(['helpers']);
  });

  it('im Duell gelten 2 Fallen und 1 Hilfsmittel', () => {
    expect(codes({ elements: FOUR.slice(0, 2) }, DUEL_RULES)).toEqual([]);
    expect(codes({ elements: FOUR }, DUEL_RULES)).toEqual(['traps']);
    expect(codes({ elements: [...FOUR.slice(0, 2), { type: 'spring', x: 8, y: 7 }, { type: 'spring', x: 12, y: 7 }] }, DUEL_RULES)).toEqual(['helpers']);
  });

  it('Startschutz, Abstände, Wände und Befestigung', () => {
    // Fallenzahl außen vor, hier geht es um die übrigen Regeln.
    const other = (j: Parameters<typeof flatRoom>[0]) => codes(j).filter((c) => c !== 'traps');
    expect(other({ elements: [{ type: 'saw', x: 4, y: 7 }] })).toContain('startzone');
    expect(other({ elements: [{ type: 'saw', x: 5, y: 6 }] })).toEqual([]);
    expect(other({ elements: [{ type: 'railsaw', x: 9, y: 6, dx: -6 }] })).toContain('startzone');
    expect(other({ chest: { x: 4, y: 7 } })).toContain('spacing');
    expect(other({ chest: { x: 5, y: 7 } })).toEqual([]);
    expect(other({ rows: rowsWith([[6, 4, '#']]), elements: [{ type: 'saw', x: 6, y: 4 }] })).toContain('wall');
    expect(other({ elements: [{ type: 'saw', x: 14, y: 4 }] })).toContain('bounds');
    expect(other({ elements: [{ type: 'spikes', x: 12, y: 5, dir: 0 }] })).toContain('place');
    expect(other({ elements: [{ type: 'spring', x: 12, y: 7 }] })).toEqual([]);
    expect(other({ elements: [{ type: 'spring', x: 12, y: 5 }] })).toContain('place');
    expect(other({ elements: [{ type: 'railsaw', x: 12, y: 3, dx: 2, dy: 2 }] })).toContain('place');
    expect(other({ elements: [{ type: 'bumper', x: 12, y: 4, seite: 1 }] })).toContain('place');
  });

  it('JSON mit Buchstaben für Start, Schlüssel und Truhe', () => {
    const d = fromJson({
      name: 'Buchstaben',
      startDir: -1,
      rows: [
        '..............',
        '.K....K....K..',
        '##..........##',
        '##..........##',
        '..............',
        '..............',
        '..............',
        '..S.......T...',
      ],
    });
    expect(d.start).toEqual({ x: 2, y: 7, dir: -1 });
    expect(d.chest).toEqual({ x: 10, y: 7 });
    expect(d.keys).toEqual([
      { x: 1, y: 1 },
      { x: 6, y: 1 },
      { x: 11, y: 1 },
    ]);
  });

  it('falsche Rastergröße wird abgelehnt', () => {
    expect(() => fromJson({ name: 'Alt', rows: ['#'.repeat(22)], start: { x: 1, y: 1 } })).toThrow(/8 Zeilen/);
    expect(() => fromJson({ name: 'Alt', rows: Array.from({ length: 8 }, () => '.'.repeat(22)) })).toThrow(/14 Zeichen/);
  });
});

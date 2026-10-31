import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DUEL_RULES, decode, dungeonHash, encode, fromJson, sha256, toHex, toJson, validate } from '../src';
import { flatRoom } from './util';

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
      { type: 'saw', x: 10, y: 6 },
      { type: 'spikes', x: 9, y: 10, dir: 0 },
      { type: 'railsaw', x: 12, y: 4, dx: -4, tempo: 2, phase: 5 },
      { type: 'flame', x: 15, y: 1, dir: 2, takt: 1, phase: 3 },
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
    const elements = Array.from({ length: 30 }, (_, i) => ({ type: 'saw', x: 1 + (i % 20), y: 2 + (i % 5) }));
    const big = flatRoom({ elements });
    expect(encode(big).length).toBeLessThan(200);
  });
});

describe('Bauregeln', () => {
  it('ein ordentlicher Dungeon ist gültig', () => {
    expect(validate(flatRoom({ elements: [{ type: 'spikes', x: 12, y: 10, dir: 0 }] }))).toEqual([]);
  });

  it('Startschutz, Abstände, Wände und Befestigung', () => {
    const codes = (j: Parameters<typeof flatRoom>[0]) => validate(flatRoom(j)).map((p) => p.code);
    expect(codes({ elements: [{ type: 'saw', x: 5, y: 9 }] })).toContain('startzone');
    expect(codes({ elements: [{ type: 'railsaw', x: 10, y: 9, dx: -6 }] })).toContain('startzone');
    expect(codes({ chest: { x: 5, y: 10 } })).toContain('spacing');
    expect(codes({ elements: [{ type: 'saw', x: 0, y: 5 }] })).toContain('wall');
    expect(codes({ elements: [{ type: 'spikes', x: 12, y: 5, dir: 0 }] })).toContain('place');
    expect(codes({ elements: [{ type: 'spring', x: 12, y: 10 }] })).toContain('unavailable');
    expect(codes({ elements: [{ type: 'railsaw', x: 12, y: 5, dx: 2, dy: 2 }] })).toContain('place');
  });

  it('Budget und Höchstzahl pro Typ', () => {
    const saws = Array.from({ length: 7 }, (_, i) => ({ type: 'saw', x: 8 + i * 2, y: 5 }));
    const problems = validate(flatRoom({ elements: saws }), DUEL_RULES).map((p) => p.code);
    expect(problems).toContain('maxType');
    expect(problems).not.toContain('budget');
    const flames = Array.from({ length: 6 }, (_, i) => ({ type: 'flame', x: 8 + i * 2, y: 10, dir: 0 }));
    expect(validate(flatRoom({ elements: [...flames, ...saws.slice(0, 2)] }), DUEL_RULES).map((p) => p.code)).toContain('budget');
  });

  it('JSON mit Buchstaben für Start, Schlüssel und Truhe', () => {
    const d = fromJson({
      name: 'Buchstaben',
      startDir: -1,
      rows: [
        '######################',
        '#....................#',
        '#.K.......K.......K..#',
        '#....................#',
        '#....................#',
        '#....................#',
        '#....................#',
        '#....................#',
        '#....................#',
        '#....................#',
        '#..S..........T......#',
        '######################',
      ],
    });
    expect(d.start).toEqual({ x: 3, y: 10, dir: -1 });
    expect(d.chest).toEqual({ x: 14, y: 10 });
    expect(d.keys).toEqual([
      { x: 2, y: 2 },
      { x: 10, y: 2 },
      { x: 18, y: 2 },
    ]);
  });
});

import { readFileSync, readdirSync } from 'node:fs';
import { BLOCK, FORTRESS_RULES, GRID_H, GRID_W, fromJson, solid, validate, type Dungeon, type DungeonJson } from '@diebesgut/sim';
import { describe, expect, it } from 'vitest';

// Mitgelieferte Räume müssen so gebaut sein, wie es der Editor erlaubt: Gelände nur aus ganzen
// 2 × 2-Blöcken und alle Bauregeln erfüllt (genau 4 Fallen, höchstens 2 Hilfsmittel).

const read = (url: URL) => JSON.parse(readFileSync(url, 'utf8')) as DungeonJson;
const roomsDir = new URL('../packages/content/rooms/', import.meta.url);
const rooms = readdirSync(roomsDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => ({ file: f, d: fromJson(read(new URL(f, roomsDir))) }));
const allElements = fromJson(read(new URL('./fixtures/alle-elemente.json', import.meta.url)));

/** Kacheln, die nicht zu einem ganzen Block gehören (leer = nur ganze Blöcke). */
function brokenBlocks(d: Dungeon): string[] {
  const out: string[] = [];
  for (let y = 0; y < GRID_H; y += BLOCK) {
    for (let x = 0; x < GRID_W; x += BLOCK) {
      const s = solid(d, x, y);
      for (let dy = 0; dy < BLOCK; dy++) for (let dx = 0; dx < BLOCK; dx++) if (solid(d, x + dx, y + dy) !== s) out.push(`(${x + dx}, ${y + dy})`);
    }
  }
  return out;
}

describe('Mitgelieferte Räume', () => {
  it('sind die drei Testräume', () => {
    expect(rooms.map((r) => r.file)).toEqual(['raum1.json', 'raum2.json', 'raum3.json']);
  });

  for (const { file, d } of rooms) {
    it(`${file}: nur ganze 2 × 2-Blöcke und alle Bauregeln`, () => {
      expect(brokenBlocks(d)).toEqual([]);
      expect(validate(d, FORTRESS_RULES)).toEqual([]);
    });
  }

  it('der Raum mit allen Elementen besteht ebenfalls aus ganzen Blöcken', () => {
    expect(brokenBlocks(allElements)).toEqual([]);
  });
});

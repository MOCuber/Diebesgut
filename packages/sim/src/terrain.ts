import { GRID_H, GRID_W } from './constants';
import type { Dungeon } from './dungeon';

/** 22 × 12 Bits = 33 Byte, zeilenweise von oben links, niedrigstes Bit zuerst. */
export const TERRAIN_BYTES = 33;

export function inGrid(tx: number, ty: number): boolean {
  return tx >= 0 && tx < GRID_W && ty >= 0 && ty < GRID_H;
}

/** Ist die Kachel fest? Außerhalb des Rasters ist alles fest. */
export function solid(d: Dungeon, tx: number, ty: number): boolean {
  if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) return true;
  const i = ty * GRID_W + tx;
  return ((d.terrain[i >> 3] >> (i & 7)) & 1) === 1;
}

export function setSolid(terrain: Uint8Array, tx: number, ty: number, on: boolean): void {
  if (!inGrid(tx, ty)) return;
  const i = ty * GRID_W + tx;
  if (on) terrain[i >> 3] |= 1 << (i & 7);
  else terrain[i >> 3] &= ~(1 << (i & 7));
}

/** Ist in Spalte col zwischen den Zeilen row0 und row1 (einschließlich) eine Kachel fest? */
export function colSolid(d: Dungeon, col: number, row0: number, row1: number): boolean {
  for (let r = row0; r <= row1; r++) if (solid(d, col, r)) return true;
  return false;
}

/** Ist in Zeile row zwischen den Spalten col0 und col1 (einschließlich) eine Kachel fest? */
export function rowSolid(d: Dungeon, row: number, col0: number, col1: number): boolean {
  for (let c = col0; c <= col1; c++) if (solid(d, c, row)) return true;
  return false;
}

import { GRID_H, GRID_W } from './constants';
import type { Dungeon } from './dungeon';

/** 14 × 8 Bits = 14 Byte, zeilenweise von oben links, niedrigstes Bit zuerst. */
export const TERRAIN_BYTES = (GRID_W * GRID_H + 7) >> 3;

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

/**
 * Fest durch Gelände oder durch ein Element, das gerade eine Kachel belegt (intakter Bröckelboden,
 * geschlossenes Tor). block hat eine Zelle pro Kachel, zeilenweise.
 */
export function blocked(d: Dungeon, block: Uint8Array, tx: number, ty: number): boolean {
  if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) return true;
  const i = ty * GRID_W + tx;
  return ((d.terrain[i >> 3] >> (i & 7)) & 1) === 1 || block[i] === 1;
}

export function colBlocked(d: Dungeon, block: Uint8Array, col: number, row0: number, row1: number): boolean {
  for (let r = row0; r <= row1; r++) if (blocked(d, block, col, r)) return true;
  return false;
}

export function rowBlocked(d: Dungeon, block: Uint8Array, row: number, col0: number, col1: number): boolean {
  for (let c = col0; c <= col1; c++) if (blocked(d, block, c, row)) return true;
  return false;
}

/** Freie Kacheln ab (tx, ty) in Richtung (dx, dy), höchstens max, nur festes Gelände zählt. */
export function freeRun(d: Dungeon, tx: number, ty: number, dx: number, dy: number, max: number): number {
  let n = 0;
  while (n < max && !solid(d, tx + dx * n, ty + dy * n)) n++;
  return n;
}

import {
  BLOCK,
  DIR_DX,
  DIR_DY,
  ELEMENT_INFO,
  ET,
  GRID_W,
  TERRAIN_BYTES,
  compareElements,
  inGrid,
  setSolid,
  solid,
  type Dungeon,
  type ElementType,
  type Tile,
} from '@diebesgut/sim';

// Zustand des Festungs-Editors. Jede Änderung erzeugt einen neuen Zustand (unveränderlich),
// deshalb ist Rückgängig/Wiederholen einfach ein Stapel alter Zustände.

export interface EdElement {
  /** stabile Kennung im Editor; die Element-ID im Sim-Kern ändert sich beim Sortieren */
  uid: number;
  type: ElementType;
  x: number;
  y: number;
  p: number[];
}

export interface EdState {
  name: string;
  terrain: Uint8Array;
  start: { x: number; y: number; dir: 1 | -1 };
  chest: Tile;
  keys: [Tile, Tile, Tile];
  elements: EdElement[];
}

/** Pflichtobjekte: Start, Truhe und die drei Schlüssel. */
export type ObjectRef = 'start' | 'chest' | 'key0' | 'key1' | 'key2';

let nextUid = 1;

export function fromDungeon(d: Dungeon): EdState {
  return {
    name: d.name,
    terrain: d.terrain.slice(),
    start: { ...d.start },
    chest: { ...d.chest },
    keys: [{ ...d.keys[0] }, { ...d.keys[1] }, { ...d.keys[2] }],
    elements: d.elements.map((e) => ({ uid: nextUid++, type: e.type, x: e.x, y: e.y, p: e.p.slice() })),
  };
}

/** Dungeon in kanonischer Reihenfolge; ids[Element-ID] ist die uid im Editor. */
export function toDungeon(s: EdState): { d: Dungeon; ids: number[] } {
  const sorted = [...s.elements].sort(compareElements);
  const keys = [...s.keys].map((k) => ({ ...k })).sort((a, b) => a.y - b.y || a.x - b.x) as [Tile, Tile, Tile];
  return {
    d: {
      format: 2,
      name: s.name,
      terrain: s.terrain,
      start: { ...s.start },
      chest: { ...s.chest },
      keys,
      elements: sorted.map((e) => ({ type: e.type, x: e.x, y: e.y, p: e.p.slice() })),
    },
    ids: sorted.map((e) => e.uid),
  };
}

/** Leere Festung: Rundherum ist ohnehin Mauer; Start unten links, Schlüssel und Truhe am Boden. */
export function emptyState(name: string): EdState {
  return {
    name,
    terrain: new Uint8Array(TERRAIN_BYTES),
    start: { x: 1, y: 7, dir: 1 },
    chest: { x: 13, y: 7 },
    keys: [
      { x: 4, y: 7 },
      { x: 7, y: 7 },
      { x: 10, y: 7 },
    ],
    elements: [],
  };
}

// ------------------------------------------------------------------ Abfragen

const view = (s: EdState): Dungeon => ({ terrain: s.terrain }) as Dungeon;

export function isSolid(s: EdState, x: number, y: number): boolean {
  return solid(view(s), x, y);
}

export function objectAt(s: EdState, x: number, y: number): ObjectRef | null {
  if (s.start.x === x && s.start.y === y) return 'start';
  if (s.chest.x === x && s.chest.y === y) return 'chest';
  for (let i = 0; i < 3; i++) if (s.keys[i].x === x && s.keys[i].y === y) return `key${i}` as ObjectRef;
  return null;
}

/** Oberstes Element auf der Kachel (zuletzt gesetzt zuerst). */
export function elementAt(s: EdState, x: number, y: number): EdElement | null {
  for (let i = s.elements.length - 1; i >= 0; i--) {
    const e = s.elements[i];
    if (e.x === x && e.y === y) return e;
  }
  return null;
}

export function objectTile(s: EdState, ref: ObjectRef): Tile {
  if (ref === 'start') return s.start;
  if (ref === 'chest') return s.chest;
  return s.keys[Number(ref[3])];
}

export function findElement(s: EdState, uid: number): EdElement | undefined {
  return s.elements.find((e) => e.uid === uid);
}

/** Linke obere Kachel des 2 × 2-Blocks, in dem eine Kachel liegt. */
export function blockOf(t: Tile): Tile {
  return { x: t.x - (t.x % BLOCK), y: t.y - (t.y % BLOCK) };
}

/** Alle Kacheln der Blöcke, die die Kacheln berühren, jede nur einmal. */
export function blockTiles(tiles: readonly Tile[]): Tile[] {
  const seen = new Set<number>();
  const out: Tile[] = [];
  for (const t of tiles) {
    const b = blockOf(t);
    if (seen.has(b.y * GRID_W + b.x)) continue;
    seen.add(b.y * GRID_W + b.x);
    for (let dy = 0; dy < BLOCK; dy++) for (let dx = 0; dx < BLOCK; dx++) out.push({ x: b.x + dx, y: b.y + dy });
  }
  return out;
}

// ------------------------------------------------------------------ Befehle

/**
 * Gelände setzen, immer in ganzen 2 × 2-Blöcken: Jede berührte Kachel setzt ihren ganzen Block.
 * Liefert denselben Zustand, wenn sich nichts ändert.
 */
export function paint(s: EdState, tiles: readonly Tile[], on: boolean): EdState {
  let terrain: Uint8Array | null = null;
  for (const t of blockTiles(tiles)) {
    if (!inGrid(t.x, t.y) || isSolid(s, t.x, t.y) === on) continue;
    terrain ??= s.terrain.slice();
    setSolid(terrain, t.x, t.y, on);
  }
  return terrain ? { ...s, terrain } : s;
}

export function rectTiles(a: Tile, b: Tile): Tile[] {
  const out: Tile[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push({ x, y });
  return out;
}

/** Kacheln auf der Linie zwischen zwei Kacheln, damit schnelles Ziehen keine Lücken lässt. */
export function lineTiles(a: Tile, b: Tile): Tile[] {
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  const out: Tile[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    out.push({ x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) });
  }
  return out;
}

/** Richtung, in die ein angebautes Element zeigt: weg von der nächsten festen Nachbarkachel. */
function attachDir(s: EdState, x: number, y: number, prefer: readonly number[]): number {
  for (const dir of prefer) if (isSolid(s, x - DIR_DX[dir], y - DIR_DY[dir])) return dir;
  return prefer[0];
}

/** Startwerte für ein neues Element, an Wände und Böden angepasst. */
export function defaultParams(s: EdState, type: ElementType, x: number, y: number): number[] {
  const p = ELEMENT_INFO[type].params.map((spec) => spec.def);
  switch (type) {
    case ET.SPIKES:
    case ET.FLAME:
      p[0] = attachDir(s, x, y, [0, 2, 1, 3]);
      break;
    case ET.CROSSBOW:
      p[0] = attachDir(s, x, y, [1, 3, 0, 2]);
      break;
    case ET.BUMPER:
      p[0] = isSolid(s, x - 1, y) && !isSolid(s, x + 1, y) ? 0 : 1;
      break;
    case ET.SCOUT:
      p[0] = x >= GRID_W / 2 ? 0 : 1;
      break;
    case ET.GATE:
      p[0] = x + 3 < GRID_W ? 3 : -3;
      break;
  }
  return p;
}

export function placeElement(s: EdState, type: ElementType, x: number, y: number): { state: EdState; uid: number } {
  const el: EdElement = { uid: nextUid++, type, x, y, p: defaultParams(s, type, x, y) };
  return { state: { ...s, elements: [...s.elements, el] }, uid: el.uid };
}

export function updateElement(s: EdState, uid: number, change: Partial<Omit<EdElement, 'uid'>>): EdState {
  return { ...s, elements: s.elements.map((e) => (e.uid === uid ? { ...e, ...change, p: change.p ?? e.p } : e)) };
}

export function setParam(s: EdState, uid: number, index: number, value: number): EdState {
  const e = findElement(s, uid);
  if (!e) return s;
  const p = e.p.slice();
  p[index] = value;
  return updateElement(s, uid, { p });
}

export function deleteElement(s: EdState, uid: number): EdState {
  return { ...s, elements: s.elements.filter((e) => e.uid !== uid) };
}

/** Kopie auf der nächsten freien Kachel daneben. */
export function duplicateElement(s: EdState, uid: number): { state: EdState; uid: number } | null {
  const e = findElement(s, uid);
  if (!e) return null;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, -1],
    [0, 1],
    [2, 0],
    [-2, 0],
  ]) {
    const x = e.x + dx;
    const y = e.y + dy;
    if (inGrid(x, y) && !isSolid(s, x, y) && !elementAt(s, x, y) && !objectAt(s, x, y)) {
      const copy: EdElement = { uid: nextUid++, type: e.type, x, y, p: e.p.slice() };
      return { state: { ...s, elements: [...s.elements, copy] }, uid: copy.uid };
    }
  }
  return null;
}

export function moveObject(s: EdState, ref: ObjectRef, x: number, y: number): EdState {
  if (ref === 'start') return { ...s, start: { ...s.start, x, y } };
  if (ref === 'chest') return { ...s, chest: { x, y } };
  const keys = [...s.keys] as [Tile, Tile, Tile];
  keys[Number(ref[3])] = { x, y };
  return { ...s, keys };
}

export function setStartDir(s: EdState, dir: 1 | -1): EdState {
  return { ...s, start: { ...s.start, dir } };
}

export function rename(s: EdState, name: string): EdState {
  return { ...s, name };
}

/** Gleicher Inhalt? (für „geändert“ und das Zusammenfassen von Befehlen) */
export function sameState(a: EdState, b: EdState): boolean {
  if (a === b) return true;
  const { d: da } = toDungeon(a);
  const { d: db } = toDungeon(b);
  return JSON.stringify({ ...da, terrain: [...da.terrain] }) === JSON.stringify({ ...db, terrain: [...db.terrain] });
}

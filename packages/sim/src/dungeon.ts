import { ByteReader, ByteWriter, utf8Decode, utf8Encode } from './bytes';
import { FORTRESS_RULES, GRID_H, GRID_W, type BuildRules } from './constants';
import { BEHAVIORS } from './elements';
import { ELEMENT_INFO, elementByKey, type ElementType } from './elements/info';
import { sha256, toHex } from './sha256';
import { TERRAIN_BYTES, inGrid, setSolid, solid } from './terrain';

export interface Tile {
  x: number;
  y: number;
}

/** Element mit gestuften Parametern p (Reihenfolge laut ELEMENT_INFO). */
export interface Element {
  type: ElementType;
  x: number;
  y: number;
  p: number[];
}

export interface Dungeon {
  format: 1;
  name: string;
  /** 22 × 12 Bits = 33 Byte */
  terrain: Uint8Array;
  start: { x: number; y: number; dir: 1 | -1 };
  chest: Tile;
  keys: [Tile, Tile, Tile];
  /** kanonisch sortiert: Typ, y, x; die ID eines Elements ist seine Position in dieser Liste */
  elements: Element[];
}

export const DUNGEON_FORMAT = 1;
export const MAX_NAME_LENGTH = 40;

// ---------------------------------------------------------------- kanonische Form

/** Kanonische Reihenfolge der Elemente: Typ, y, x, dann Parameter. */
export function compareElements(a: Element, b: Element): number {
  if (a.type !== b.type) return a.type - b.type;
  if (a.y !== b.y) return a.y - b.y;
  if (a.x !== b.x) return a.x - b.x;
  const n = Math.min(a.p.length, b.p.length);
  for (let i = 0; i < n; i++) if (a.p[i] !== b.p[i]) return a.p[i] - b.p[i];
  return a.p.length - b.p.length;
}

/** Kopie mit sortierten Schlüsseln (y, x) und Elementen (Typ, y, x, Parameter). */
export function canonicalize(d: Dungeon): Dungeon {
  const keys = d.keys
    .map((k) => ({ x: k.x, y: k.y }))
    .sort((a, b) => a.y - b.y || a.x - b.x) as [Tile, Tile, Tile];
  const elements = d.elements.map((e) => ({ type: e.type, x: e.x, y: e.y, p: e.p.slice() })).sort(compareElements);
  return {
    format: 1,
    name: d.name,
    terrain: d.terrain.slice(),
    start: { x: d.start.x, y: d.start.y, dir: d.start.dir },
    chest: { x: d.chest.x, y: d.chest.y },
    keys,
    elements,
  };
}

// ---------------------------------------------------------------- Kodierung

/**
 * Kanonische Binärkodierung, Basis für Hash und Teilen. Der Name hängt optional am Ende und
 * zählt nicht zum Hash: Umbenennen ändert weder Identität noch Rekorde eines Dungeons.
 */
export function encode(d: Dungeon, withName = true): Uint8Array {
  const c = canonicalize(d);
  const w = new ByteWriter();
  w.u8(DUNGEON_FORMAT);
  w.bytes(c.terrain);
  w.u8(c.start.x);
  w.u8(c.start.y);
  w.u8(c.start.dir === 1 ? 0 : 1);
  w.u8(c.chest.x);
  w.u8(c.chest.y);
  for (const k of c.keys) {
    w.u8(k.x);
    w.u8(k.y);
  }
  w.u8(c.elements.length);
  for (const el of c.elements) {
    w.u8(el.type);
    w.u8(el.x);
    w.u8(el.y);
    w.u8(el.p.length);
    for (const v of el.p) w.i8(v);
  }
  if (withName) {
    const name = utf8Encode(Array.from(c.name).slice(0, MAX_NAME_LENGTH).join(''));
    w.u8(name.length);
    w.bytes(name);
  }
  return w.finish();
}

export function decode(bytes: Uint8Array): Dungeon {
  const r = new ByteReader(bytes);
  const format = r.u8();
  if (format !== DUNGEON_FORMAT) throw new Error(`Unbekanntes Dungeon-Format ${format}`);
  const terrain = r.bytes(TERRAIN_BYTES);
  const start = { x: r.u8(), y: r.u8(), dir: (r.u8() === 0 ? 1 : -1) as 1 | -1 };
  const chest = { x: r.u8(), y: r.u8() };
  const keys: [Tile, Tile, Tile] = [
    { x: r.u8(), y: r.u8() },
    { x: r.u8(), y: r.u8() },
    { x: r.u8(), y: r.u8() },
  ];
  const n = r.u8();
  const elements: Element[] = [];
  for (let i = 0; i < n; i++) {
    const type = r.u8() as ElementType;
    const x = r.u8();
    const y = r.u8();
    const pc = r.u8();
    const p: number[] = [];
    for (let k = 0; k < pc; k++) p.push(r.i8());
    elements.push({ type, x, y, p });
  }
  const name = r.done ? '' : utf8Decode(r.bytes(r.u8()));
  return canonicalize({ format: 1, name, terrain, start, chest, keys, elements });
}

/** SHA-256 der kanonischen Kodierung ohne Namen, als Hex-Text. */
export function dungeonHash(d: Dungeon): string {
  return toHex(sha256(encode(d, false)));
}

// ---------------------------------------------------------------- Prüfung

export interface Problem {
  code: 'format' | 'bounds' | 'wall' | 'spacing' | 'startzone' | 'budget' | 'maxType' | 'maxTotal' | 'param' | 'place' | 'unavailable' | 'name';
  msg: string;
  x: number;
  y: number;
  /** Element-ID oder -1 */
  el: number;
}

/** Alle Kacheln, die ein Element jemals gefährdet. */
export function footprint(el: Element, d: Dungeon): Tile[] {
  const out: Tile[] = [];
  const b = BEHAVIORS[el.type];
  if (b) b.footprint(el, d, out);
  else out.push({ x: el.x, y: el.y });
  return out;
}

export function elementCost(d: Dungeon): number {
  let sum = 0;
  for (const el of d.elements) sum += ELEMENT_INFO[el.type]?.cost ?? 0;
  return sum;
}

/** Prüft alle Bauregeln aus dem Spielkonzept. Leere Liste = gültig. */
export function validate(d: Dungeon, rules: BuildRules = FORTRESS_RULES): Problem[] {
  const out: Problem[] = [];
  const add = (code: Problem['code'], msg: string, x: number, y: number, el = -1) => out.push({ code, msg, x, y, el });

  if (d.terrain.length !== TERRAIN_BYTES) add('format', 'Das Gelände hat nicht 22 × 12 Kacheln', 0, 0);
  if (d.keys.length !== 3) add('format', 'Ein Dungeon hat genau 3 Schlüssel', 0, 0);
  if (Array.from(d.name).length > MAX_NAME_LENGTH) add('name', `Der Name ist länger als ${MAX_NAME_LENGTH} Zeichen`, 0, 0);

  // Pflichtobjekte
  const objects = [
    { name: 'Start', x: d.start.x, y: d.start.y },
    { name: 'Truhe', x: d.chest.x, y: d.chest.y },
    ...d.keys.map((k, i) => ({ name: `Schlüssel ${i + 1}`, x: k.x, y: k.y })),
  ];
  for (const o of objects) {
    if (!inGrid(o.x, o.y)) add('bounds', `${o.name} liegt außerhalb des Rasters`, o.x, o.y);
    else if (solid(d, o.x, o.y)) add('wall', `${o.name} steckt in einer Wand`, o.x, o.y);
  }
  const minD2 = rules.minSpacing * rules.minSpacing;
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];
      const b = objects[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (dx * dx + dy * dy < minD2) add('spacing', `${a.name} und ${b.name} brauchen ${rules.minSpacing} Kacheln Abstand`, b.x, b.y);
    }
  }

  // Elemente
  const perType = new Array<number>(ELEMENT_INFO.length).fill(0);
  const zone2 = rules.startZone * rules.startZone;
  d.elements.forEach((el, id) => {
    const info = ELEMENT_INFO[el.type];
    if (!info) {
      add('format', `Unbekannter Elementtyp ${el.type}`, el.x, el.y, id);
      return;
    }
    perType[el.type]++;
    const behavior = BEHAVIORS[el.type];
    if (!behavior) add('unavailable', `${info.name} gibt es in dieser Version noch nicht`, el.x, el.y, id);
    if (!inGrid(el.x, el.y)) {
      add('bounds', `${info.name} liegt außerhalb des Rasters`, el.x, el.y, id);
      return;
    }
    if (solid(d, el.x, el.y)) add('wall', `${info.name} steckt in einer Wand`, el.x, el.y, id);
    if (el.p.length !== info.params.length) {
      add('param', `${info.name} hat ${el.p.length} statt ${info.params.length} Parameter`, el.x, el.y, id);
      return;
    }
    info.params.forEach((spec, i) => {
      const v = el.p[i];
      if (!Number.isInteger(v) || v < spec.min || v > spec.max) add('param', `${info.name}: ${spec.name} muss zwischen ${spec.min} und ${spec.max} liegen`, el.x, el.y, id);
    });
    if (!behavior) return;
    behavior.check?.(el, d, (msg) => add('place', msg, el.x, el.y, id));
    for (const t of footprint(el, d)) {
      const dx = t.x - d.start.x;
      const dy = t.y - d.start.y;
      if (dx * dx + dy * dy <= zone2) {
        add('startzone', `${info.name} liegt im Startschutz (${rules.startZone} Kacheln)`, el.x, el.y, id);
        break;
      }
    }
  });

  const cost = elementCost(d);
  if (cost > rules.budget) add('budget', `Budget überschritten: ${cost} von ${rules.budget} Punkten`, 0, 0);
  perType.forEach((n, type) => {
    if (n > rules.maxPerType) add('maxType', `Höchstens ${rules.maxPerType}× ${ELEMENT_INFO[type].name}`, 0, 0);
  });
  if (d.elements.length > rules.maxElements) add('maxTotal', `Höchstens ${rules.maxElements} Elemente`, 0, 0);
  return out;
}

// ---------------------------------------------------------------- JSON (Inhalte, Golden Replays)

/**
 * Lesbares Format für mitgelieferte Level. rows: 12 Zeilen à 22 Zeichen, '#' ist fest.
 * Start, Schlüssel und Truhe stehen entweder als Felder darin oder als Buchstaben in rows:
 * 'S' Start, 'K' Schlüssel, 'T' Truhe. Elementparameter heißen wie in ELEMENT_INFO.
 */
export interface DungeonJson {
  name: string;
  rows: string[];
  start?: { x: number; y: number; dir?: number };
  startDir?: number;
  chest?: Tile;
  keys?: Tile[];
  elements?: ({ type: string; x: number; y: number } & Record<string, number | string>)[];
}

export function fromJson(j: DungeonJson): Dungeon {
  if (j.rows.length !== GRID_H) throw new Error(`„${j.name}“: ${GRID_H} Zeilen erwartet, ${j.rows.length} gefunden`);
  const terrain = new Uint8Array(TERRAIN_BYTES);
  let start: Tile | undefined;
  let chest: Tile | undefined;
  const keys: Tile[] = [];
  j.rows.forEach((row, y) => {
    if (row.length !== GRID_W) throw new Error(`„${j.name}“: Zeile ${y} hat ${row.length} statt ${GRID_W} Zeichen`);
    for (let x = 0; x < GRID_W; x++) {
      const ch = row[x];
      if (ch === '#') setSolid(terrain, x, y, true);
      else if (ch === 'S') start = { x, y };
      else if (ch === 'T') chest = { x, y };
      else if (ch === 'K') keys.push({ x, y });
    }
  });
  const s = j.start ?? start;
  const c = j.chest ?? chest;
  const k = j.keys ?? keys;
  if (!s || !c || k.length !== 3) throw new Error(`„${j.name}“: Start, Truhe und 3 Schlüssel fehlen`);
  const dirRaw = j.start?.dir ?? j.startDir ?? 1;
  const elements: Element[] = (j.elements ?? []).map((e) => {
    const info = elementByKey(e.type);
    if (!info) throw new Error(`„${j.name}“: unbekanntes Element „${e.type}“`);
    return { type: info.type, x: e.x, y: e.y, p: info.params.map((spec) => Number(e[spec.key] ?? spec.def)) };
  });
  return canonicalize({
    format: 1,
    name: j.name,
    terrain,
    start: { x: s.x, y: s.y, dir: dirRaw < 0 ? -1 : 1 },
    chest: { x: c.x, y: c.y },
    keys: [k[0], k[1], k[2]],
    elements,
  });
}

export function toJson(d: Dungeon): DungeonJson {
  const rows: string[] = [];
  for (let y = 0; y < GRID_H; y++) {
    let row = '';
    for (let x = 0; x < GRID_W; x++) row += solid(d, x, y) ? '#' : '.';
    rows.push(row);
  }
  return {
    name: d.name,
    rows,
    start: { x: d.start.x, y: d.start.y, dir: d.start.dir },
    chest: { x: d.chest.x, y: d.chest.y },
    keys: d.keys.map((k) => ({ x: k.x, y: k.y })),
    elements: d.elements.map((el) => {
      const info = ELEMENT_INFO[el.type];
      const out: { type: string; x: number; y: number } & Record<string, number | string> = { type: info.key, x: el.x, y: el.y };
      info.params.forEach((spec, i) => (out[spec.key] = el.p[i]));
      return out;
    }),
  };
}

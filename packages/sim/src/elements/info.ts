/**
 * Die 13 Elemente aus dem Spielkonzept. Die Typnummer ist Teil der kanonischen Kodierung und
 * bestimmt die Sortierung (Typ, y, x) und damit die Element-IDs. Nie umnummerieren.
 */
export const ET = {
  SPIKES: 0,
  SPRING: 1,
  SAW: 2,
  CRUMBLE: 3,
  FLAME: 4,
  GATE: 5,
  RAILSAW: 6,
  ORBITSAW: 7,
  PENDULUM: 8,
  STOMPER: 9,
  CROSSBOW: 10,
  GUARD: 11,
  SCOUT: 12,
} as const;

export type ElementType = (typeof ET)[keyof typeof ET];

/** Gestufter Parameter, wie ihn der Editor als Stufenknöpfe zeigt. */
export interface ParamSpec {
  key: string;
  name: string;
  min: number;
  max: number;
  def: number;
  labels?: readonly string[];
}

export interface ElementInfo {
  type: ElementType;
  /** Name im JSON-Format */
  key: string;
  name: string;
  cost: number;
  params: readonly ParamSpec[];
}

const DIR4 = ['oben', 'rechts', 'unten', 'links'] as const;
const PHASE: ParamSpec = { key: 'phase', name: 'Phase', min: 0, max: 7, def: 0 };

export const ELEMENT_INFO: readonly ElementInfo[] = [
  {
    type: ET.SPIKES,
    key: 'spikes',
    name: 'Stacheln',
    cost: 1,
    params: [{ key: 'dir', name: 'Ausrichtung', min: 0, max: 3, def: 0, labels: DIR4 }],
  },
  { type: ET.SPRING, key: 'spring', name: 'Sprungfeder', cost: 1, params: [] },
  { type: ET.SAW, key: 'saw', name: 'Säge', cost: 2, params: [] },
  { type: ET.CRUMBLE, key: 'crumble', name: 'Bröckelboden', cost: 2, params: [] },
  {
    type: ET.FLAME,
    key: 'flame',
    name: 'Flammendüse',
    cost: 3,
    params: [
      { key: 'dir', name: 'Richtung', min: 0, max: 3, def: 0, labels: DIR4 },
      { key: 'takt', name: 'Takt an/aus', min: 0, max: 2, def: 0, labels: ['1/1 s', '0,5/1,5 s', '1,5/0,5 s'] },
      PHASE,
    ],
  },
  { type: ET.GATE, key: 'gate', name: 'Schalter + Tor', cost: 3, params: [] },
  {
    type: ET.RAILSAW,
    key: 'railsaw',
    name: 'Schienensäge',
    cost: 4,
    params: [
      { key: 'dx', name: 'Weg waagerecht', min: -6, max: 6, def: 3 },
      { key: 'dy', name: 'Weg senkrecht', min: -6, max: 6, def: 0 },
      { key: 'tempo', name: 'Tempo', min: 0, max: 2, def: 1, labels: ['1', '2', '3'] },
      PHASE,
    ],
  },
  { type: ET.ORBITSAW, key: 'orbitsaw', name: 'Kreisbahnsäge', cost: 4, params: [] },
  { type: ET.PENDULUM, key: 'pendulum', name: 'Pendelklinge', cost: 4, params: [] },
  { type: ET.STOMPER, key: 'stomper', name: 'Stampfer', cost: 4, params: [] },
  { type: ET.CROSSBOW, key: 'crossbow', name: 'Armbrust', cost: 4, params: [] },
  { type: ET.GUARD, key: 'guard', name: 'Wächter', cost: 5, params: [] },
  { type: ET.SCOUT, key: 'scout', name: 'Späher', cost: 6, params: [] },
];

export function elementByKey(key: string): ElementInfo | undefined {
  return ELEMENT_INFO.find((e) => e.key === key);
}

/** Richtungen 0…3 = oben, rechts, unten, links. */
export const DIR_DX: readonly number[] = [0, 1, 0, -1];
export const DIR_DY: readonly number[] = [-1, 0, 1, 0];

/**
 * Die 13 Elemente aus dem Spielkonzept plus das Prallbrett. Die Typnummer ist Teil der kanonischen
 * Kodierung und bestimmt die Sortierung (Typ, y, x) und damit die Element-IDs. Nie umnummerieren.
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
  BUMPER: 13,
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
  /** eine Zeile für den Editor */
  desc: string;
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
    desc: 'Statisch, eine Kachel, an Boden, Wand oder Decke.',
    params: [{ key: 'dir', name: 'Ausrichtung', min: 0, max: 3, def: 0, labels: DIR4 }],
  },
  { type: ET.SPRING, key: 'spring', name: 'Sprungfeder', cost: 1, desc: 'Schleudert den Dieb 5,1 Kacheln hoch.', params: [] },
  { type: ET.SAW, key: 'saw', name: 'Säge', cost: 2, desc: 'Statisch, Trefferkreis Ø 1,2 Kacheln.', params: [] },
  { type: ET.CRUMBLE, key: 'crumble', name: 'Bröckelboden', cost: 2, desc: 'Bricht 0,4 s nach dem Betreten, nach 3 s wieder da.', params: [] },
  {
    type: ET.FLAME,
    key: 'flame',
    name: 'Flammendüse',
    cost: 3,
    desc: 'Strahl bis 3 Kacheln lang, an und aus im Takt.',
    params: [
      { key: 'dir', name: 'Richtung', min: 0, max: 3, def: 0, labels: DIR4 },
      { key: 'takt', name: 'Takt an/aus', min: 0, max: 2, def: 0, labels: ['1/1 s', '0,5/1,5 s', '1,5/0,5 s'] },
      PHASE,
    ],
  },
  {
    type: ET.GATE,
    key: 'gate',
    name: 'Schalter + Tor',
    cost: 3,
    desc: 'Der Schalter öffnet ein 1 × 3-Tor für eine feste Zeit.',
    params: [
      { key: 'gx', name: 'Tor waagerecht', min: -8, max: 8, def: 3 },
      { key: 'gy', name: 'Tor senkrecht', min: -8, max: 8, def: -2 },
      { key: 'dauer', name: 'Offen', min: 0, max: 2, def: 1, labels: ['2 s', '4 s', '6 s'] },
    ],
  },
  {
    type: ET.RAILSAW,
    key: 'railsaw',
    name: 'Schienensäge',
    cost: 4,
    desc: 'Pendelt zwischen zwei Punkten, höchstens 6 Kacheln.',
    params: [
      { key: 'dx', name: 'Weg waagerecht', min: -6, max: 6, def: 3 },
      { key: 'dy', name: 'Weg senkrecht', min: -6, max: 6, def: 0 },
      { key: 'tempo', name: 'Tempo', min: 0, max: 2, def: 1, labels: ['1', '2', '3'] },
      PHASE,
    ],
  },
  {
    type: ET.ORBITSAW,
    key: 'orbitsaw',
    name: 'Kreisbahnsäge',
    cost: 4,
    desc: 'Kreist um einen Mittelpunkt, Radius 1 bis 3 Kacheln.',
    params: [
      { key: 'radius', name: 'Radius', min: 1, max: 3, def: 2 },
      { key: 'umlauf', name: 'Umlauf', min: 0, max: 2, def: 1, labels: ['4 s', '3 s', '2 s'] },
      { key: 'dreh', name: 'Drehrichtung', min: 0, max: 1, def: 0, labels: ['im Uhrzeigersinn', 'gegen den Uhrzeigersinn'] },
      PHASE,
    ],
  },
  {
    type: ET.PENDULUM,
    key: 'pendulum',
    name: 'Pendelklinge',
    cost: 4,
    desc: 'Schwingt ±60° an einer Kette von der Decke.',
    params: [
      { key: 'kette', name: 'Kette', min: 2, max: 4, def: 3 },
      { key: 'periode', name: 'Periode', min: 0, max: 2, def: 0, labels: ['3 s', '2,5 s', '2 s'] },
      PHASE,
    ],
  },
  {
    type: ET.STOMPER,
    key: 'stomper',
    name: 'Stampfer',
    cost: 4,
    desc: 'Fällt bis zu 5 Kacheln von der Decke und hebt sich wieder.',
    params: [{ key: 'takt', name: 'Takt', min: 0, max: 2, def: 1, labels: ['2 s', '3 s', '4 s'] }, PHASE],
  },
  {
    type: ET.CROSSBOW,
    key: 'crossbow',
    name: 'Armbrust',
    cost: 4,
    desc: 'Schießt Bolzen in eine feste Richtung bis zur Wand.',
    params: [
      { key: 'dir', name: 'Richtung', min: 0, max: 3, def: 1, labels: DIR4 },
      { key: 'intervall', name: 'Intervall', min: 0, max: 2, def: 1, labels: ['1 s', '1,5 s', '2 s'] },
      PHASE,
    ],
  },
  {
    type: ET.GUARD,
    key: 'guard',
    name: 'Wächter',
    cost: 5,
    desc: 'Patrouilliert und wendet an Kante oder Wand.',
    params: [{ key: 'tempo', name: 'Tempo', min: 0, max: 2, def: 1, labels: ['1,9 K/s', '2,8 K/s', '3,8 K/s'] }],
  },
  {
    type: ET.SCOUT,
    key: 'scout',
    name: 'Späher',
    cost: 6,
    desc: 'Schießt 0,4 s nachdem der Dieb seine Sichtlinie betritt, dann 1,5 s Pause.',
    params: [{ key: 'blick', name: 'Blickrichtung', min: 0, max: 1, def: 1, labels: ['links', 'rechts'] }],
  },
  {
    type: ET.BUMPER,
    key: 'bumper',
    name: 'Prallbrett',
    cost: 1,
    desc: 'An der Wand: Wer dagegenläuft, wird in die andere Richtung gedrückt.',
    params: [{ key: 'seite', name: 'Wand', min: 0, max: 1, def: 1, labels: ['links', 'rechts'] }],
  },
];

export function elementByKey(key: string): ElementInfo | undefined {
  return ELEMENT_INFO.find((e) => e.key === key);
}

/** Richtungen 0…3 = oben, rechts, unten, links. */
export const DIR_DX: readonly number[] = [0, 1, 0, -1];
export const DIR_DY: readonly number[] = [-1, 0, 1, 0];

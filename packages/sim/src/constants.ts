import { TICKS_PER_SECOND } from './units';

/** Jede Physikänderung erhöht SIM_VERSION; alte Replays bleiben mit ihrer Version prüfbar. */
export const SIM_VERSION = 1;

export const GRID_W = 22;
export const GRID_H = 12;

/** Ein Lauf endet spätestens nach 60 s. */
export const MAX_RUN_TICKS = 60 * TICKS_PER_SECOND;

/** Alle 60 Ticks entsteht ein Zustands-Hash (Prüfpunkt). */
export const HASH_INTERVAL = 60;

/**
 * Physikwerte in SE und Ticks, alles ganze Zahlen. Das Tuning-Panel ändert nur diese Werte,
 * Replays speichern sie mit, falls sie vom Standard abweichen.
 */
export interface Physics {
  /** Laufgeschwindigkeit (SE/Tick) */
  runSpeed: number;
  /** Schwerkraft (SE/Tick²) */
  gravity: number;
  /** Absprung vom Boden (SE/Tick) */
  jumpVy: number;
  /** So viele Ticks nach dem Absprung bricht Loslassen frühestens ab */
  minJumpTicks: number;
  /** Loslassen kappt vy auf diesen Wert */
  releaseVy: number;
  /** Absprung von der Wand (SE/Tick) */
  wallJumpVy: number;
  /** Maximale Fallgeschwindigkeit (SE/Tick) */
  maxFall: number;
  /** Maximale Rutschgeschwindigkeit an der Wand (SE/Tick) */
  wallSlide: number;
  /** Coyote-Zeit: Sprung noch so viele Ticks nach der Kante */
  coyote: number;
  /** Eingabepuffer: ein Tippen zählt so viele Ticks lang */
  buffer: number;
  /** Sprungfeder (SE/Tick) */
  springVy: number;
  /** Hitbox des Diebs (SE) */
  thiefW: number;
  thiefH: number;
  /** 1 = Haltedauer bestimmt die Sprunghöhe, 0 = feste Sprunghöhe (A/B-Test) */
  variableJump: number;
}

/** Feste Reihenfolge der Physikwerte für Kodierung und Anzeige. */
export const PHYSICS_KEYS: readonly (keyof Physics)[] = [
  'runSpeed',
  'gravity',
  'jumpVy',
  'minJumpTicks',
  'releaseVy',
  'wallJumpVy',
  'maxFall',
  'wallSlide',
  'coyote',
  'buffer',
  'springVy',
  'thiefW',
  'thiefH',
  'variableJump',
];

/** Kennwerte aus dem Spielkonzept („Steuerung & Physik“). */
export const DEFAULT_PHYSICS: Readonly<Physics> = Object.freeze({
  runSpeed: 24,
  gravity: 3,
  jumpVy: 72,
  minJumpTicks: 6,
  releaseVy: 24,
  wallJumpVy: 66,
  maxFall: 80,
  wallSlide: 12,
  coyote: 5,
  buffer: 6,
  springVy: 90,
  thiefW: 152,
  thiefH: 232,
  variableJump: 1,
});

/**
 * Erlaubte Bereiche. Die Kollision setzt einen Dieb kleiner als eine Kachel voraus und
 * höchstens eine überquerte Kachelgrenze pro Tick, also Geschwindigkeiten unter 256 SE.
 */
export const PHYSICS_LIMITS: Readonly<Record<keyof Physics, readonly [number, number]>> = {
  runSpeed: [4, 64],
  gravity: [1, 8],
  jumpVy: [24, 160],
  minJumpTicks: [0, 30],
  releaseVy: [0, 80],
  wallJumpVy: [24, 160],
  maxFall: [8, 160],
  wallSlide: [0, 80],
  coyote: [0, 15],
  buffer: [1, 15],
  springVy: [24, 200],
  thiefW: [64, 240],
  thiefH: [64, 248],
  variableJump: [0, 1],
};

/** Übernimmt gültige Ganzzahlen aus p, alles andere bleibt Standard. */
export function clampPhysics(p: Partial<Physics>): Physics {
  const out: Physics = { ...DEFAULT_PHYSICS };
  for (const k of PHYSICS_KEYS) {
    const v = p[k];
    if (typeof v === 'number' && Number.isInteger(v)) {
      const [lo, hi] = PHYSICS_LIMITS[k];
      out[k] = Math.min(hi, Math.max(lo, v));
    }
  }
  return out;
}

export function isDefaultPhysics(p: Physics): boolean {
  for (const k of PHYSICS_KEYS) if (p[k] !== DEFAULT_PHYSICS[k]) return false;
  return true;
}

/** Tempostufen beweglicher Elemente in SE/Tick (1,4 / 2,3 / 3,3 Kacheln/s). */
export const TEMPO: readonly number[] = [6, 10, 14];

/** Die Phase hat 8 Stufen zu je 1/8 des Zyklus. */
export const PHASE_STEPS = 8;

/** Geschosse fliegen 48 SE/Tick. */
export const BOLT_SPEED = 48;

/** Bauregeln eines Modus (Spielkonzept, „Budgets & Bauregeln“). */
export interface BuildRules {
  budget: number;
  maxPerType: number;
  maxElements: number;
  /** Startschutz: kein Fallenfeld in diesem Radius (Kacheln) um den Start */
  startZone: number;
  /** Mindestabstand zwischen Start, Schlüsseln und Truhe (Kacheln) */
  minSpacing: number;
  /** Höchstes Par in Ticks */
  maxPar: number;
}

export const FORTRESS_RULES: Readonly<BuildRules> = Object.freeze({
  budget: 40,
  maxPerType: 6,
  maxElements: 30,
  startZone: 3,
  minSpacing: 4,
  maxPar: 45 * TICKS_PER_SECOND,
});

export const DUEL_RULES: Readonly<BuildRules> = Object.freeze({
  budget: 20,
  maxPerType: 6,
  maxElements: 30,
  startZone: 3,
  minSpacing: 4,
  maxPar: 30 * TICKS_PER_SECOND,
});

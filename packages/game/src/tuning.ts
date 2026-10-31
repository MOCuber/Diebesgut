import { DEFAULT_PHYSICS, SE_PER_TILE, TICKS_PER_SECOND, type Physics } from '@diebesgut/sim';
import type { BlindTest } from './storage';

export interface ParamUi {
  key: keyof Physics;
  label: string;
  unit: string;
  step: number;
}

/** Was das Tuning-Panel zeigt, in dieser Reihenfolge. */
export const TUNING_PARAMS: readonly ParamUi[] = [
  { key: 'runSpeed', label: 'Laufgeschwindigkeit', unit: 'SE/Tick', step: 1 },
  { key: 'gravity', label: 'Schwerkraft', unit: 'SE/Tick²', step: 1 },
  { key: 'jumpVy', label: 'Sprungkraft', unit: 'SE/Tick', step: 2 },
  { key: 'minJumpTicks', label: 'Mindest-Sprungdauer', unit: 'Ticks', step: 1 },
  { key: 'releaseVy', label: 'Loslassen kappt auf', unit: 'SE/Tick', step: 2 },
  { key: 'wallJumpVy', label: 'Walljump-Kraft', unit: 'SE/Tick', step: 2 },
  { key: 'maxFall', label: 'Max. Fallgeschwindigkeit', unit: 'SE/Tick', step: 4 },
  { key: 'wallSlide', label: 'Wandrutschen max.', unit: 'SE/Tick', step: 2 },
  { key: 'coyote', label: 'Coyote-Zeit', unit: 'Ticks', step: 1 },
  { key: 'buffer', label: 'Eingabepuffer', unit: 'Ticks', step: 1 },
  { key: 'thiefW', label: 'Hitbox Breite', unit: 'SE', step: 8 },
  { key: 'thiefH', label: 'Hitbox Höhe', unit: 'SE', step: 8 },
];

/** Steighöhe in SE, gerechnet wie im Sim-Kern: erst Abbruch, dann Schwerkraft, dann Bewegung. */
function rise(p: Physics, v0: number, release: boolean): { height: number; airTicks: number } {
  let vy = v0;
  let h = 0;
  let k = 0;
  let peak = 0;
  // steigen und wieder auf Ausgangshöhe fallen
  for (; k < 1000; k++) {
    if (release && p.variableJump && k >= p.minJumpTicks && vy > p.releaseVy) vy = p.releaseVy;
    vy = Math.max(vy - p.gravity, -p.maxFall);
    h += vy;
    peak = Math.max(peak, h);
    if (h <= 0 && vy < 0) break;
  }
  return { height: peak, airTicks: k + 1 };
}

export interface JumpStats {
  fullHeight: number;
  fullWidth: number;
  minHeight: number;
  minWidth: number;
  wallHeight: number;
  runSpeed: number;
  maxFall: number;
  wallSlide: number;
}

/** Abgeleitete Kennwerte in Kacheln bzw. Kacheln pro Sekunde, wie in der Tabelle im Spielkonzept. */
export function jumpStats(p: Physics): JumpStats {
  const full = rise(p, p.jumpVy, false);
  const min = rise(p, p.jumpVy, true);
  const wall = rise(p, p.wallJumpVy, false);
  const tps = TICKS_PER_SECOND / SE_PER_TILE;
  return {
    fullHeight: full.height / SE_PER_TILE,
    fullWidth: (full.airTicks * p.runSpeed) / SE_PER_TILE,
    minHeight: min.height / SE_PER_TILE,
    minWidth: (min.airTicks * p.runSpeed) / SE_PER_TILE,
    wallHeight: wall.height / SE_PER_TILE,
    runSpeed: p.runSpeed * tps,
    maxFall: p.maxFall * tps,
    wallSlide: p.wallSlide * tps,
  };
}

/** Physik für die Simulation: Im Blindtest bestimmt die gewählte Variante den Sprungmodus. */
export function effectivePhysics(tuning: Physics, blind: BlindTest | null): Physics {
  if (!blind) return tuning;
  return { ...tuning, variableJump: blind.map[blind.current - 1] };
}

export function blindLabel(blind: BlindTest | null): string {
  return blind ? `V${blind.current}` : '';
}

/** Neuer Blindtest: Welche Variante variabel ist, entscheidet der Zufall und bleibt verdeckt. */
export function newBlindTest(): BlindTest {
  const variableFirst = Math.random() < 0.5;
  return { map: variableFirst ? [1, 0] : [0, 1], current: 1, revealed: false };
}

export function isTuned(p: Physics): boolean {
  return Object.keys(DEFAULT_PHYSICS).some((k) => p[k as keyof Physics] !== DEFAULT_PHYSICS[k as keyof Physics]);
}

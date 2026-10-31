// Die einzige Schnittstelle des Sim-Kerns nach außen. Grafik, Editor und später der Server
// benutzen nur diese Funktionen.

export * from './units';
export * from './constants';

export {
  canonicalize,
  decode,
  dungeonHash,
  elementCost,
  encode,
  footprint,
  fromJson,
  toJson,
  validate,
  DUNGEON_FORMAT,
  MAX_NAME_LENGTH,
} from './dungeon';
export type { Dungeon, DungeonJson, Element, Problem, Tile } from './dungeon';

export { inGrid, setSolid, solid, TERRAIN_BYTES } from './terrain';

export { ET, ELEMENT_INFO, DIR_DX, DIR_DY, elementByKey } from './elements/info';
export type { ElementInfo, ElementType, ParamSpec } from './elements/info';
export { BEHAVIORS } from './elements';
export { SAW_RADIUS, SAW_DRAW_RADIUS } from './elements/saw';
export { SPIKE_DEPTH } from './elements/spikes';
export { railsawCenter, railsawOffset, RAIL_MAX } from './elements/railsaw';
export { flameCycle, flameLength, FLAME_DRAW_WIDTH, FLAME_LEN, FLAME_PERIOD, FLAME_TAKT } from './elements/flame';

export { RECT, CIRCLE, rectsOverlap, circleHitsRect, shapeHitsRect } from './shapes';
export type { Shape } from './shapes';

export { createRun, cloneRun, step, shapesAt, dynSize, KEY_BOX, CHEST_BOX } from './step';
export type { Run, RunStatus, Thief, TickInput } from './step';

export { stateHash, fnvInt, STATUS_CODES } from './hash';
export { Recorder, ReplayInput, verify, checkReplay, makeReplay, encodeReplay, decodeReplay } from './replay';
export type { Replay, RunResult } from './replay';

export { sha256, toHex, fromHex } from './sha256';

export { checkGolden, makeGolden } from './golden';
export type { GoldenCheck, GoldenReplay } from './golden';

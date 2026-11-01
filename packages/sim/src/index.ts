// Die einzige Schnittstelle des Sim-Kerns nach außen. Grafik, Editor und später der Server
// benutzen nur diese Funktionen.

export * from './units';
export * from './constants';

export {
  canonicalize,
  compareElements,
  decode,
  dungeonHash,
  countElements,
  encode,
  footprint,
  fromJson,
  toJson,
  validate,
  DUNGEON_FORMAT,
  MAX_NAME_LENGTH,
} from './dungeon';
export type { Dungeon, DungeonJson, Element, Problem, Tile } from './dungeon';

export { blocked, freeRun, inGrid, setSolid, solid, TERRAIN_BYTES } from './terrain';

export { ET, ELEMENT_INFO, DIR_DX, DIR_DY, elementByKey } from './elements/info';
export type { ElementInfo, ElementType, ParamSpec } from './elements/info';
export { BEHAVIORS } from './elements';
export { SAW_RADIUS, SAW_DRAW_RADIUS } from './elements/saw';
export { SPIKE_DEPTH } from './elements/spikes';
export { railsawCenter, railsawOffset, RAIL_MAX } from './elements/railsaw';
export { flameCycle, flameLength, FLAME_DRAW_WIDTH, FLAME_LEN, FLAME_PERIOD, FLAME_TAKT } from './elements/flame';
export { SPRING_BOX } from './elements/spring';
export { CRUMBLE_DELAY, CRUMBLE_RESPAWN } from './elements/crumble';
export { GATE_DURATION, GATE_HEIGHT, SWITCH_BOX, gateTile } from './elements/gate';
export { ORBIT_PERIOD, orbitAngle, orbitCenter } from './elements/orbitsaw';
export { PENDULUM_AMPLITUDE, PENDULUM_BLADE, PENDULUM_PERIOD, pendulumAngle, pendulumPos } from './elements/pendulum';
export { STOMPER_MAX, STOMPER_PERIOD, stomperDrop, stomperMaxDrop } from './elements/stomper';
export { BOLT_LENGTH, BOLT_WIDTH, CROSSBOW_INTERVAL, crossbowBolt, crossbowRange } from './elements/crossbow';
export { GUARD_H, GUARD_SPEED, GUARD_W, guardPos, guardRange } from './elements/guard';
export { SCOUT_AIM, SCOUT_PAUSE, scoutDir, scoutSight } from './elements/scout';
export { BUMPER_DEPTH } from './elements/bumper';

export { RECT, CIRCLE, rectsOverlap, circleHitsRect, circlesOverlap, shapeHitsRect, shapeHitsCircle } from './shapes';
export type { Shape } from './shapes';

export { createRun, cloneRun, step, shapesAt, dynSize, dynOffsets, KEY_BOX, CHEST_BOX } from './step';
export type { Run, RunStatus, Thief, TickInput } from './step';

export { stateHash, fnvInt, STATUS_CODES } from './hash';
export { Recorder, ReplayInput, verify, checkReplay, makeReplay, encodeReplay, decodeReplay } from './replay';
export type { Replay, RunResult } from './replay';

export { sha256, toHex, fromHex } from './sha256';

export { checkGolden, makeGolden } from './golden';
export type { GoldenCheck, GoldenReplay } from './golden';

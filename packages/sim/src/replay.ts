import { ByteReader, ByteWriter } from './bytes';
import { DEFAULT_PHYSICS, HASH_INTERVAL, PHYSICS_KEYS, SIM_VERSION, clampPhysics, isDefaultPhysics, type Physics } from './constants';
import { dungeonHash, type Dungeon } from './dungeon';
import { STATUS_CODES, stateHash } from './hash';
import { fromHex, toHex } from './sha256';
import { createRun, step, type RunStatus } from './step';
import type { TickInput } from './thief';

/**
 * Ein Replay speichert nur die Ticks, an denen der Finger wechselt. Mehrere Wechsel im selben
 * Tick sind erlaubt: Ein Tippen, das zwischen zwei Ticks beginnt und endet, steht als zwei
 * gleiche Einträge darin.
 */
export interface Replay {
  simVersion: number;
  dungeonHash: string;
  phys: Physics;
  /** aufsteigende Ticks (ab 1), an denen der Finger wechselt; der erste Wechsel ist ein Druck */
  toggles: number[];
  /** Länge des Laufs in Ticks */
  ticks: number;
  status: RunStatus;
  keys: number;
  finalHash: number;
}

export interface RunResult {
  status: RunStatus;
  ticks: number;
  keys: number;
  killer: number;
  finalHash: number;
  /** Zustands-Hash alle 60 Ticks */
  hashes: number[];
}

/** Zeichnet die Eingaben eines Laufs als Fingerwechsel auf. */
export class Recorder {
  readonly toggles: number[] = [];
  private held = false;

  /**
   * Eingabe für Tick tick. Die Eingabe muss stimmig sein: held wird nur durch einen Druck wahr,
   * sonst ließe sie sich nicht verlustfrei als Wechsel speichern.
   */
  add(tick: number, input: TickInput): void {
    let n: number;
    if (!this.held) n = input.pressed ? (input.held ? 1 : 2) : input.held ? 1 : 0;
    else n = input.pressed ? (input.held ? 2 : 3) : input.held ? 0 : 1;
    for (let i = 0; i < n; i++) this.toggles.push(tick);
    this.held = input.held;
  }
}

/** Liefert aus den Fingerwechseln die Eingabe für aufsteigende Ticks. */
export class ReplayInput {
  private i = 0;
  private held = false;

  constructor(private readonly toggles: readonly number[]) {}

  at(tick: number): TickInput {
    let n = 0;
    while (this.i < this.toggles.length && this.toggles[this.i] <= tick) {
      n++;
      this.i++;
    }
    const was = this.held;
    if ((n & 1) === 1) this.held = !was;
    return { held: this.held, pressed: n > 0 && (!was || n >= 2) };
  }
}

/** Spielt die Eingaben nach und liefert Ergebnis und Prüfpunkte. */
export function verify(d: Dungeon, replay: Pick<Replay, 'phys' | 'toggles' | 'ticks'>): RunResult {
  const run = createRun(d, replay.phys);
  const input = new ReplayInput(replay.toggles);
  const hashes: number[] = [];
  while (run.status === 'running' && run.tick < replay.ticks) {
    step(d, run, input.at(run.tick + 1));
    if (run.tick % HASH_INTERVAL === 0) hashes.push(stateHash(run));
  }
  return { status: run.status, ticks: run.tick, keys: run.keys, killer: run.killer, finalHash: stateHash(run), hashes };
}

/** Prüft ein Replay gegen einen Dungeon. Liefert null, wenn alles stimmt, sonst den Grund. */
export function checkReplay(d: Dungeon, replay: Replay): string | null {
  if (replay.simVersion !== SIM_VERSION) return `Replay stammt von Sim-Version ${replay.simVersion}, aktuell ist ${SIM_VERSION}`;
  if (replay.dungeonHash !== dungeonHash(d)) return 'Replay gehört zu einem anderen Dungeon';
  const r = verify(d, replay);
  if (r.status !== replay.status || r.ticks !== replay.ticks || r.keys !== replay.keys) {
    return `Ergebnis weicht ab: ${r.status} nach ${r.ticks} Ticks statt ${replay.status} nach ${replay.ticks}`;
  }
  if (r.finalHash !== replay.finalHash) return 'Determinismus-Fehler: End-Hash weicht ab';
  return null;
}

export function makeReplay(d: Dungeon, phys: Physics, toggles: number[], result: RunResult): Replay {
  return {
    simVersion: SIM_VERSION,
    dungeonHash: dungeonHash(d),
    phys,
    toggles: toggles.slice(),
    ticks: result.ticks,
    status: result.status,
    keys: result.keys,
    finalHash: result.finalHash,
  };
}

const REPLAY_FORMAT = 1;

/** Binärform: Kopf, Dungeon-Hash, Physik (nur falls abweichend), Wechsel als Abstände. */
export function encodeReplay(r: Replay): Uint8Array {
  const w = new ByteWriter();
  w.u8(REPLAY_FORMAT);
  w.varint(r.simVersion);
  w.bytes(fromHex(r.dungeonHash));
  if (isDefaultPhysics(r.phys)) {
    w.u8(0);
  } else {
    w.u8(1);
    for (const k of PHYSICS_KEYS) w.varint(r.phys[k]);
  }
  w.varint(r.ticks);
  w.u8(STATUS_CODES.indexOf(r.status));
  w.u8(r.keys);
  w.u32(r.finalHash);
  w.varint(r.toggles.length);
  let last = 0;
  for (const t of r.toggles) {
    w.varint(t - last);
    last = t;
  }
  return w.finish();
}

export function decodeReplay(bytes: Uint8Array): Replay {
  const rd = new ByteReader(bytes);
  const format = rd.u8();
  if (format !== REPLAY_FORMAT) throw new Error(`Unbekanntes Replay-Format ${format}`);
  const simVersion = rd.varint();
  const hash = toHex(rd.bytes(32));
  let phys: Physics = { ...DEFAULT_PHYSICS };
  if (rd.u8() === 1) {
    const p: Partial<Physics> = {};
    for (const k of PHYSICS_KEYS) p[k] = rd.varint();
    phys = clampPhysics(p);
  }
  const ticks = rd.varint();
  const status = STATUS_CODES[rd.u8()] ?? 'running';
  const keys = rd.u8();
  const finalHash = rd.u32();
  const n = rd.varint();
  const toggles: number[] = [];
  let last = 0;
  for (let i = 0; i < n; i++) {
    last += rd.varint();
    toggles.push(last);
  }
  return { simVersion, dungeonHash: hash, phys, toggles, ticks, status, keys, finalHash };
}

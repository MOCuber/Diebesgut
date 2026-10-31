import type { Run, RunStatus } from './step';

// FNV-1a (32 Bit) über alle Zustandswerte, Byte für Byte, gerechnet mit Math.imul.

const FNV_OFFSET = 0x811c9dc5 | 0;
const FNV_PRIME = 0x01000193;

/** Mischt eine 32-Bit-Ganzzahl (4 Bytes, niedrigstes zuerst) in den Hash. */
export function fnvInt(h: number, v: number): number {
  h = Math.imul(h ^ (v & 255), FNV_PRIME);
  h = Math.imul(h ^ ((v >> 8) & 255), FNV_PRIME);
  h = Math.imul(h ^ ((v >> 16) & 255), FNV_PRIME);
  h = Math.imul(h ^ ((v >> 24) & 255), FNV_PRIME);
  return h;
}

export const STATUS_CODES: readonly RunStatus[] = ['running', 'dead', 'won', 'timeout'];

/** Zustands-Hash eines Laufs als vorzeichenlose 32-Bit-Zahl. */
export function stateHash(run: Run): number {
  const th = run.thief;
  let h = FNV_OFFSET;
  h = fnvInt(h, run.tick);
  h = fnvInt(h, STATUS_CODES.indexOf(run.status));
  h = fnvInt(h, th.x);
  h = fnvInt(h, th.y);
  h = fnvInt(h, th.vy);
  h = fnvInt(h, th.dir);
  h = fnvInt(h, th.ground ? 1 : 0);
  h = fnvInt(h, th.wall);
  h = fnvInt(h, th.jumpTick);
  h = fnvInt(h, th.coyote);
  h = fnvInt(h, th.buffer);
  h = fnvInt(h, run.keys);
  h = fnvInt(h, run.killer);
  for (let i = 0; i < run.dyn.length; i++) h = fnvInt(h, run.dyn[i]);
  return h >>> 0;
}

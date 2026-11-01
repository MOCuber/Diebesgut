import { describe, expect, it } from 'vitest';
import {
  HASH_INTERVAL,
  Recorder,
  ReplayInput,
  checkReplay,
  createRun,
  decodeReplay,
  encodeReplay,
  makeReplay,
  stateHash,
  step,
  verify,
  type TickInput,
} from '../src';
import { flatRoom, randomInputs } from './util';

const room = () =>
  flatRoom({
    rows: [
      '..............',
      '..............',
      '......##......',
      '......##......',
      '..##......##..',
      '..##......##..',
      '..............',
      '..............',
    ],
    elements: [
      { type: 'saw', x: 9, y: 5 },
      { type: 'flame', x: 12, y: 7, dir: 0, takt: 1, phase: 2 },
      { type: 'railsaw', x: 8, y: 0, dx: 5, tempo: 2 },
      { type: 'spikes', x: 6, y: 7, dir: 0 },
    ],
  });

function live(inputs: TickInput[]) {
  const d = room();
  const run = createRun(d);
  const rec = new Recorder();
  const hashes: number[] = [];
  for (const input of inputs) {
    if (run.status !== 'running') break;
    step(d, run, input);
    rec.add(run.tick, input);
    if (run.tick % HASH_INTERVAL === 0) hashes.push(stateHash(run));
  }
  return { d, run, rec, hashes };
}

describe('Replays', () => {
  it('Fingerwechsel geben jede stimmige Eingabe exakt wieder, auch Tippen innerhalb eines Ticks', () => {
    const inputs = randomInputs(7, 2000);
    const rec = new Recorder();
    inputs.forEach((input, i) => rec.add(i + 1, input));
    const back = new ReplayInput(rec.toggles);
    inputs.forEach((input, i) => expect(back.at(i + 1)).toEqual(input));
  });

  it('Nachspielen ergibt bitgleiche Zustände', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { d, run, rec, hashes } = live(randomInputs(seed, 3600));
      const r = verify(d, { phys: run.phys, toggles: rec.toggles, ticks: run.tick });
      expect(r.status).toBe(run.status);
      expect(r.ticks).toBe(run.tick);
      expect(r.hashes).toEqual(hashes);
      expect(r.finalHash).toBe(stateHash(run));
    }
  });

  it('Binärform ist verlustfrei und klein', () => {
    const { d, run, rec } = live(randomInputs(11, 1800));
    const result = verify(d, { phys: run.phys, toggles: rec.toggles, ticks: run.tick });
    const replay = makeReplay(d, run.phys, rec.toggles, result);
    const bytes = encodeReplay(replay);
    expect(decodeReplay(bytes)).toEqual(replay);
    expect(checkReplay(d, replay)).toBeNull();
    expect(bytes.length).toBeLessThan(2048);
  });

  it('ein 30-s-Lauf mit 20 Sprüngen belegt unter 200 Byte', () => {
    const inputs: TickInput[] = [];
    for (let t = 0; t < 1800; t++) {
      const k = t % 90;
      inputs.push(k === 0 ? { held: true, pressed: true } : { held: k < 12, pressed: false });
    }
    const rec = new Recorder();
    inputs.forEach((input, i) => rec.add(i + 1, input));
    const d = room();
    const result = verify(d, { phys: createRun(d).phys, toggles: rec.toggles, ticks: 1800 });
    expect(encodeReplay(makeReplay(d, createRun(d).phys, rec.toggles, result)).length).toBeLessThan(200);
  });

  it('ein verfälschtes Replay fällt auf', () => {
    const { d, run, rec } = live(randomInputs(3, 1200));
    const result = verify(d, { phys: run.phys, toggles: rec.toggles, ticks: run.tick });
    const replay = makeReplay(d, run.phys, rec.toggles, result);
    expect(checkReplay(d, { ...replay, finalHash: replay.finalHash ^ 1 })).toMatch(/Determinismus/);
    expect(checkReplay(d, { ...replay, simVersion: 99 })).toMatch(/Sim-Version/);
  });
});

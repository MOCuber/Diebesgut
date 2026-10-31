import { DEFAULT_PHYSICS, clampPhysics, type Physics } from './constants';
import { dungeonHash, fromJson, type DungeonJson } from './dungeon';
import { verify, type RunResult } from './replay';
import type { RunStatus } from './step';

/**
 * Golden Replay: Dungeon, Eingaben und die erwarteten Zustands-Hashes alle 60 Ticks.
 * Der Dungeon steht mit drin, damit spätere Änderungen an mitgelieferten Leveln die
 * Golden Replays nicht berühren. Jede Abweichung heißt: Die Simulation rechnet anders.
 */
export interface GoldenReplay {
  name: string;
  description?: string;
  dungeon: DungeonJson;
  /** nur Abweichungen vom Standard */
  phys?: Partial<Physics>;
  toggles: number[];
  ticks: number;
  expect: {
    dungeonHash: string;
    status: RunStatus;
    keys: number;
    hashes: number[];
    finalHash: number;
  };
}

export interface GoldenCheck {
  ok: boolean;
  problems: string[];
  result: RunResult;
}

function physicsOf(g: Pick<GoldenReplay, 'phys'>): Physics {
  return g.phys ? clampPhysics(g.phys) : { ...DEFAULT_PHYSICS };
}

export function makeGolden(name: string, description: string, dungeon: DungeonJson, phys: Partial<Physics> | undefined, toggles: number[], ticks: number): GoldenReplay {
  const d = fromJson(dungeon);
  const r = verify(d, { phys: physicsOf({ phys }), toggles, ticks });
  return {
    name,
    description,
    dungeon,
    ...(phys ? { phys } : {}),
    toggles: toggles.filter((t) => t <= r.ticks),
    ticks: r.ticks,
    expect: { dungeonHash: dungeonHash(d), status: r.status, keys: r.keys, hashes: r.hashes, finalHash: r.finalHash },
  };
}

export function checkGolden(g: GoldenReplay): GoldenCheck {
  const d = fromJson(g.dungeon);
  const r = verify(d, { phys: physicsOf(g), toggles: g.toggles, ticks: g.ticks });
  const problems: string[] = [];
  const hash = dungeonHash(d);
  if (hash !== g.expect.dungeonHash) problems.push(`Dungeon-Hash ${hash.slice(0, 12)}… statt ${g.expect.dungeonHash.slice(0, 12)}…`);
  if (r.status !== g.expect.status || r.ticks !== g.ticks) problems.push(`Ergebnis ${r.status} nach ${r.ticks} Ticks statt ${g.expect.status} nach ${g.ticks}`);
  if (r.keys !== g.expect.keys) problems.push(`Schlüssel ${r.keys} statt ${g.expect.keys}`);
  const n = Math.max(r.hashes.length, g.expect.hashes.length);
  for (let i = 0; i < n; i++) {
    if (r.hashes[i] !== g.expect.hashes[i]) {
      problems.push(`Prüfpunkt ${i + 1} (Tick ${(i + 1) * 60}) weicht ab`);
      break;
    }
  }
  if (r.finalHash !== g.expect.finalHash) problems.push('End-Hash weicht ab');
  return { ok: problems.length === 0, problems, result: r };
}

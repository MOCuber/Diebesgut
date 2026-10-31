import { readFileSync, readdirSync } from 'node:fs';
import { checkGolden, type GoldenReplay } from '@diebesgut/sim';
import { describe, expect, it } from 'vitest';

// Golden Replays mit erwarteten Hashes. Weicht einer ab, rechnet die Simulation anders als
// beim Aufnehmen: entweder ein Fehler oder eine gewollte Physikänderung (dann SIM_VERSION
// erhöhen und mit `npm run golden -- --update` neu aufnehmen).
// Die Dateien werden zur Laufzeit gelesen, nicht per import.meta.glob: Den Glob hält Vitests
// Modul-Cache sonst fest, und neue Golden Replays würden nicht geprüft.
const dir = new URL('.', import.meta.url);
const files: GoldenReplay[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as GoldenReplay);

describe('Golden Replays', () => {
  it('sind vorhanden', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  for (const g of files) {
    it(`${g.name}: ${g.expect.status} nach ${g.ticks} Ticks`, () => {
      expect(checkGolden(g).problems).toEqual([]);
    });
  }
});

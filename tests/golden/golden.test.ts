import { checkGolden, type GoldenReplay } from '@diebesgut/sim';
import { describe, expect, it } from 'vitest';

// Golden Replays mit erwarteten Hashes. Weicht einer ab, rechnet die Simulation anders als
// beim Aufnehmen: entweder ein Fehler oder eine gewollte Physikänderung (dann SIM_VERSION
// erhöhen und mit `npm run golden -- --update` neu aufnehmen).
const files = import.meta.glob<GoldenReplay>('./*.json', { eager: true, import: 'default' });

describe('Golden Replays', () => {
  it('sind vorhanden', () => {
    expect(Object.keys(files).length).toBeGreaterThanOrEqual(10);
  });

  for (const g of Object.values(files)) {
    it(`${g.name}: ${g.expect.status} nach ${g.ticks} Ticks`, () => {
      expect(checkGolden(g).problems).toEqual([]);
    });
  }
});

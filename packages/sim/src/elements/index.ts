import type { ElementBehavior } from './behavior';
import { flame } from './flame';
import { railsaw } from './railsaw';
import { saw } from './saw';
import { spikes } from './spikes';

/**
 * Verhalten je Elementtyp, Index = Typnummer. null heißt: in dieser Version noch nicht gebaut.
 * Meilenstein S0 enthält die vier Fallen Stacheln, Säge, Flammendüse und Schienensäge.
 */
export const BEHAVIORS: readonly (ElementBehavior | null)[] = [
  spikes, // 0 Stacheln
  null, // 1 Sprungfeder
  saw, // 2 Säge
  null, // 3 Bröckelboden
  flame, // 4 Flammendüse
  null, // 5 Schalter + Tor
  railsaw, // 6 Schienensäge
  null, // 7 Kreisbahnsäge
  null, // 8 Pendelklinge
  null, // 9 Stampfer
  null, // 10 Armbrust
  null, // 11 Wächter
  null, // 12 Späher
];

export type { ElementBehavior };

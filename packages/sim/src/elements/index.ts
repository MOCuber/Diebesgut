import type { ElementBehavior } from './behavior';
import { bumper } from './bumper';
import { crossbow } from './crossbow';
import { crumble } from './crumble';
import { flame } from './flame';
import { gate } from './gate';
import { guard } from './guard';
import { orbitsaw } from './orbitsaw';
import { pendulum } from './pendulum';
import { railsaw } from './railsaw';
import { saw } from './saw';
import { scout } from './scout';
import { spikes } from './spikes';
import { spring } from './spring';
import { stomper } from './stomper';

/** Verhalten je Elementtyp, Index = Typnummer. null hieße: in dieser Version noch nicht gebaut. */
export const BEHAVIORS: readonly (ElementBehavior | null)[] = [
  spikes, // 0 Stacheln
  spring, // 1 Sprungfeder
  saw, // 2 Säge
  crumble, // 3 Bröckelboden
  flame, // 4 Flammendüse
  gate, // 5 Schalter + Tor
  railsaw, // 6 Schienensäge
  orbitsaw, // 7 Kreisbahnsäge
  pendulum, // 8 Pendelklinge
  stomper, // 9 Stampfer
  crossbow, // 10 Armbrust
  guard, // 11 Wächter
  scout, // 12 Späher
  bumper, // 13 Prallbrett
];

export type { ElementBehavior };

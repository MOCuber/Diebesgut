import type { DungeonJson } from '@diebesgut/sim';
import raum1 from '../rooms/raum1.json';
import raum2 from '../rooms/raum2.json';
import raum3 from '../rooms/raum3.json';

export interface RoomInfo {
  id: string;
  json: DungeonJson;
  /** worum es in diesem Raum geht */
  goal: string;
}

/** Die drei Testräume aus Meilenstein S0 (Laufgefühl). */
export const TEST_ROOMS: readonly RoomInfo[] = [
  { id: 'raum1', json: raum1 as DungeonJson, goal: 'Kurze und hohe Sprünge, Walljump, Stacheln' },
  { id: 'raum2', json: raum2 as DungeonJson, goal: 'Sägen überspringen, Schienensägen abpassen' },
  { id: 'raum3', json: raum3 as DungeonJson, goal: 'Flammen im Takt, Sprünge unter Feuer' },
];

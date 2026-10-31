import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RunStatus } from '@diebesgut/sim';

// Alles liegt auf dem Gerät in IndexedDB. Fehlt der Speicher (etwa im privaten Modus),
// läuft das Spiel trotzdem, es merkt sich dann nur nichts.

export interface BlindTest {
  /** variableJump-Wert hinter Variante 1 und Variante 2 */
  map: [number, number];
  current: 1 | 2;
  revealed: boolean;
}

export interface Prefs {
  sound: boolean;
  hitboxes: boolean;
  blind: BlindTest | null;
}

export const DEFAULT_PREFS: Prefs = { sound: true, hitboxes: false, blind: null };

/** Ein Lauf für Statistik, Heatmap und CSV-Export (Playtest-Plan). */
export interface RunLog {
  id?: number;
  /** Date.now() beim Ende des Laufs */
  time: number;
  room: string;
  hash: string;
  /** Versuch Nr. seit Betreten des Raums */
  attempt: number;
  status: RunStatus | 'abort';
  ticks: number;
  keys: number;
  /** Elementname der tödlichen Falle, sonst leer */
  killer: string;
  deathX: number;
  deathY: number;
  jump: 'variabel' | 'fest';
  /** '' oder 'V1' / 'V2' im Blindtest */
  blind: string;
  /** Physik weicht (abgesehen vom Sprungmodus) vom Standard ab */
  tuned: boolean;
  /** Zeit vom Ende des vorigen Laufs bis zum Start dieses Laufs in ms, -1 beim ersten */
  restartMs: number;
}

export interface RoomRecord {
  /** Dungeon-Hash, bei fester Sprunghöhe mit Zusatz „|fest“ */
  key: string;
  name: string;
  bestTicks: number;
  bestReplay?: Uint8Array;
  attempts: number;
  wins: number;
  deaths: Record<string, number>;
}

interface Schema extends DBSchema {
  settings: { key: string; value: unknown };
  runs: { key: number; value: RunLog };
  records: { key: string; value: RoomRecord };
}

export const MAX_RUNS = 500;

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>('diebesgut', 1, {
    upgrade(d) {
      d.createObjectStore('settings');
      d.createObjectStore('runs', { keyPath: 'id', autoIncrement: true });
      d.createObjectStore('records', { keyPath: 'key' });
    },
  });
  return dbPromise;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn('Gerätespeicher nicht verfügbar:', err);
    return fallback;
  }
}

export function loadSetting<T>(name: string): Promise<T | undefined> {
  return safe(async () => (await (await db()).get('settings', name)) as T | undefined, undefined);
}

export function saveSetting(name: string, value: unknown): Promise<void> {
  return safe(async () => void (await (await db()).put('settings', value, name)), undefined);
}

/** Speichert einen Lauf und behält nur die letzten 500. */
export function addRun(run: RunLog): Promise<void> {
  return safe(async () => {
    const d = await db();
    await d.add('runs', run);
    let extra = (await d.count('runs')) - MAX_RUNS;
    if (extra <= 0) return;
    const tx = d.transaction('runs', 'readwrite');
    let cursor = await tx.store.openCursor();
    while (cursor && extra > 0) {
      await cursor.delete();
      extra--;
      cursor = await cursor.continue();
    }
    await tx.done;
  }, undefined);
}

export function allRuns(): Promise<RunLog[]> {
  return safe(async () => (await db()).getAll('runs'), []);
}

export function clearRuns(): Promise<void> {
  return safe(async () => void (await (await db()).clear('runs')), undefined);
}

export function getRecord(key: string): Promise<RoomRecord | undefined> {
  return safe(async () => (await db()).get('records', key), undefined);
}

export function putRecord(rec: RoomRecord): Promise<void> {
  return safe(async () => void (await (await db()).put('records', rec)), undefined);
}

export function allRecords(): Promise<RoomRecord[]> {
  return safe(async () => (await db()).getAll('records'), []);
}

/** Bittet den Browser, die Daten nicht bei Platzmangel zu löschen. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // nicht unterstützt
  }
}

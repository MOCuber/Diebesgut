import { useEffect, useState } from 'preact/hooks';
import { download, runsToCsv } from '../csv';
import { num, seconds } from '../format';
import { dungeonHash } from '@diebesgut/sim';
import { allRecords, allRuns, clearRuns, recordId, type Prefs, type RoomRecord, type RunLog } from '../storage';
import type { Room } from './MenuScreen';

interface Props {
  rooms: Room[];
  prefs: Prefs;
  onPrefs(p: Prefs): void;
  onBack(): void;
}

interface Group {
  label: string;
  runs: number;
  wins: number;
  deaths: number;
  aborts: number;
  playTicks: number;
}

function group(label: string, runs: RunLog[]): Group {
  return {
    label,
    runs: runs.length,
    wins: runs.filter((r) => r.status === 'won').length,
    deaths: runs.filter((r) => r.status === 'dead' || r.status === 'timeout').length,
    aborts: runs.filter((r) => r.status === 'abort').length,
    playTicks: runs.reduce((s, r) => s + r.ticks, 0),
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

/** Statistik pro Raum, A/B-Vergleich der Sprunghöhe und CSV-Export für den Playtest-Plan. */
export function StatsScreen({ rooms, prefs, onBack }: Props) {
  const [runs, setRuns] = useState<RunLog[] | null>(null);
  const [records, setRecords] = useState<Map<string, RoomRecord>>(new Map());
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    void allRuns().then(setRuns);
    void allRecords().then((list) => setRecords(new Map(list.map((r) => [r.key, r]))));
  }, []);

  if (!runs) return <div class="screen list-screen">Lade …</div>;

  const blind = prefs.blind;
  const reveal = (label: string) => {
    if (!blind || !blind.revealed) return 'verdeckt';
    const v = blind.map[label === 'V1' ? 0 : 1];
    return v ? 'variabel' : 'fest';
  };
  const variantOf = (r: RunLog) => (r.blind ? (blind?.revealed ? `${r.blind} (${reveal(r.blind)})` : r.blind) : r.jump);
  const variants = [...new Set(runs.map(variantOf))].sort();
  const restart = median(runs.filter((r) => r.restartMs >= 0).map((r) => r.restartMs));

  return (
    <div class="screen list-screen">
      <header class="list-head">
        <button class="btn" onClick={onBack}>
          Zurück
        </button>
        <h1>Statistik</h1>
        <button class="btn primary" disabled={runs.length === 0} onClick={() => download(`diebesgut-laeufe-${new Date().toISOString().slice(0, 10)}.csv`, runsToCsv(runs, reveal))}>
          CSV exportieren
        </button>
      </header>
      <p class="muted">
        Die letzten {runs.length} Läufe (höchstens 500) liegen auf diesem Gerät.
        {restart !== null && ` Neustart nach dem Tod im Median nach ${restart} ms.`}
      </p>

      <h2>Räume</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Raum</th>
            <th>Läufe</th>
            <th>Geschafft</th>
            <th>Tode</th>
            <th>Abbrüche</th>
            <th>Bestzeit</th>
            <th>Tode pro Falle</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => {
            const hash = dungeonHash(room.dungeon);
            const g = group(room.dungeon.name, runs.filter((r) => r.hash === hash));
            const std = records.get(recordId(hash));
            const fixed = records.get(recordId(hash, true));
            const deaths: Record<string, number> = {};
            for (const r of runs) if (r.hash === hash && r.killer) deaths[r.killer] = (deaths[r.killer] ?? 0) + 1;
            return (
              <tr key={room.id}>
                <td>{room.dungeon.name}</td>
                <td>{g.runs}</td>
                <td>{g.wins}</td>
                <td>{g.deaths}</td>
                <td>{g.aborts}</td>
                <td>
                  {std?.bestTicks ? `${seconds(std.bestTicks)} s` : '–'}
                  {fixed?.bestTicks ? ` · fest ${seconds(fixed.bestTicks)} s` : ''}
                </td>
                <td>
                  {Object.entries(deaths)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, n]) => `${k} ${n}`)
                    .join(', ') || '–'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Sprunghöhe (A/B)</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Variante</th>
            <th>Läufe</th>
            <th>Geschafft</th>
            <th>Tode</th>
            <th>Tode pro Erfolg</th>
            <th>Spielzeit</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => {
            const g = group(v, runs.filter((r) => variantOf(r) === v));
            return (
              <tr key={v}>
                <td>{v}</td>
                <td>{g.runs}</td>
                <td>{g.wins}</td>
                <td>{g.deaths}</td>
                <td>{g.wins ? num(g.deaths / g.wins, 1) : '–'}</td>
                <td>{num(g.playTicks / 3600, 1)} min</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div class="danger-zone">
        {confirm ? (
          <>
            <span>Alle Läufe löschen? Bestzeiten bleiben erhalten.</span>
            <button
              class="btn danger"
              onClick={() => {
                void clearRuns().then(() => setRuns([]));
                setConfirm(false);
              }}
            >
              Ja, löschen
            </button>
            <button class="btn" onClick={() => setConfirm(false)}>
              Abbrechen
            </button>
          </>
        ) : (
          <button class="btn" disabled={runs.length === 0} onClick={() => setConfirm(true)}>
            Läufe löschen
          </button>
        )}
      </div>
    </div>
  );
}

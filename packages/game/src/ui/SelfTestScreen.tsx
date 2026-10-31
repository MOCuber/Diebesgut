import { SIM_VERSION, TICKS_PER_SECOND, checkGolden, fromJson, verify, clampPhysics, type GoldenReplay } from '@diebesgut/sim';
import { useEffect, useState } from 'preact/hooks';
import { num, seconds } from '../format';

// Spielt alle Golden Replays auf dem Gerät nach und vergleicht die Hashes. So fällt sofort auf,
// wenn Safari und Chrome unterschiedlich rechnen.
const GOLDEN = Object.values(import.meta.glob<GoldenReplay>('../../../../tests/golden/*.json', { eager: true, import: 'default' })).sort((a, b) =>
  a.name.localeCompare(b.name),
);

interface Row {
  name: string;
  description: string;
  ok: boolean;
  problems: string[];
  ticks: number;
  status: string;
  ms: number;
}

const STATUS: Record<string, string> = { won: 'geschafft', dead: 'Tod', timeout: 'Zeit um', running: 'läuft' };

export function SelfTestScreen({ onBack }: { onBack(): void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [bench, setBench] = useState<number | null>(null);

  useEffect(() => {
    // kurz warten, damit der Bildschirm erst erscheint
    const id = setTimeout(() => {
      const out: Row[] = GOLDEN.map((g) => {
        const t0 = performance.now();
        const c = checkGolden(g);
        return {
          name: g.name,
          description: g.description ?? '',
          ok: c.ok,
          problems: c.problems,
          ticks: c.result.ticks,
          status: STATUS[c.result.status] ?? c.result.status,
          ms: performance.now() - t0,
        };
      });
      setRows(out);
      setBench(benchmark());
    }, 50);
    return () => clearTimeout(id);
  }, []);

  const failed = rows?.filter((r) => !r.ok).length ?? 0;

  return (
    <div class="screen list-screen">
      <header class="list-head">
        <button class="btn" onClick={onBack}>
          Zurück
        </button>
        <h1>Selbsttest</h1>
      </header>
      {!rows ? (
        <p>Spiele {GOLDEN.length} Golden Replays nach …</p>
      ) : (
        <>
          <p class={failed ? 'result bad' : 'result good'}>
            {failed
              ? `${failed} von ${rows.length} Golden Replays weichen ab. Dieses Gerät rechnet anders als erwartet.`
              : `Alle ${rows.length} Golden Replays stimmen bitgenau überein (Sim-Version ${SIM_VERSION}).`}
          </p>
          {bench !== null && (
            <p class="muted">
              Nachspielen eines 45-s-Laufs: {num(bench, 2)} ms auf diesem Gerät (Ziel auf dem Server: höchstens 2 ms).
            </p>
          )}
          <table class="table">
            <thead>
              <tr>
                <th>Replay</th>
                <th>Ergebnis</th>
                <th>Dauer</th>
                <th>Rechenzeit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td>
                    {r.name}
                    {r.description && <small>{r.description}</small>}
                  </td>
                  <td>{r.status}</td>
                  <td>{seconds(r.ticks)} s</td>
                  <td>{num(r.ms, 1)} ms</td>
                  <td class={r.ok ? 'good' : 'bad'}>{r.ok ? 'OK' : r.problems.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** Mittlere Rechenzeit für 45 s Simulation, gemessen am längsten Golden Replay. */
function benchmark(): number | null {
  const g = [...GOLDEN].sort((a, b) => b.ticks - a.ticks)[0];
  if (!g) return null;
  const d = fromJson(g.dungeon);
  const phys = clampPhysics(g.phys ?? {});
  let ticks = 0;
  const t0 = performance.now();
  for (let i = 0; i < 40; i++) ticks += verify(d, { phys, toggles: g.toggles, ticks: g.ticks }).ticks;
  const ms = performance.now() - t0;
  return (ms / ticks) * 45 * TICKS_PER_SECOND;
}

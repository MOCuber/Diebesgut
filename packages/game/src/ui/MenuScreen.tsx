import { DEFAULT_PHYSICS, SIM_VERSION, dungeonHash, type Dungeon, type Physics } from '@diebesgut/sim';
import { useEffect, useState } from 'preact/hooks';
import { seconds } from '../format';
import { allRecords, type Prefs, type RoomRecord } from '../storage';
import { isTuned } from '../tuning';

export interface Room {
  id: string;
  goal: string;
  dungeon: Dungeon;
}

interface Props {
  rooms: Room[];
  prefs: Prefs;
  tuning: Physics;
  onPrefs(p: Prefs): void;
  onResetTuning(): void;
  onPlay(room: number): void;
  onStats(): void;
  onSelfTest(): void;
}

export function MenuScreen({ rooms, prefs, tuning, onPrefs, onResetTuning, onPlay, onStats, onSelfTest }: Props) {
  const [records, setRecords] = useState<Map<string, RoomRecord>>(new Map());

  useEffect(() => {
    void allRecords().then((list) => setRecords(new Map(list.map((r) => [r.key, r]))));
  }, []);

  const physTuned = isTuned({ ...tuning, variableJump: DEFAULT_PHYSICS.variableJump });
  const fixedJump = !prefs.blind && tuning.variableJump === 0;

  return (
    <div class="screen menu">
      <header class="menu-head">
        <div>
          <h1>Diebesgut</h1>
          <p class="sub">Solo-Testversion · S0 „Laufgefühl“</p>
        </div>
        <button class="btn ghost" onClick={() => onPrefs({ ...prefs, sound: !prefs.sound })}>
          Ton {prefs.sound ? 'an' : 'aus'}
        </button>
      </header>

      {(physTuned || fixedJump || prefs.blind) && (
        <div class="notice">
          {prefs.blind && (
            <span>
              A/B-Blindtest läuft: <b>Variante {prefs.blind.current}</b>
              {prefs.blind.revealed ? ` (${prefs.blind.map[prefs.blind.current - 1] ? 'variabel' : 'fest'})` : ''}
            </span>
          )}
          {fixedJump && <span>Feste Sprunghöhe aktiv.</span>}
          {physTuned && <span>Tuning aktiv: Die Physik weicht vom Spielkonzept ab, Bestzeiten werden nicht gespeichert.</span>}
          {(physTuned || fixedJump) && (
            <button class="btn small" onClick={onResetTuning}>
              Physik zurücksetzen
            </button>
          )}
        </div>
      )}

      <div class="rooms">
        {rooms.map((room, i) => {
          const hash = dungeonHash(room.dungeon);
          const rec = records.get(hash);
          const fixed = records.get(`${hash}|fest`);
          return (
            <button class="room" key={room.id} onClick={() => onPlay(i)}>
              <span class="room-no">{i + 1}</span>
              <span class="room-body">
                <span class="room-name">{room.dungeon.name}</span>
                <span class="room-goal">{room.goal}</span>
                <span class="room-stats">
                  {rec?.bestTicks ? `Bestzeit ${seconds(rec.bestTicks)} s` : 'noch nicht geschafft'}
                  {fixed?.bestTicks ? ` · fest ${seconds(fixed.bestTicks)} s` : ''}
                  {rec || fixed ? ` · ${(rec?.attempts ?? 0) + (fixed?.attempts ?? 0)} Versuche` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <footer class="menu-foot">
        <button class="btn" onClick={onStats}>
          Statistik &amp; CSV
        </button>
        <button class="btn" onClick={onSelfTest}>
          Selbsttest
        </button>
        <span class="version">
          Version {__COMMIT__} · Sim {SIM_VERSION} · {__BUILD_DATE__}
        </span>
      </footer>
    </div>
  );
}

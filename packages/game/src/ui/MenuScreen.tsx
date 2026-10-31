import { DEFAULT_PHYSICS, SIM_VERSION, decode, dungeonHash, encode, type Dungeon, type Physics } from '@diebesgut/sim';
import { useEffect, useState } from 'preact/hooks';
import { Thumb } from '../editor/EditorScreen';
import { emptyState, toDungeon } from '../editor/model';
import { seconds } from '../format';
import {
  allRecords,
  deleteFortress,
  listFortresses,
  newFortressId,
  putFortress,
  recordId,
  type Fortress,
  type Prefs,
  type RoomRecord,
} from '../storage';
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
  onPlay(room: Room, fortress?: { id: string; hash: string }): void;
  onEdit(id: string): void;
  onStats(): void;
  onSelfTest(): void;
}

export function MenuScreen({ rooms, prefs, tuning, onPrefs, onResetTuning, onPlay, onEdit, onStats, onSelfTest }: Props) {
  const [records, setRecords] = useState<Map<string, RoomRecord>>(new Map());
  const [fortresses, setFortresses] = useState<Fortress[] | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    void allRecords().then((list) => setRecords(new Map(list.map((r) => [r.key, r]))));
    void listFortresses().then(setFortresses);
  }, []);

  const physTuned = isTuned({ ...tuning, variableJump: DEFAULT_PHYSICS.variableJump });
  const fixedJump = !prefs.blind && tuning.variableJump === 0;

  /** Neue Festung aus einer Vorlage; Gelände ist frei editierbar, Vorlagen dienen als Start. */
  const create = async (template: Dungeon | null) => {
    const d = template ? { ...template, name: `${template.name} (Kopie)` } : toDungeon(emptyState('Meine Festung')).d;
    const now = Date.now();
    const f: Fortress = { id: newFortressId(), name: d.name, mode: 'festung', draft: encode(d), created: now, updated: now, versions: [], deaths: [] };
    await putFortress(f);
    onEdit(f.id);
  };

  return (
    <div class="screen menu">
      <header class="menu-head">
        <div>
          <h1>Diebesgut</h1>
          <p class="sub">Solo-Testversion · S1 „Festungs-Editor“</p>
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

      <h2 class="menu-h2">Testräume</h2>
      <div class="rooms">
        {rooms.map((room, i) => {
          const hash = dungeonHash(room.dungeon);
          const rec = records.get(recordId(hash));
          const fixed = records.get(recordId(hash, true));
          return (
            <button class="room" key={room.id} onClick={() => onPlay(room)}>
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

      <div class="menu-row">
        <h2 class="menu-h2">Meine Festungen</h2>
        <button class="btn primary small" onClick={() => setChoosing(!choosing)}>
          + Neue Festung
        </button>
      </div>
      {choosing && (
        <div class="templates">
          <span class="muted">Vorlage:</span>
          <button class="btn small" onClick={() => void create(null)}>
            Leer
          </button>
          {rooms.map((r) => (
            <button key={r.id} class="btn small" onClick={() => void create(r.dungeon)}>
              {r.dungeon.name}
            </button>
          ))}
        </div>
      )}
      {fortresses && fortresses.length === 0 && !choosing && (
        <p class="muted">Noch keine eigene Festung. Baue eine, beweise sie mit einem eigenen Lauf, und ihr Par steht fest.</p>
      )}
      <div class="fortresses">
        {fortresses?.map((f) => {
          const latest = f.versions[f.versions.length - 1];
          const draftHash = dungeonHash(decode(f.draft));
          const proven = f.versions.some((v) => v.hash === draftHash);
          const rec = latest ? records.get(recordId(latest.hash)) : undefined;
          return (
            <div class="fortress" key={f.id}>
              <Thumb data={latest && proven ? latest.dungeon : f.draft} width={132} />
              <div class="fortress-body">
                <b>{f.name}</b>
                <small>
                  {latest ? `Par ${seconds(latest.par)} s` : 'noch nicht bewiesen'}
                  {latest && !proven ? ' · Entwurf geändert' : ''}
                  {rec?.bestTicks ? ` · Bestzeit ${seconds(rec.bestTicks)} s` : ''}
                </small>
                <div class="seg">
                  <button class="btn small" onClick={() => onEdit(f.id)}>
                    Bearbeiten
                  </button>
                  <button
                    class="btn small primary"
                    disabled={!latest}
                    title={latest ? 'Die zuletzt bewiesene Version spielen' : 'Erst im Editor beweisen'}
                    onClick={() => latest && onPlay({ id: f.id, goal: `Par ${seconds(latest.par)} s`, dungeon: decode(latest.dungeon) }, { id: f.id, hash: latest.hash })}
                  >
                    Spielen
                  </button>
                  {confirmDelete === f.id ? (
                    <button
                      class="btn small danger"
                      onClick={() =>
                        void deleteFortress(f.id).then(() => {
                          setConfirmDelete(null);
                          setFortresses(fortresses.filter((x) => x.id !== f.id));
                        })
                      }
                    >
                      Wirklich löschen
                    </button>
                  ) : (
                    <button class="btn small ghost" onClick={() => setConfirmDelete(f.id)}>
                      Löschen
                    </button>
                  )}
                </div>
              </div>
            </div>
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

import { TEST_ROOMS } from '@diebesgut/content';
import { DEFAULT_PHYSICS, clampPhysics, decode, fromJson, isDefaultPhysics, makeReplay, encodeReplay, verify, type Physics } from '@diebesgut/sim';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { EditorScreen } from './editor/EditorScreen';
import { Sfx } from './game/audio';
import type { WinInfo } from './game/session';
import { DEFAULT_PREFS, getFortress, loadSetting, saveSetting, updateFortress, type Prefs } from './storage';
import { blindLabel, effectivePhysics } from './tuning';
import { MenuScreen, type Room } from './ui/MenuScreen';
import { PlayScreen } from './ui/PlayScreen';
import { SelfTestScreen } from './ui/SelfTestScreen';
import { StartScreen } from './ui/StartScreen';
import { StatsScreen } from './ui/StatsScreen';

export const sfx = new Sfx();

type Screen =
  | { kind: 'start' }
  | { kind: 'menu' }
  | { kind: 'play'; room: Room; fortress?: { id: string; hash: string } }
  | { kind: 'editor'; id: string }
  | { kind: 'stats' }
  | { kind: 'selftest' };

/** Querformat erzwingen, wo das System es erlaubt (Android im Vollbild). */
async function goFullscreenLandscape(): Promise<void> {
  if (!matchMedia('(pointer: coarse)').matches) return;
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    const orientation = screen.orientation as unknown as { lock?: (o: string) => Promise<void> };
    await orientation.lock?.('landscape');
  } catch {
    // iPhone und Desktop: dann hilft der Hinweis „Bitte drehen“
  }
}

/** Jeder spätere schnellere Lauf des Erbauers senkt das Par, gemessen mit Standardphysik. */
async function lowerPar(id: string, hash: string, phys: Physics, info: WinInfo): Promise<void> {
  if (!isDefaultPhysics(phys)) return;
  const f = await getFortress(id);
  const v = f?.versions.find((x) => x.hash === hash);
  if (!f || !v || info.ticks >= v.par) return;
  const d = decode(v.dungeon);
  const result = verify(d, { phys, toggles: info.toggles, ticks: info.ticks });
  if (result.status !== 'won') return;
  const proof = encodeReplay(makeReplay(d, phys, info.toggles, result));
  await updateFortress(id, (fx) => {
    const vx = fx.versions.find((x) => x.hash === hash);
    if (vx && info.ticks < vx.par) {
      vx.par = info.ticks;
      vx.proof = proof;
    }
  });
}

export function App() {
  const [screenState, setScreen] = useState<Screen>({ kind: 'start' });
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [tuning, setTuningState] = useState<Physics>(DEFAULT_PHYSICS);
  const rooms = useMemo<Room[]>(() => TEST_ROOMS.map((r) => ({ id: r.id, goal: r.goal, dungeon: fromJson(r.json) })), []);

  useEffect(() => {
    void (async () => {
      const p = await loadSetting<Prefs>('prefs');
      if (p) setPrefsState({ ...DEFAULT_PREFS, ...p });
      const t = await loadSetting<Partial<Physics>>('tuning');
      if (t) setTuningState(clampPhysics(t));
    })();
  }, []);

  useEffect(() => {
    sfx.enabled = prefs.sound;
  }, [prefs.sound]);

  const setPrefs = (p: Prefs) => {
    setPrefsState(p);
    void saveSetting('prefs', p);
  };
  const setTuning = (t: Physics) => {
    setTuningState(t);
    void saveSetting('tuning', t);
  };
  const phys = effectivePhysics(tuning, prefs.blind);
  const toMenu = () => setScreen({ kind: 'menu' });

  let content;
  switch (screenState.kind) {
    case 'start':
      content = (
        <StartScreen
          onGo={() => {
            sfx.unlock();
            void goFullscreenLandscape();
            toMenu();
          }}
        />
      );
      break;
    case 'menu':
      content = (
        <MenuScreen
          rooms={rooms}
          prefs={prefs}
          tuning={tuning}
          onPrefs={setPrefs}
          onResetTuning={() => setTuning({ ...DEFAULT_PHYSICS })}
          onPlay={(room, fortress) => setScreen({ kind: 'play', room, fortress })}
          onEdit={(id) => setScreen({ kind: 'editor', id })}
          onStats={() => setScreen({ kind: 'stats' })}
          onSelfTest={() => setScreen({ kind: 'selftest' })}
        />
      );
      break;
    case 'play': {
      const fortress = screenState.fortress;
      content = (
        <PlayScreen
          key={screenState.room.id}
          room={screenState.room}
          phys={phys}
          blindLabel={blindLabel(prefs.blind)}
          tuning={tuning}
          prefs={prefs}
          onTuning={setTuning}
          onPrefs={setPrefs}
          onExit={toMenu}
          onWin={fortress ? (info) => void lowerPar(fortress.id, fortress.hash, phys, info) : undefined}
        />
      );
      break;
    }
    case 'editor':
      content = <EditorScreen fortressId={screenState.id} phys={phys} tuning={tuning} prefs={prefs} onTuning={setTuning} onPrefs={setPrefs} onExit={toMenu} />;
      break;
    case 'stats':
      content = <StatsScreen rooms={rooms} prefs={prefs} onPrefs={setPrefs} onBack={toMenu} />;
      break;
    case 'selftest':
      content = <SelfTestScreen onBack={toMenu} />;
      break;
  }

  return (
    <>
      {content}
      <div class="rotate-hint" role="alert">
        <div class="rotate-phone" aria-hidden="true" />
        <p>Bitte drehen</p>
        <small>Diebesgut wird im Querformat gespielt.</small>
      </div>
    </>
  );
}

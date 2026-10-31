import { TEST_ROOMS } from '@diebesgut/content';
import { DEFAULT_PHYSICS, clampPhysics, fromJson, type Physics } from '@diebesgut/sim';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Sfx } from './game/audio';
import { DEFAULT_PREFS, loadSetting, saveSetting, type Prefs } from './storage';
import { blindLabel, effectivePhysics } from './tuning';
import { MenuScreen, type Room } from './ui/MenuScreen';
import { PlayScreen } from './ui/PlayScreen';
import { SelfTestScreen } from './ui/SelfTestScreen';
import { StartScreen } from './ui/StartScreen';
import { StatsScreen } from './ui/StatsScreen';

export const sfx = new Sfx();

type Screen = { kind: 'start' } | { kind: 'menu' } | { kind: 'play'; room: number } | { kind: 'stats' } | { kind: 'selftest' };

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

  let content;
  switch (screenState.kind) {
    case 'start':
      content = (
        <StartScreen
          onGo={() => {
            sfx.unlock();
            void goFullscreenLandscape();
            setScreen({ kind: 'menu' });
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
          onPlay={(room) => setScreen({ kind: 'play', room })}
          onStats={() => setScreen({ kind: 'stats' })}
          onSelfTest={() => setScreen({ kind: 'selftest' })}
        />
      );
      break;
    case 'play':
      content = (
        <PlayScreen
          key={screenState.room}
          room={rooms[screenState.room]}
          phys={phys}
          blindLabel={blindLabel(prefs.blind)}
          tuning={tuning}
          prefs={prefs}
          onTuning={setTuning}
          onPrefs={setPrefs}
          onExit={() => setScreen({ kind: 'menu' })}
        />
      );
      break;
    case 'stats':
      content = <StatsScreen rooms={rooms} prefs={prefs} onPrefs={setPrefs} onBack={() => setScreen({ kind: 'menu' })} />;
      break;
    case 'selftest':
      content = <SelfTestScreen onBack={() => setScreen({ kind: 'menu' })} />;
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

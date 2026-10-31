import { GRID_H, GRID_W, type Physics } from '@diebesgut/sim';
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '../app';
import { Effects } from '../game/effects';
import { JumpInput } from '../game/input';
import { Renderer } from '../game/render';
import { Session, type EndInfo, type WinInfo } from '../game/session';
import { keyCount, seconds } from '../format';
import type { Prefs } from '../storage';
import { IconBack, IconHitbox, IconKey, IconRestart, IconTuning } from './icons';
import type { Room } from './MenuScreen';
import { TuningPanel } from './TuningPanel';

interface Props {
  room: Room;
  /** Physik für die Simulation (Tuning plus Blindtest-Variante) */
  phys: Physics;
  blindLabel: string;
  tuning: Physics;
  prefs: Prefs;
  onTuning(t: Physics): void;
  onPrefs(p: Prefs): void;
  onExit(): void;
  /** Test oder Beweislauf aus dem Editor: kein Neustart, das Ergebnis geht an onEnd */
  test?: { from?: { x: number; y: number; dir: 1 | -1 }; proof: boolean; onEnd(info: EndInfo): void };
  /** nach jedem geschafften Lauf (etwa um das Par der eigenen Festung zu senken) */
  onWin?(info: WinInfo): void;
}

const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
/** Breite einer Seitenleiste, wenn die Knöpfe neben dem Raster Platz haben */
const SIDE = 64;
/** Höhe der oberen Leiste, wenn nicht */
const TOP = 44;

export function PlayScreen({ room, phys, blindLabel, tuning, prefs, onTuning, onPrefs, onExit, test, onWin }: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const bestRef = useRef<HTMLSpanElement>(null);
  const sessionRef = useRef<Session | null>(null);
  const [keys, setKeys] = useState(0);
  const [side, setSide] = useState(false);
  const [win, setWin] = useState<WinInfo | null>(null);
  const [panel, setPanel] = useState(false);
  const winAt = useRef(0);

  // Sitzung, Eingabe und Größe
  useEffect(() => {
    const area = areaRef.current!;
    const canvas = canvasRef.current!;
    const renderer = new Renderer(canvas);
    const input = new JumpInput();
    input.onPress = () => sfx.unlock();
    const options = test ? { dungeon: room.dungeon, phys, blindLabel, from: test.from, autoRestart: false, record: test.proof } : { dungeon: room.dungeon, phys, blindLabel };
    const session = new Session(options, renderer, input, new Effects(), sfx, {
      hud(tick, k, best) {
        if (timeRef.current) timeRef.current.textContent = seconds(tick);
        if (bestRef.current) bestRef.current.textContent = best ? seconds(best) : '–';
        setKeys(k);
      },
      won(info) {
        winAt.current = performance.now();
        setWin(info);
        onWin?.(info);
      },
      ended(info) {
        test?.onEnd(info);
      },
    });
    session.hitboxes = prefs.hitboxes;
    sessionRef.current = session;

    const layout = () => {
      const W = area.clientWidth;
      const H = area.clientHeight;
      const sideTile = Math.floor(Math.min((W - 2 * SIDE) / GRID_W, H / GRID_H));
      const topTile = Math.floor(Math.min(W / GRID_W, (H - TOP) / GRID_H));
      const useSide = sideTile >= topTile;
      const tile = Math.max(8, useSide ? sideTile : topTile);
      const ox = Math.floor((W - tile * GRID_W) / 2);
      const oy = useSide ? Math.floor((H - tile * GRID_H) / 2) : TOP + Math.floor((H - TOP - tile * GRID_H) / 2);
      renderer.layout(W, H, tile, ox, oy, Math.min(window.devicePixelRatio || 1, 3));
      setSide(useSide);
    };
    const ro = new ResizeObserver(layout);
    ro.observe(area);
    layout();

    // Jede Berührung außerhalb der Knöpfe ist der Sprungfinger.
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest('button, .panel, .overlay')) return;
      e.preventDefault();
      input.pointerDown(e.pointerId);
    };
    const onUp = (e: PointerEvent) => input.pointerUp(e.pointerId);
    const onKeyDown = (e: KeyboardEvent) => {
      if (JUMP_KEYS.has(e.code)) {
        e.preventDefault();
        if (!e.repeat) input.keyDown();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (JUMP_KEYS.has(e.code)) input.keyUp();
    };
    const release = () => input.releaseAll();
    const onVisibility = () => {
      if (document.hidden) release();
    };
    area.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', onVisibility);
    session.start();
    return () => {
      session.stop();
      sessionRef.current = null;
      ro.disconnect();
      area.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // Die Sitzung gehört zum Raum; Physik und Anzeige-Optionen ändern sich unten ohne Neuaufbau.
  }, [room]);

  useEffect(() => {
    const s = sessionRef.current;
    if (s && !test && (JSON.stringify(s.phys) !== JSON.stringify(phys) || s.blindLabel !== blindLabel)) {
      setWin(null);
      s.setPhysics(phys, blindLabel);
    }
  }, [phys, blindLabel]);

  useEffect(() => {
    if (sessionRef.current) sessionRef.current.hitboxes = prefs.hitboxes;
  }, [prefs.hitboxes]);

  useEffect(() => {
    if (sessionRef.current) sessionRef.current.paused = panel;
  }, [panel]);

  const restart = () => {
    setWin(null);
    sessionRef.current?.restart();
  };
  const toggleHitboxes = () => onPrefs({ ...prefs, hitboxes: !prefs.hitboxes });

  // Tastenkürzel am PC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyR') restart();
      else if (e.code === 'KeyH') toggleHitboxes();
      else if (e.code === 'KeyT') setPanel((p) => !p);
      else if (e.code === 'Escape') {
        if (panel) setPanel(false);
        else onExit();
      } else if (win && JUMP_KEYS.has(e.code) && performance.now() - winAt.current > 400) restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div class={`play ${side ? 'side' : 'top'}`}>
      <div class="play-area" ref={areaRef}>
        <canvas ref={canvasRef} class="stage" />
        <div class="hud hud-a">
          <button class="icon-btn" onClick={onExit} aria-label={test ? 'Zurück zum Editor' : 'Zurück zum Menü'}>
            <IconBack />
          </button>
          <div class="hud-info">
            <span class="hud-name">{test ? (test.proof ? 'Beweislauf' : test.from ? 'Test ab hier' : 'Test') : room.dungeon.name}</span>
            <span class="hud-best">
              Best <span ref={bestRef}>–</span>
            </span>
          </div>
          <div class="hud-keys" aria-label={`${keyCount(keys)} von 3 Schlüsseln`}>
            <IconKey on={(keys & 1) !== 0} />
            <IconKey on={(keys & 2) !== 0} />
            <IconKey on={(keys & 4) !== 0} />
          </div>
          <span class="hud-time" ref={timeRef}>
            0,00
          </span>
          {blindLabel && <span class="hud-tag">{blindLabel}</span>}
        </div>
        <div class="hud hud-b">
          <button class={`icon-btn ${prefs.hitboxes ? 'active' : ''}`} onClick={toggleHitboxes} aria-label="Hitboxen anzeigen" aria-pressed={prefs.hitboxes}>
            <IconHitbox />
          </button>
          {!test?.proof && (
            <button class="icon-btn" onClick={() => setPanel(true)} aria-label="Tuning">
              <IconTuning />
            </button>
          )}
          <button class="icon-btn restart" onClick={restart} aria-label="Neustart">
            <IconRestart />
          </button>
        </div>

        {win && (
          <div
            class="overlay win"
            onPointerDown={(e) => {
              if ((e.target as Element).closest('button')) return;
              if (performance.now() - winAt.current > 400) restart();
            }}
          >
            <div class="win-card">
              <h2>Geschafft!</h2>
              <p class="win-time">{seconds(win.ticks)} s</p>
              {win.newBest ? (
                <p class="win-best new">Neue Bestzeit</p>
              ) : win.best ? (
                <p class="win-best">
                  Bestzeit {seconds(win.best)} s · {win.ticks > win.best ? '+' : ''}
                  {seconds(win.ticks - win.best)} s
                </p>
              ) : null}
              {!win.recorded && <p class="win-note">Mit Tuning werden keine Bestzeiten gespeichert.</p>}
              {win.determinismError && <p class="win-error">Determinismus-Fehler: {win.determinismError}</p>}
              <div class="win-actions">
                <button class="btn primary" onClick={restart}>
                  Nochmal
                </button>
                <button class="btn" onClick={onExit}>
                  Menü
                </button>
              </div>
              <p class="hint">Tippen startet den nächsten Lauf</p>
            </div>
          </div>
        )}

        {panel && (
          <TuningPanel
            tuning={tuning}
            blind={prefs.blind}
            onTuning={onTuning}
            onBlind={(blind) => onPrefs({ ...prefs, blind })}
            onClose={() => setPanel(false)}
          />
        )}
      </div>
    </div>
  );
}

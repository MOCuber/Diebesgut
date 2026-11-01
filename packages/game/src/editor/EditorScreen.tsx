import {
  DEFAULT_PHYSICS,
  ELEMENT_INFO,
  FORTRESS_RULES,
  countElements,
  createRun,
  decode,
  dungeonHash,
  encode,
  encodeReplay,
  footprint,
  makeReplay,
  validate,
  verify,
  type Dungeon,
  type ElementType,
  type Physics,
  type Problem,
  type Run,
  type Tile,
} from '@diebesgut/sim';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { vibrate } from '../game/audio';
import type { EndInfo } from '../game/session';
import { seconds } from '../format';
import { MAX_DEATHS, getFortress, updateFortress, type Fortress, type Prefs } from '../storage';
import { IconBack } from '../ui/icons';
import { PlayScreen } from '../ui/PlayScreen';
import { cycleLabel, cycleLevel } from './cycle';
import { History } from './history';
import {
  deleteElement,
  duplicateElement,
  elementAt,
  findElement,
  fromDungeon,
  isSolid,
  lineTiles,
  moveObject,
  objectAt,
  objectTile,
  paint,
  placeElement,
  rectTiles,
  rename,
  setParam,
  setStartDir,
  toDungeon,
  updateElement,
  type EdState,
  type ObjectRef,
} from './model';
import { EditorView, drawThumb, handlesFor, type HandleKind, type Overlay } from './view';

interface Props {
  fortressId: string;
  /** Physik für Testläufe (wie im Spiel); Beweisläufe rechnen immer mit der Standardphysik */
  phys: Physics;
  tuning: Physics;
  prefs: Prefs;
  onTuning(t: Physics): void;
  onPrefs(p: Prefs): void;
  onExit(): void;
}

type Tool =
  | { kind: 'select' }
  | { kind: 'brush' }
  | { kind: 'erase' }
  | { kind: 'rect' }
  | { kind: 'place'; type: ElementType }
  | { kind: 'object'; ref: ObjectRef }
  | { kind: 'testFrom' };

type Target = { kind: 'el'; uid: number } | { kind: 'obj'; ref: ObjectRef };
type Selection = Target | null;

type Gesture =
  | { kind: 'paint'; on: boolean; last: Tile; before: EdState }
  | { kind: 'rect'; a: Tile; b: Tile; fill: boolean }
  | { kind: 'tap'; start: { x: number; y: number }; moved: boolean }
  | { kind: 'press'; target: Target; start: { x: number; y: number }; armed: boolean; moved: boolean; timer: number; before: EdState }
  | { kind: 'handle'; uid: number; handle: HandleKind; before: EdState }
  | { kind: 'pan'; last: { x: number; y: number } };

/** Länge der Zeitleiste in Ticks (12 s) */
const TIMELINE = 720;
const LONG_PRESS_MS = 350;

const TOOL_NAMES: Record<string, string> = { select: 'Auswählen', brush: 'Pinsel', erase: 'Radierer', rect: 'Rechteck' };
const OBJECT_NAMES: Record<ObjectRef, string> = { start: 'Start', chest: 'Truhe', key0: 'Schlüssel 1', key1: 'Schlüssel 2', key2: 'Schlüssel 3' };

const sameTile = (a: Tile | null, b: Tile | null) => !!a && !!b && a.x === b.x && a.y === b.y;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Festungs-Editor: Raster links, Werkzeuge rechts, Zeitleiste unten (Solo-Testversion, S1). */
export function EditorScreen({ fortressId, phys, tuning, prefs, onTuning, onPrefs, onExit }: Props) {
  const [fortress, setFortress] = useState<Fortress | null>(null);
  const [ed, setEdState] = useState<EdState | null>(null);
  const [tool, setTool] = useState<Tool>({ kind: 'select' });
  const [sel, setSel] = useState<Selection>(null);
  const [playing, setPlaying] = useState(false);
  const [hitboxes, setHitboxes] = useState(false);
  const [showTrail, setShowTrail] = useState(true);
  const [showHeat, setShowHeat] = useState(false);
  const [popover, setPopover] = useState<'problems' | 'versions' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [testRun, setTestRun] = useState<{ proof: boolean; from?: { x: number; y: number; dir: 1 | -1 } } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, setVersion] = useState(0);

  const edRef = useRef<EdState | null>(null);
  const toolRef = useRef(tool);
  const selRef = useRef(sel);
  const history = useRef(new History());
  const tickRef = useRef(0);
  const playingRef = useRef(false);
  const gestureRef = useRef<Gesture | null>(null);
  const magRef = useRef<Overlay['magnifier']>(null);
  const hoverRef = useRef<Tile | null>(null);
  const lastTest = useRef<{ trail: number[]; death: { x: number; y: number } | null } | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const saveTimer = useRef(0);
  const toastTimer = useRef(0);
  toolRef.current = tool;
  selRef.current = sel;
  playingRef.current = playing;

  // ------------------------------------------------------------------ Laden und Speichern

  useEffect(() => {
    void getFortress(fortressId).then((f) => {
      if (!f) return;
      let s: EdState;
      try {
        s = fromDungeon(decode(f.draft));
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
        return;
      }
      setFortress(f);
      edRef.current = s;
      setEdState(s);
    });
  }, [fortressId]);

  const saveNow = () => {
    window.clearTimeout(saveTimer.current);
    const s = edRef.current;
    if (!s) return;
    const { d } = toDungeon(s);
    void updateFortress(fortressId, (f) => {
      f.draft = encode(d);
      f.name = s.name;
      f.updated = Date.now();
    });
  };

  useEffect(() => () => saveNow(), []);

  /** Entwürfe werden bei jeder Änderung automatisch gespeichert. */
  const setEd = (next: EdState) => {
    edRef.current = next;
    setEdState(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(saveNow, 400);
  };

  /** Eine Änderung als Befehl: rückgängig machbar. */
  const commit = (next: EdState, before: EdState | null = edRef.current) => {
    if (!before || next === before) return;
    history.current.push(before);
    setEd(next);
  };

  const keepSelection = (s: EdState) => {
    const cur = selRef.current;
    if (cur?.kind === 'el' && !findElement(s, cur.uid)) setSel(null);
  };

  const undo = () => {
    const cur = edRef.current;
    const prev = cur && history.current.undo(cur);
    if (prev) {
      setEd(prev);
      keepSelection(prev);
    }
  };

  const redo = () => {
    const cur = edRef.current;
    const next = cur && history.current.redo(cur);
    if (next) {
      setEd(next);
      keepSelection(next);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  // ------------------------------------------------------------------ abgeleitete Werte

  const derived = useMemo(() => {
    if (!ed) return null;
    const { d, ids } = toDungeon(ed);
    const problems = validate(d, FORTRESS_RULES);
    const run = createRun(d);
    return { d, ids, problems, hash: dungeonHash(d), run };
  }, [ed]);
  const derivedRef = useRef(derived);
  derivedRef.current = derived;

  const problemTiles = useMemo(() => {
    if (!derived) return [];
    const out: Tile[] = [];
    for (const p of derived.problems) {
      const el = p.el >= 0 ? derived.d.elements[p.el] : null;
      if (el) out.push({ x: el.x, y: el.y });
      else if (p.code === 'wall' || p.code === 'spacing' || p.code === 'bounds') out.push({ x: p.x, y: p.y });
    }
    return out;
  }, [derived]);
  const problemTilesRef = useRef(problemTiles);
  problemTilesRef.current = problemTiles;

  const version = fortress && derived ? fortress.versions.find((v) => v.hash === derived.hash) : undefined;
  const status = version ? `Bewiesen · Par ${seconds(version.par)} s` : fortress?.versions.length ? 'Geändert, Beweis nötig' : 'Entwurf, Beweis nötig';
  const fortressRef = useRef(fortress);
  fortressRef.current = fortress;
  const showHeatRef = useRef(showHeat);
  showHeatRef.current = showHeat;
  const showTrailRef = useRef(showTrail);
  showTrailRef.current = showTrail;
  const hitboxesRef = useRef(hitboxes);
  hitboxesRef.current = hitboxes;

  // ------------------------------------------------------------------ Zeichnen

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage || testRun) return;
    // Nach einem Testlauf ist die Zeichenfläche neu; Zoom und Ausschnitt bleiben erhalten.
    const old = viewRef.current;
    const view = old && old.canvas === canvas ? old : new EditorView(canvas);
    if (old && old !== view) view.setZoom(old.zoom, old.panX, old.panY);
    viewRef.current = view;
    const resize = () => view.resize(stage.clientWidth, stage.clientHeight, Math.min(window.devicePixelRatio || 1, 3));
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    resize();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      const dv = derivedRef.current;
      const s = edRef.current;
      if (playingRef.current) {
        acc += Math.min(now - last, 100);
        while (acc >= 1000 / 60) {
          tickRef.current = (tickRef.current + 1) % TIMELINE;
          acc -= 1000 / 60;
        }
        if (sliderRef.current) sliderRef.current.value = String(tickRef.current);
        if (timeRef.current) timeRef.current.textContent = seconds(tickRef.current);
      }
      last = now;
      if (dv && s) {
        const run: Run = dv.run;
        run.tick = tickRef.current;
        const cur = selRef.current;
        const selEl = cur?.kind === 'el' ? findElement(s, cur.uid) : undefined;
        const g = gestureRef.current;
        const tl = toolRef.current;
        const lt = lastTest.current;
        const overlay: Overlay = {
          selection: selEl ? { x: selEl.x, y: selEl.y } : cur?.kind === 'obj' ? objectTile(s, cur.ref) : null,
          handles: handlesFor(selEl),
          footprint: selEl ? footprint(selEl, dv.d) : [],
          problems: problemTilesRef.current,
          startZone: tl.kind === 'place' || !!selEl || (g?.kind === 'press' && g.armed),
          hitboxes: hitboxesRef.current,
          trail: showTrailRef.current && lt ? lt.trail : null,
          heat: showHeatRef.current ? (fortressRef.current?.deaths ?? null) : null,
          death: showTrailRef.current && lt ? lt.death : null,
          rect: g?.kind === 'rect' ? { a: g.a, b: g.b, fill: g.fill } : null,
          blocks: tl.kind === 'brush' || tl.kind === 'erase' || tl.kind === 'rect',
          magnifier: magRef.current,
          hover: hoverRef.current,
        };
        view.draw(dv.d, run, now, overlay);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [testRun, ed === null]);

  // ------------------------------------------------------------------ Eingabe auf dem Raster

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || testRun) return;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; zoom: number; mid: { x: number; y: number }; panX: number; panY: number } | null = null;
    let blocked = false;
    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const view = () => viewRef.current!;

    const targetAt = (s: EdState, t: Tile): Target | null => {
      const o = objectAt(s, t.x, t.y);
      if (o) return { kind: 'obj', ref: o };
      const e = elementAt(s, t.x, t.y);
      return e ? { kind: 'el', uid: e.uid } : null;
    };

    const moveTarget = (s: EdState, target: Target, t: Tile): EdState => {
      if (target.kind === 'obj') return moveObject(s, target.ref, t.x, t.y);
      return updateElement(s, target.uid, { x: t.x, y: t.y });
    };

    const applyHandle = (s: EdState, uid: number, kind: HandleKind, t: { x: number; y: number }): EdState => {
      const e = findElement(s, uid);
      if (!e) return s;
      const tx = Math.floor(t.x);
      const ty = Math.floor(t.y);
      const p = e.p.slice();
      if (kind === 'rail') {
        let dx = Math.max(-6, Math.min(6, tx - e.x));
        let dy = Math.max(-6, Math.min(6, ty - e.y));
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
        if (dx === 0 && dy === 0) return s;
        p[0] = dx;
        p[1] = dy;
      } else if (kind === 'gate') {
        const [gx, gy] = ELEMENT_INFO[e.type].params;
        p[0] = Math.max(gx.min, Math.min(gx.max, tx - e.x));
        p[1] = Math.max(gy.min, Math.min(gy.max, ty - 1 - e.y));
      } else if (kind === 'radius') {
        p[0] = Math.max(1, Math.min(3, Math.round(Math.hypot(t.x - (e.x + 0.5), t.y - (e.y + 0.5)))));
      } else {
        p[0] = Math.max(2, Math.min(4, Math.round(t.y - e.y)));
      }
      return updateElement(s, uid, { p });
    };

    const cancelGesture = () => {
      const g = gestureRef.current;
      if (g && (g.kind === 'paint' || g.kind === 'handle' || (g.kind === 'press' && g.armed))) setEd(g.before);
      if (g?.kind === 'press') window.clearTimeout(g.timer);
      gestureRef.current = null;
      magRef.current = null;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const s = edRef.current;
      if (!s) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // ohne Capture geht es auch, nur Ziehen über den Rand hinaus endet dann dort
      }
      const p = pos(e);
      pts.set(e.pointerId, p);
      if (pts.size === 2) {
        cancelGesture();
        const [a, b] = [...pts.values()];
        pinch = { dist: dist(a, b), zoom: view().zoom, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, panX: view().panX, panY: view().panY };
        return;
      }
      if (pts.size > 2 || blocked) return;
      const tile = view().toTile(p.x, p.y);
      const touch = e.pointerType !== 'mouse';
      magRef.current = touch && tile ? { px: p.x, py: p.y, tile } : null;
      const tl = toolRef.current;
      if (tl.kind === 'brush' || tl.kind === 'erase') {
        if (!tile) return;
        const on = tl.kind === 'brush';
        gestureRef.current = { kind: 'paint', on, last: tile, before: s };
        setEd(paint(s, [tile], on));
        return;
      }
      if (tl.kind === 'rect') {
        if (tile) gestureRef.current = { kind: 'rect', a: tile, b: tile, fill: !isSolid(s, tile.x, tile.y) };
        return;
      }
      if (tl.kind !== 'select') {
        gestureRef.current = { kind: 'tap', start: p, moved: false };
        return;
      }
      // Auswahl: zuerst die Griffe des ausgewählten Elements
      const cur = selRef.current;
      const selEl = cur?.kind === 'el' ? findElement(s, cur.uid) : undefined;
      const tf = view().toTileF(p.x, p.y);
      const handle = handlesFor(selEl).find((h) => Math.hypot(h.x - tf.x, h.y - tf.y) < 0.6);
      if (handle && selEl) {
        gestureRef.current = { kind: 'handle', uid: selEl.uid, handle: handle.kind, before: s };
        return;
      }
      const target = tile ? targetAt(s, tile) : null;
      if (target) {
        const g: Gesture = { kind: 'press', target, start: p, armed: !touch, moved: false, timer: 0, before: s };
        if (touch) {
          // Langes Drücken wählt aus und macht verschiebbar
          g.timer = window.setTimeout(() => {
            g.armed = true;
            setSel(target);
            vibrate(15);
          }, LONG_PRESS_MS);
        }
        gestureRef.current = g;
        return;
      }
      gestureRef.current = view().zoom > 1 && touch ? { kind: 'pan', last: p } : { kind: 'tap', start: p, moved: false };
    };

    const onMove = (e: PointerEvent) => {
      const p = pos(e);
      if (e.pointerType === 'mouse' && pts.size === 0) {
        const t = view().toTile(p.x, p.y);
        if (!sameTile(t, hoverRef.current)) hoverRef.current = t;
      }
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, p);
      if (pinch) {
        const [a, b] = [...pts.values()];
        if (!a || !b) return;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const v = view();
        v.setZoom(pinch.zoom, pinch.panX, pinch.panY);
        v.zoomAt(dist(a, b) / pinch.dist, pinch.mid.x, pinch.mid.y);
        v.pan(mid.x - pinch.mid.x, mid.y - pinch.mid.y);
        return;
      }
      const g = gestureRef.current;
      if (!g) return;
      const tile = view().toTile(p.x, p.y);
      if (magRef.current) magRef.current = tile ? { px: p.x, py: p.y, tile } : null;
      const s = edRef.current;
      if (!s) return;
      switch (g.kind) {
        case 'paint':
          if (tile && !sameTile(tile, g.last)) {
            setEd(paint(s, lineTiles(g.last, tile), g.on));
            g.last = tile;
          }
          break;
        case 'rect':
          if (tile) g.b = tile;
          break;
        case 'tap':
          if (dist(p, g.start) > 12) g.moved = true;
          break;
        case 'press':
          if (!g.armed) {
            if (dist(p, g.start) > 10) {
              window.clearTimeout(g.timer);
              gestureRef.current = view().zoom > 1 ? { kind: 'pan', last: p } : null;
              magRef.current = null;
            }
          } else if (tile) {
            const next = moveTarget(g.before, g.target, tile);
            if (next !== s) setEd(next);
            g.moved = g.moved || dist(p, g.start) > 6;
          }
          break;
        case 'handle':
          setEd(applyHandle(g.before, g.uid, g.handle, view().toTileF(p.x, p.y)));
          break;
        case 'pan':
          view().pan(p.x - g.last.x, p.y - g.last.y);
          g.last = p;
          break;
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pinch) {
        if (pts.size < 2) {
          pinch = null;
          blocked = pts.size > 0;
        }
        return;
      }
      if (pts.size === 0) blocked = false;
      const g = gestureRef.current;
      gestureRef.current = null;
      magRef.current = null;
      const s = edRef.current;
      if (!g || !s) return;
      const p = pos(e);
      const tile = view().toTile(p.x, p.y);
      const tl = toolRef.current;
      switch (g.kind) {
        case 'paint':
          if (s !== g.before) history.current.push(g.before);
          setVersion((v) => v + 1);
          break;
        case 'rect':
          commit(paint(s, rectTiles(g.a, g.b), g.fill));
          break;
        case 'handle':
          if (s !== g.before) {
            history.current.push(g.before);
            setVersion((v) => v + 1);
          }
          break;
        case 'press':
          window.clearTimeout(g.timer);
          if (g.armed && g.moved) {
            if (s !== g.before) history.current.push(g.before);
            setVersion((v) => v + 1);
          }
          setSel(g.target);
          break;
        case 'tap':
          if (g.moved || !tile) break;
          if (tl.kind === 'place') {
            const existing = targetAt(s, tile);
            if (existing) {
              setSel(existing);
              break;
            }
            const placed = placeElement(s, tl.type, tile.x, tile.y);
            commit(placed.state);
            setSel({ kind: 'el', uid: placed.uid });
          } else if (tl.kind === 'object') {
            // Pflichtobjekte gibt es nur einmal: danach zurück zum Auswählen
            commit(moveObject(s, tl.ref, tile.x, tile.y));
            setTool({ kind: 'select' });
            setSel({ kind: 'obj', ref: tl.ref });
          } else if (tl.kind === 'testFrom') {
            setTool({ kind: 'select' });
            startTest(false, { x: tile.x, y: tile.y, dir: s.start.dir });
          } else {
            setSel(targetAt(s, tile));
          }
          break;
      }
    };

    const onCancel = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      pinch = null;
      cancelGesture();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = { x: e.offsetX, y: e.offsetY };
      view().zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
    };

    const onLeave = () => {
      hoverRef.current = null;
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [testRun, ed === null]);

  // Tastenkürzel am PC
  useEffect(() => {
    if (testRun) return;
    const onKey = (e: KeyboardEvent) => {
      if (renaming || (e.target as Element).closest?.('input, textarea')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.code === 'KeyY') {
        e.preventDefault();
        redo();
      } else if ((e.code === 'Delete' || e.code === 'Backspace') && selRef.current?.kind === 'el') {
        const s = edRef.current;
        if (s) commit(deleteElement(s, selRef.current.uid));
        setSel(null);
      } else if (e.code === 'Escape') {
        if (popover) setPopover(null);
        else if (selRef.current) setSel(null);
        else setTool({ kind: 'select' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ------------------------------------------------------------------ Test und Beweis

  const testRunRef = useRef(testRun);
  testRunRef.current = testRun;

  const startTest = (proof: boolean, from?: { x: number; y: number; dir: 1 | -1 }) => {
    saveNow();
    setPlaying(false);
    setPopover(null);
    setTestRun({ proof, from });
  };

  const finishTest = async (info: EndInfo) => {
    const run = testRunRef.current;
    setTestRun(null);
    lastTest.current = { trail: info.trail, death: info.death };
    setShowTrail(true);
    if (info.death) {
      const death = info.death;
      const f = await updateFortress(fortressId, (fx) => {
        fx.deaths.push(death.x, death.y);
        if (fx.deaths.length > MAX_DEATHS * 2) fx.deaths.splice(0, fx.deaths.length - MAX_DEATHS * 2);
      });
      if (f) setFortress(f);
    }
    if (info.status !== 'won') {
      showToast(info.status === 'timeout' ? 'Zeit um: Ein Lauf endet nach 60 s' : run?.proof ? 'Beweis gescheitert, der Todesort ist markiert' : 'Tod, der Ort ist markiert');
      return;
    }
    if (!run?.proof) {
      showToast(run?.from ? `Geschafft in ${seconds(info.ticks)} s (zählt nicht als Beweis)` : `Geschafft in ${seconds(info.ticks)} s, jetzt beweisen?`);
      return;
    }
    await prove(info);
  };

  /** Beweislauf gelungen: Version mit Par speichern; schneller auf derselben Version senkt das Par. */
  const prove = async (info: EndInfo) => {
    const s = edRef.current;
    if (!s) return;
    const { d } = toDungeon(s);
    if (validate(d, FORTRESS_RULES).length > 0) {
      showToast('Der Dungeon verletzt Bauregeln und kann nicht bewiesen werden');
      return;
    }
    const result = verify(d, { phys: DEFAULT_PHYSICS, toggles: info.toggles, ticks: info.ticks });
    if (result.status !== 'won' || result.ticks !== info.ticks) {
      showToast(`Beweis ungültig: Nachspielen ergab ${result.status}`);
      return;
    }
    if (info.ticks > FORTRESS_RULES.maxPar) {
      showToast(`Zu lang: Par ${seconds(info.ticks)} s, erlaubt sind höchstens ${seconds(FORTRESS_RULES.maxPar, 0)} s`);
      return;
    }
    const hash = dungeonHash(d);
    const proof = encodeReplay(makeReplay(d, DEFAULT_PHYSICS, info.toggles, result));
    let message = `Bewiesen! Par ${seconds(info.ticks)} s`;
    const f = await updateFortress(fortressId, (fx) => {
      const v = fx.versions.find((x) => x.hash === hash);
      if (!v) {
        fx.versions.push({ hash, date: Date.now(), par: info.ticks, dungeon: encode(d), proof });
      } else if (info.ticks < v.par) {
        message = `Neues Par: ${seconds(info.ticks)} s (vorher ${seconds(v.par)} s)`;
        v.par = info.ticks;
        v.proof = proof;
      } else {
        message = `Geschafft in ${seconds(info.ticks)} s, das Par bleibt ${seconds(v.par)} s`;
      }
    });
    if (f) setFortress(f);
    showToast(message);
  };

  const testRoom = useMemo(() => (testRun && derived ? { id: 'test', goal: '', dungeon: derived.d } : null), [testRun]);

  // ------------------------------------------------------------------ Darstellung

  if (loadError) {
    return (
      <div class="screen list-screen">
        <p>Diese Festung lässt sich nicht öffnen: {loadError}. Festungen aus dem alten Raster (22 × 12 Felder) müssen neu gebaut werden.</p>
        <button class="btn" onClick={onExit}>
          Zurück zum Menü
        </button>
      </div>
    );
  }
  if (!ed || !derived || !fortress) return <div class="screen list-screen">Lade Festung …</div>;

  if (testRun && testRoom) {
    return (
      <PlayScreen
        room={testRoom}
        phys={testRun.proof ? DEFAULT_PHYSICS : phys}
        blindLabel=""
        tuning={tuning}
        prefs={prefs}
        onTuning={onTuning}
        onPrefs={onPrefs}
        onExit={() => setTestRun(null)}
        test={{ from: testRun.from, proof: testRun.proof, onEnd: (info) => void finishTest(info) }}
      />
    );
  }

  const counts = countElements(ed);
  const selEl = sel?.kind === 'el' ? findElement(ed, sel.uid) : undefined;
  const selTool = (t: Tool) => {
    setTool(t);
    if (t.kind !== 'select') setSel(null);
  };
  const isTool = (k: string, extra?: string | number) =>
    tool.kind === k && (extra === undefined || (tool.kind === 'place' && tool.type === extra) || (tool.kind === 'object' && tool.ref === extra));

  const jumpTo = (p: Problem) => {
    setPopover(null);
    const el = p.el >= 0 ? derived.d.elements[p.el] : null;
    if (el) {
      setSel({ kind: 'el', uid: derived.ids[p.el] });
      viewRef.current?.focus({ x: el.x, y: el.y });
    } else if (p.code === 'wall' || p.code === 'spacing' || p.code === 'bounds') {
      const ref = objectAt(ed, p.x, p.y);
      if (ref) setSel({ kind: 'obj', ref });
      viewRef.current?.focus({ x: p.x, y: p.y });
    }
  };

  return (
    <div class="editor">
      <header class="ed-top">
        <button class="icon-btn" onClick={onExit} aria-label="Zurück zum Menü">
          <IconBack />
        </button>
        {renaming ? (
          <input
            class="ed-name-input"
            value={ed.name}
            maxLength={40}
            autoFocus
            onBlur={(e) => {
              setRenaming(false);
              const name = (e.target as HTMLInputElement).value.trim() || ed.name;
              if (name !== ed.name) commit(rename(ed, name));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <button class="ed-name" onClick={() => setRenaming(true)} title="Umbenennen">
            {ed.name}
          </button>
        )}
        <span
          class={`chip ${counts.traps === FORTRESS_RULES.traps ? 'good' : counts.traps > FORTRESS_RULES.traps ? 'bad' : 'warn'}`}
          title={`Genau ${FORTRESS_RULES.traps} tödliche Fallen`}
        >
          Fallen {counts.traps}/{FORTRESS_RULES.traps}
        </span>
        <span
          class={`chip ${counts.helpers > FORTRESS_RULES.maxHelpers ? 'bad' : ''}`}
          title={`Höchstens ${FORTRESS_RULES.maxHelpers} Hilfsmittel, sie zählen nicht als Fallen`}
        >
          Hilfen {counts.helpers}/{FORTRESS_RULES.maxHelpers}
        </span>
        <span class={`chip ${version ? 'good' : 'warn'}`}>{status}</span>
        {derived.problems.length > 0 && (
          <button class="chip bad clickable" onClick={() => setPopover(popover === 'problems' ? null : 'problems')}>
            {derived.problems.length} {derived.problems.length === 1 ? 'Problem' : 'Probleme'}
          </button>
        )}
        <span class="spacer" />
        <button class="btn small" disabled={!history.current.canUndo} onClick={undo} title="Rückgängig (Strg+Z)">
          ↶
        </button>
        <button class="btn small" disabled={!history.current.canRedo} onClick={redo} title="Wiederholen (Strg+Y)">
          ↷
        </button>
        <button class="btn small" onClick={() => startTest(false)}>
          Testen
        </button>
        <button class="btn small primary" disabled={derived.problems.length > 0} onClick={() => startTest(true)} title={derived.problems.length ? 'Erst alle Probleme lösen' : 'Ein Lauf, der zählt'}>
          Beweisen
        </button>
      </header>

      <div class="ed-main">
        <div class="ed-stage" ref={stageRef}>
          <canvas ref={canvasRef} class="ed-canvas" />
        </div>

        <aside class="ed-side">
          {selEl ? (
            <ElementProps
              el={selEl}
              onParam={(i, v) => commit(setParam(ed, selEl.uid, i, v))}
              onDuplicate={() => {
                const r = duplicateElement(ed, selEl.uid);
                if (!r) return showToast('Kein freier Platz daneben');
                commit(r.state);
                setSel({ kind: 'el', uid: r.uid });
              }}
              onDelete={() => {
                commit(deleteElement(ed, selEl.uid));
                setSel(null);
              }}
              onDone={() => setSel(null)}
            />
          ) : sel?.kind === 'obj' ? (
            <div class="ed-props">
              <h3>{OBJECT_NAMES[sel.ref]}</h3>
              {sel.ref === 'start' ? (
                <>
                  <span class="ed-label">Blickrichtung</span>
                  <div class="seg">
                    <button class={`btn small ${ed.start.dir === -1 ? 'primary' : ''}`} onClick={() => commit(setStartDir(ed, -1))}>
                      ← links
                    </button>
                    <button class={`btn small ${ed.start.dir === 1 ? 'primary' : ''}`} onClick={() => commit(setStartDir(ed, 1))}>
                      rechts →
                    </button>
                  </div>
                </>
              ) : null}
              <p class="ed-hint">Pflichtobjekte sind immer da und werden nur verschoben: lange drücken und ziehen, am PC einfach ziehen.</p>
              <button class="btn small" onClick={() => setSel(null)}>
                Fertig
              </button>
            </div>
          ) : (
            <Palette tool={tool} isTool={isTool} onTool={selTool} counts={counts} />
          )}
        </aside>
      </div>

      <footer class="ed-bottom">
        <button class="icon-btn small" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Anhalten' : 'Abspielen'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <div class="ed-timeline">
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={TIMELINE - 1}
            defaultValue="0"
            onInput={(e) => {
              tickRef.current = Number((e.target as HTMLInputElement).value);
              if (timeRef.current) timeRef.current.textContent = seconds(tickRef.current);
            }}
          />
          {selEl && <CycleStrip el={selEl} d={derived.d} />}
        </div>
        <span class="ed-time">
          <span ref={timeRef}>0,00</span> s
        </span>
        <button class={`btn small ${hitboxes ? 'primary' : ''}`} onClick={() => setHitboxes(!hitboxes)}>
          Hitboxen
        </button>
        <button class={`btn small ${showTrail && lastTest.current ? 'primary' : ''}`} onClick={() => setShowTrail(!showTrail)} disabled={!lastTest.current}>
          Spur
        </button>
        <button class={`btn small ${showHeat ? 'primary' : ''}`} onClick={() => setShowHeat(!showHeat)} title={`${fortress.deaths.length / 2} Tode`}>
          Heatmap
        </button>
        <button class="btn small" onClick={() => setPopover(popover === 'versions' ? null : 'versions')}>
          Versionen {fortress.versions.length > 0 ? `(${fortress.versions.length})` : ''}
        </button>
      </footer>

      {popover === 'problems' && (
        <div class="ed-popover" role="dialog" aria-label="Probleme">
          <div class="ed-popover-head">
            <h3>Bauregeln</h3>
            <button class="btn small" onClick={() => setPopover(null)}>
              Schließen
            </button>
          </div>
          <ul class="ed-problems">
            {derived.problems.map((p, i) => (
              <li key={i}>
                <button onClick={() => jumpTo(p)}>{p.msg}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {popover === 'versions' && (
        <div class="ed-popover" role="dialog" aria-label="Versionen">
          <div class="ed-popover-head">
            <h3>Bewiesene Versionen</h3>
            <button class="btn small" onClick={() => setPopover(null)}>
              Schließen
            </button>
          </div>
          {fortress.versions.length === 0 ? (
            <p class="ed-hint">Noch keine. „Beweisen“ startet einen Lauf, der zählt; gelingt er, wird die Version mit ihrem Par gespeichert.</p>
          ) : (
            <ul class="ed-versions">
              {[...fortress.versions].reverse().map((v) => (
                <li key={v.hash} class={v.hash === derived.hash ? 'current' : ''}>
                  <Thumb data={v.dungeon} />
                  <div>
                    <b>Par {seconds(v.par)} s</b>
                    <small>{new Date(v.date).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</small>
                  </div>
                  {v.hash === derived.hash ? (
                    <span class="chip good">aktuell</span>
                  ) : (
                    <button
                      class="btn small"
                      onClick={() => {
                        commit({ ...fromDungeon(decode(v.dungeon)), name: ed.name });
                        setSel(null);
                        setPopover(null);
                      }}
                    >
                      Wiederherstellen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {fortress.deaths.length > 0 && (
            <button
              class="btn small"
              onClick={() =>
                void updateFortress(fortressId, (f) => {
                  f.deaths = [];
                }).then((f) => f && setFortress(f))
              }
            >
              Heatmap leeren
            </button>
          )}
        </div>
      )}

      {toast && (
        <div class="ed-toast" role="status" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Teile

function Palette(props: { tool: Tool; isTool(k: string, extra?: string | number): boolean; onTool(t: Tool): void; counts: { traps: number; helpers: number } }) {
  const { tool, isTool, onTool, counts } = props;
  const elementButton = (info: (typeof ELEMENT_INFO)[number]) => (
    <button key={info.type} class={`ed-tool el ${isTool('place', info.type) ? 'active' : ''}`} onClick={() => onTool({ kind: 'place', type: info.type })} title={info.desc}>
      <span>{info.name}</span>
    </button>
  );
  return (
    <div class="ed-palette">
      <span class="ed-label">Gelände in 2 × 2-Blöcken</span>
      <div class="ed-grid">
        {(['select', 'brush', 'erase', 'rect'] as const).map((k) => (
          <button key={k} class={`ed-tool ${isTool(k) ? 'active' : ''}`} onClick={() => onTool({ kind: k })}>
            {TOOL_NAMES[k]}
          </button>
        ))}
      </div>
      <span class="ed-label">Pflicht</span>
      <div class="ed-grid five">
        {(['start', 'chest', 'key0', 'key1', 'key2'] as const).map((r) => (
          <button key={r} class={`ed-tool ${isTool('object', r) ? 'active' : ''}`} onClick={() => onTool({ kind: 'object', ref: r })} title={OBJECT_NAMES[r]}>
            {r === 'start' ? 'Start' : r === 'chest' ? 'Truhe' : `S${Number(r[3]) + 1}`}
          </button>
        ))}
      </div>
      <span class="ed-label">
        Fallen · genau {FORTRESS_RULES.traps} <b class={counts.traps === FORTRESS_RULES.traps ? 'ok' : 'off'}>{counts.traps}</b>
      </span>
      <div class="ed-grid">{ELEMENT_INFO.filter((info) => info.trap).map(elementButton)}</div>
      <span class="ed-label">
        Hilfsmittel · bis {FORTRESS_RULES.maxHelpers} <b class={counts.helpers > FORTRESS_RULES.maxHelpers ? 'off' : 'ok'}>{counts.helpers}</b>
      </span>
      <div class="ed-grid">{ELEMENT_INFO.filter((info) => !info.trap).map(elementButton)}</div>
      <button class={`ed-tool wide ${isTool('testFrom') ? 'active' : ''}`} onClick={() => onTool({ kind: 'testFrom' })}>
        Test ab hier …
      </button>
      <p class="ed-hint">
        {tool.kind === 'testFrom'
          ? 'Tippe die Stelle an, an der der Dieb starten soll. Zählt nie als Beweis.'
          : tool.kind === 'place'
            ? 'Ins Raster tippen setzt das Element.'
            : tool.kind === 'object'
              ? 'Ins Raster tippen verschiebt das Objekt.'
              : tool.kind === 'select'
                ? 'Tippen wählt aus, lange drücken verschiebt. Zwei Finger zoomen.'
                : 'Ziehen malt ganze 2 × 2-Blöcke; jeder Strich ist ein Schritt zum Rückgängigmachen.'}
      </p>
    </div>
  );
}

function ElementProps(props: {
  el: { type: ElementType; p: number[] };
  onParam(i: number, v: number): void;
  onDuplicate(): void;
  onDelete(): void;
  onDone(): void;
}) {
  const info = ELEMENT_INFO[props.el.type];
  return (
    <div class="ed-props">
      <h3>
        {info.name} <span class="chip">{info.trap ? 'Falle' : 'Hilfsmittel'}</span>
      </h3>
      <p class="ed-hint">{info.desc}</p>
      {info.params.map((spec, i) => {
        const v = props.el.p[i];
        const label = spec.labels ? spec.labels[v - spec.min] : String(v);
        return (
          <div class="ed-param" key={spec.key}>
            <span class="ed-label">{spec.name}</span>
            <div class="ed-stepper">
              <button class="step" disabled={v <= spec.min} onClick={() => props.onParam(i, v - 1)} aria-label={`${spec.name} verringern`}>
                −
              </button>
              <span>{label}</span>
              <button class="step" disabled={v >= spec.max} onClick={() => props.onParam(i, v + 1)} aria-label={`${spec.name} erhöhen`}>
                +
              </button>
            </div>
          </div>
        );
      })}
      {cycleLabel({ type: props.el.type, x: 0, y: 0, p: props.el.p }) && <p class="ed-hint">Zyklus „{cycleLabel({ type: props.el.type, x: 0, y: 0, p: props.el.p })}“ als Streifen unter der Zeitleiste.</p>}
      <div class="seg">
        <button class="btn small" onClick={props.onDuplicate}>
          Duplizieren
        </button>
        <button class="btn small danger" onClick={props.onDelete}>
          Löschen
        </button>
        <button class="btn small" onClick={props.onDone}>
          Fertig
        </button>
      </div>
    </div>
  );
}

/** Zyklus des ausgewählten Elements als Streifen, etwa an/aus oder hin/her. */
function CycleStrip({ el, d }: { el: { type: ElementType; x: number; y: number; p: number[] }; d: Dungeon }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = c.clientWidth || 200;
    c.width = w;
    c.height = 8;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, 8);
    for (let x = 0; x < w; x++) {
      const level = cycleLevel(el, d, Math.floor((x / w) * TIMELINE));
      if (level === null) continue;
      ctx.fillStyle = `rgba(255, 208, 77, ${0.15 + 0.85 * level})`;
      ctx.fillRect(x, 0, 1, 8);
    }
  }, [el, d]);
  return <canvas ref={ref} class="ed-strip" />;
}

export function Thumb({ data, width = 110 }: { data: Uint8Array; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      drawThumb(ref.current, decode(data), width);
    } catch {
      // altes Format: kein Vorschaubild
    }
  }, [data, width]);
  return <canvas ref={ref} class="ed-thumb" />;
}

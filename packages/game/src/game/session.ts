import {
  ELEMENT_INFO,
  cloneRun,
  createRun,
  dungeonHash,
  encodeReplay,
  isDefaultPhysics,
  makeReplay,
  stateHash,
  step,
  verify,
  Recorder,
  DEFAULT_PHYSICS,
  type Dungeon,
  type Physics,
  type Run,
  type RunStatus,
} from '@diebesgut/sim';
import { addRun, getRecord, putRecord, recordId, type RoomRecord, type RunLog } from '../storage';
import { vibrate, type Sfx } from './audio';
import type { Effects } from './effects';
import type { JumpInput } from './input';
import { COLORS, type Renderer } from './render';

/** Die Simulation läuft fest mit 60 Ticks pro Sekunde, die Grafik so schnell wie das Display. */
const DT = 1000 / 60;
/** Nach dem Tod läuft 0,25 s ein Effekt, dann startet der nächste Lauf; Tippen überspringt ihn. */
export const DEATH_MS = 250;

export interface WinInfo {
  ticks: number;
  best: number;
  newBest: boolean;
  /** null = Nachspielen ergab denselben End-Hash */
  determinismError: string | null;
  /** Bestzeiten werden nur mit Standardphysik gespeichert */
  recorded: boolean;
  /** Eingaben des Laufs (Fingerwechsel), etwa um das Par einer Festung zu senken */
  toggles: number[];
}

/** Ergebnis eines Laufs ohne automatischen Neustart (Test und Beweis im Editor). */
export interface EndInfo {
  status: RunStatus;
  ticks: number;
  /** Mitte des Diebs beim Tod in SE, sonst null */
  death: { x: number; y: number } | null;
  /** Weg des Diebs: x, y in SE, abwechselnd, jeder zweite Tick */
  trail: number[];
  toggles: number[];
  phys: Physics;
}

export interface SessionOptions {
  dungeon: Dungeon;
  phys: Physics;
  /** '' oder 'V1'/'V2' im Blindtest */
  blindLabel: string;
  /** „Test ab hier“: anderer Startpunkt, zählt nie als Beweis */
  from?: { x: number; y: number; dir: 1 | -1 };
  /** false: nach Tod oder Sieg kein neuer Lauf, sondern hooks.ended (Standard true) */
  autoRestart?: boolean;
  /** Läufe in Statistik und Rekorde schreiben (Standard true) */
  record?: boolean;
}

export interface SessionHooks {
  /** Zeit und Schlüssel für die Leiste; wird bei jeder Änderung aufgerufen */
  hud(tick: number, keys: number, best: number): void;
  won(info: WinInfo): void;
  ended?(info: EndInfo): void;
}

/** So lange zeigt ein Test noch die offene Truhe, bevor es zurück in den Editor geht. */
const TEST_WIN_MS = 700;

type State = 'play' | 'dying' | 'won';

/** Sammelt die Ergebnisse nach der Physik getrennt: Standard, feste Sprunghöhe oder gar nicht. */
export function recordKey(hash: string, phys: Physics): string | null {
  if (isDefaultPhysics(phys)) return recordId(hash);
  if (isDefaultPhysics({ ...phys, variableJump: DEFAULT_PHYSICS.variableJump })) return recordId(hash, true);
  return null;
}

export class Session {
  readonly d: Dungeon;
  readonly hash: string;
  phys: Physics;
  run: Run;
  prev: Run;
  state: State = 'play';
  paused = false;
  hitboxes = false;
  best = 0;

  private rec = new Recorder();
  private acc = 0;
  private last = 0;
  private raf = 0;
  private stateSince = 0;
  private attempt = 0;
  private endedAt = -1;
  private startedAt = 0;
  private hudTick = -1;
  private hudKeys = -1;
  private trail: number[] = [];
  private endedSent = false;

  constructor(
    private readonly opts: SessionOptions,
    private readonly renderer: Renderer,
    private readonly input: JumpInput,
    private readonly fx: Effects,
    private readonly sfx: Sfx,
    private readonly hooks: SessionHooks,
  ) {
    this.d = opts.dungeon;
    this.hash = dungeonHash(this.d);
    this.phys = opts.phys;
    this.run = createRun(this.d, this.phys, opts.from);
    this.prev = cloneRun(this.run);
    this.newRun();
    void this.loadBest();
  }

  get blindLabel(): string {
    return this.opts.blindLabel;
  }

  private async loadBest(): Promise<void> {
    const key = recordKey(this.hash, this.phys);
    const rec = key ? await getRecord(key) : undefined;
    this.best = rec?.bestTicks ?? 0;
    this.hudTick = -1;
  }

  start(): void {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    if (this.state === 'play' && this.run.tick > 0) this.log('abort');
  }

  private get recording(): boolean {
    return this.opts.record !== false;
  }

  private sendEnded(): void {
    if (this.endedSent) return;
    this.endedSent = true;
    const th = this.run.thief;
    this.hooks.ended?.({
      status: this.run.status,
      ticks: this.run.tick,
      death: this.run.status === 'dead' ? { x: th.x + (this.phys.thiefW >> 1), y: th.y + (this.phys.thiefH >> 1) } : null,
      trail: this.trail,
      toggles: this.rec.toggles.slice(),
      phys: this.phys,
    });
  }

  /** Neustart über die Schaltfläche oder nach dem Ergebnis. */
  restart(): void {
    if (this.state === 'play' && this.run.tick > 0) this.log('abort');
    this.endedAt = performance.now();
    this.newRun();
  }

  setPhysics(phys: Physics, blindLabel: string): void {
    this.phys = phys;
    this.opts.blindLabel = blindLabel;
    void this.loadBest();
    this.restart();
  }

  private newRun(): void {
    this.run = createRun(this.d, this.phys, this.opts.from);
    this.prev = cloneRun(this.run);
    this.rec = new Recorder();
    this.trail = [this.run.thief.x + (this.phys.thiefW >> 1), this.run.thief.y + (this.phys.thiefH >> 1)];
    this.endedSent = false;
    this.state = 'play';
    this.acc = 0;
    this.attempt++;
    this.startedAt = performance.now();
    this.input.resetForNewRun();
    this.fx.clear();
    this.pushHud();
  }

  private pushHud(): void {
    if (this.run.tick === this.hudTick && this.run.keys === this.hudKeys) return;
    this.hudTick = this.run.tick;
    this.hudKeys = this.run.keys;
    this.hooks.hud(this.run.tick, this.run.keys, this.best);
  }

  private readonly frame = (now: number): void => {
    const elapsed = Math.min(now - this.last, 250); // nach Pausen nicht nachholen
    this.last = now;
    if (!this.paused) {
      if (this.state === 'play') {
        this.acc += elapsed;
        while (this.acc >= DT && this.state === 'play') {
          this.tick(now);
          this.acc -= DT;
        }
      } else if (this.state === 'dying') {
        if (this.input.takePress() || now - this.stateSince >= DEATH_MS) {
          this.endedAt = this.stateSince;
          if (this.opts.autoRestart === false) this.sendEnded();
          else this.newRun();
        }
      } else if (this.state === 'won' && this.opts.autoRestart === false && now - this.stateSince >= TEST_WIN_MS) {
        this.sendEnded();
      }
      this.fx.update(elapsed);
    }
    this.renderer.draw({
      d: this.d,
      prev: this.prev,
      cur: this.run,
      alpha: this.state === 'play' ? this.acc / DT : 1,
      time: now,
      fx: this.fx,
      hitboxes: this.hitboxes,
      dying: this.state === 'dying' ? Math.min(1, (now - this.stateSince) / DEATH_MS) : -1,
      won: this.state === 'won',
    });
    this.pushHud();
    this.raf = requestAnimationFrame(this.frame);
  };

  private tick(now: number): void {
    this.prev = cloneRun(this.run);
    const input = this.input.consumeTick(); // held + pressed für genau diesen Tick
    step(this.d, this.run, input);
    this.rec.add(this.run.tick, input);
    if ((this.run.tick & 1) === 0) this.trail.push(this.run.thief.x + (this.phys.thiefW >> 1), this.run.thief.y + (this.phys.thiefH >> 1));
    this.events(this.prev, this.run);
    if (this.run.status !== 'running') this.end(now);
  }

  /** Ton, Partikel und Haptik aus dem Unterschied zweier Ticks. */
  private events(a: Run, b: Run): void {
    const ta = a.thief;
    const tb = b.thief;
    const feetX = tb.x + (this.phys.thiefW >> 1);
    const feetY = tb.y + this.phys.thiefH;
    if (tb.jumpTick === b.tick) {
      if (ta.wall !== 0) {
        this.sfx.wallJump();
        this.fx.dust(ta.wall > 0 ? tb.x + this.phys.thiefW : tb.x, tb.y + 120, 5, -ta.wall * 2);
      } else {
        this.sfx.jump();
        this.fx.dust(feetX, feetY, 5);
      }
    }
    if (!ta.ground && tb.ground && ta.vy < -30) {
      this.fx.dust(feetX, feetY, 6);
      this.sfx.land();
    }
    if (b.keys !== a.keys) {
      const i = Math.log2(b.keys ^ a.keys);
      const k = this.d.keys[i];
      this.fx.burst((k.x << 8) + 128, (k.y << 8) + 128, 18, [COLORS.gold, '#fff3b0'], 7, 26, 500, 0.15);
      this.sfx.key();
      vibrate(15);
    }
  }

  private end(now: number): void {
    const run = this.run;
    const th = run.thief;
    this.stateSince = now;
    this.input.takePress();
    if (run.status === 'won') {
      this.state = 'won';
      this.sfx.win();
      vibrate(40);
      this.fx.burst((this.d.chest.x << 8) + 128, (this.d.chest.y << 8) + 128, 40, [COLORS.gold, '#fff3b0', '#ffffff'], 12, 30, 900, 0.25);
      this.log('won');
      if (this.opts.autoRestart !== false) void this.finishWin();
      return;
    }
    this.state = 'dying';
    this.sfx.death();
    vibrate(run.status === 'dead' ? 45 : 20);
    this.fx.burst(th.x + 76, th.y + 116, 26, [COLORS.cloak, COLORS.scarf, COLORS.skin, '#ffffff'], 10, 30, 450);
    this.log(run.status);
  }

  /** Nach jedem geschafften Lauf das Replay nachspielen und den End-Hash vergleichen. */
  private async finishWin(): Promise<void> {
    const run = this.run;
    const result = verify(this.d, { phys: this.phys, toggles: this.rec.toggles, ticks: run.tick });
    const determinismError =
      result.status !== 'won' || result.finalHash !== stateHash(run)
        ? `Nachspielen ergab ${result.status} nach ${result.ticks} Ticks (Hash ${result.finalHash.toString(16)} statt ${stateHash(run).toString(16)})`
        : null;
    if (determinismError) console.error('Determinismus-Fehler:', determinismError);

    const key = recordKey(this.hash, this.phys);
    let newBest = false;
    if (key && !determinismError) {
      const replay = encodeReplay(makeReplay(this.d, this.phys, this.rec.toggles, result));
      await this.updateRecord(key, (rec) => {
        if (rec.bestTicks === 0 || run.tick < rec.bestTicks) {
          newBest = true;
          rec.bestTicks = run.tick;
          rec.bestReplay = replay;
        }
        rec.wins++;
        this.best = rec.bestTicks;
      });
    }
    this.hooks.won({ ticks: run.tick, best: this.best, newBest, determinismError, recorded: key !== null, toggles: this.rec.toggles.slice() });
  }

  private recordQueue: Promise<void> = Promise.resolve();

  /** Änderungen am Rekord nacheinander ausführen, damit keine verloren geht. */
  private updateRecord(key: string, change: (rec: RoomRecord) => void): Promise<void> {
    this.recordQueue = this.recordQueue.then(async () => {
      const rec: RoomRecord = (await getRecord(key)) ?? { key, name: this.d.name, bestTicks: 0, attempts: 0, wins: 0, deaths: {} };
      change(rec);
      await putRecord(rec);
    });
    return this.recordQueue;
  }

  private log(status: RunLog['status']): void {
    if (!this.recording) return;
    const run = this.run;
    const th = run.thief;
    const dead = status === 'dead';
    const killer = dead ? (ELEMENT_INFO[this.d.elements[run.killer]?.type]?.name ?? '') : '';
    const keys = (run.keys & 1) + ((run.keys >> 1) & 1) + ((run.keys >> 2) & 1);
    const entry: RunLog = {
      time: Date.now(),
      room: this.d.name,
      hash: this.hash,
      attempt: this.attempt,
      status,
      ticks: run.tick,
      keys,
      killer,
      deathX: dead ? (th.x + (this.phys.thiefW >> 1)) >> 8 : -1,
      deathY: dead ? (th.y + (this.phys.thiefH >> 1)) >> 8 : -1,
      jump: this.phys.variableJump ? 'variabel' : 'fest',
      blind: this.opts.blindLabel,
      tuned: recordKey(this.hash, this.phys) === null,
      restartMs: this.endedAt < 0 ? -1 : Math.round(this.startedAt - this.endedAt),
    };
    void addRun(entry);
    const key = recordKey(this.hash, this.phys);
    if (key) {
      void this.updateRecord(key, (rec) => {
        rec.attempts++;
        if (killer) rec.deaths[killer] = (rec.deaths[killer] ?? 0) + 1;
      });
    }
  }
}

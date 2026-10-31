import { GRID_H, GRID_W, type Dungeon, type Run } from '@diebesgut/sim';
import { COLORS, drawChest, drawElements, drawHitboxes, drawKeys, drawParticles, drawStatic, drawTerrain, drawThief } from './draw';
import type { Effects } from './effects';

export { COLORS, drawThief };

export interface FrameState {
  d: Dungeon;
  prev: Run;
  cur: Run;
  /** Anteil zwischen prev und cur, 0…1 */
  alpha: number;
  /** ms, nur für grafische Animationen */
  time: number;
  fx: Effects;
  hitboxes: boolean;
  /** Fortschritt des Todes-Effekts 0…1, kleiner 0 = lebt */
  dying: number;
  won: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Spielfeld im Spiel: Gelände und feste Teile einmal vorgezeichnet, der Rest jedes Bild. */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private cache: HTMLCanvasElement | null = null;
  private cacheFor: Dungeon | null = null;
  tile = 32;
  ox = 0;
  oy = 0;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D wird nicht unterstützt');
    this.ctx = ctx;
  }

  /** Größe in CSS-Pixeln, Kachelgröße und Lage des Rasters. */
  layout(cssW: number, cssH: number, tile: number, ox: number, oy: number, dpr: number): void {
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.tile = tile;
    this.ox = ox;
    this.oy = oy;
    this.dpr = dpr;
    this.cacheFor = null;
  }

  private toSE(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const k = (this.dpr * this.tile) / 256;
    ctx.setTransform(k, 0, 0, k, ox * this.dpr, oy * this.dpr);
  }

  draw(f: FrameState): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.page;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.cacheFor !== f.d) this.buildCache(f.d);
    if (this.cache) ctx.drawImage(this.cache, Math.round(this.ox * this.dpr), Math.round(this.oy * this.dpr));

    this.toSE(ctx, this.ox, this.oy);
    const t = f.time;
    drawChest(ctx, f.d, f.cur.keys === 7, f.won, t);
    drawKeys(ctx, f.d, f.cur.keys, t);
    const shapes = drawElements(ctx, f.d, f.prev, f.cur, f.alpha, t);

    const th = f.cur.thief;
    const fade = f.dying < 0 ? 1 : Math.max(0, 1 - f.dying * 3);
    if (fade > 0) drawThief(ctx, lerp(f.prev.thief.x, th.x, f.alpha), lerp(f.prev.thief.y, th.y, f.alpha), th.dir, th.ground, th.wall, th.vy, t, fade);

    drawParticles(ctx, f.fx);
    if (f.hitboxes || f.dying >= 0) drawHitboxes(ctx, f.d, f.cur, shapes, f.dying >= 0, f.hitboxes);

    if (f.dying >= 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255, 50, 60, ${0.28 * (1 - f.dying)})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private buildCache(d: Dungeon): void {
    const c = this.cache ?? document.createElement('canvas');
    c.width = Math.ceil(GRID_W * this.tile * this.dpr);
    c.height = Math.ceil(GRID_H * this.tile * this.dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    this.toSE(ctx, 0, 0);
    drawTerrain(ctx, d);
    drawStatic(ctx, d);
    this.cache = c;
    this.cacheFor = d;
  }
}

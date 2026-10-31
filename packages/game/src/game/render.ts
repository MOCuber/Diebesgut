import {
  CHEST_BOX,
  CIRCLE,
  ET,
  FLAME_DRAW_WIDTH,
  GRID_H,
  GRID_W,
  KEY_BOX,
  SAW_DRAW_RADIUS,
  SPIKE_DEPTH,
  flameCycle,
  flameLength,
  shapesAt,
  solid,
  type Dungeon,
  type Element,
  type Run,
  type Shape,
} from '@diebesgut/sim';
import type { Effects } from './effects';

// Alles wird in SE gezeichnet: Die Transformation rechnet 256 SE auf eine Kachel um.

export const COLORS = {
  page: '#0b0f1c',
  bg: '#161c33',
  bgBrick: '#12172b',
  stone: '#3c4668',
  stoneMortar: '#2d3552',
  stoneTop: '#64719c',
  stoneShade: '#262d47',
  steel: '#c7cfdf',
  steelDark: '#5f6985',
  rail: '#20263b',
  railLight: '#4d5878',
  gold: '#ffd04d',
  goldDark: '#b8860b',
  wood: '#8c5b2f',
  woodDark: '#5c3a1c',
  cloak: '#38b6a6',
  cloakDark: '#23796f',
  skin: '#f0c9a0',
  mask: '#1a1f33',
  scarf: '#ea5440',
  hit: '#ff3b5c',
  hitOff: '#8a93b2',
  thiefBox: '#4de1ff',
};

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

  invalidate(): void {
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

    const a = shapesAt(f.d, f.prev);
    const b = shapesAt(f.d, f.cur);
    for (let i = 0; i < b.length; i++) {
      const s = b[i];
      const el = f.d.elements[s.el];
      const p = a[i] ?? s;
      if (el.type === ET.SAW || el.type === ET.RAILSAW) {
        drawSawBlade(ctx, lerp(p.x, s.x, f.alpha), lerp(p.y, s.y, f.alpha), SAW_DRAW_RADIUS, t * 0.014 * (el.x % 2 === 0 ? 1 : -1));
      } else if (el.type === ET.FLAME) {
        drawFlameBeam(ctx, f.d, el, f.cur.tick, t);
      }
    }

    // Dieb
    const th = f.cur.thief;
    const x = lerp(f.prev.thief.x, th.x, f.alpha);
    const y = lerp(f.prev.thief.y, th.y, f.alpha);
    const fade = f.dying < 0 ? 1 : Math.max(0, 1 - f.dying * 3);
    if (fade > 0) drawThief(ctx, x, y, th.dir, th.ground, th.wall, th.vy, t, fade);

    drawParticles(ctx, f.fx);

    if (f.hitboxes || f.dying >= 0) drawHitboxes(ctx, f.d, f.cur, b, f.dying >= 0, f.hitboxes);

    if (f.dying >= 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255, 50, 60, ${0.28 * (1 - f.dying)})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /** Gelände, Stacheln, Schienen und Düsen ändern sich nie: einmal vorzeichnen. */
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
    for (const el of d.elements) {
      if (el.type === ET.SPIKES) drawSpikes(ctx, el);
      else if (el.type === ET.RAILSAW) drawRail(ctx, el);
      else if (el.type === ET.FLAME) drawNozzle(ctx, el);
    }
    this.cache = c;
    this.cacheFor = d;
  }
}

// ------------------------------------------------------------------ Gelände

function drawTerrain(ctx: CanvasRenderingContext2D, d: Dungeon): void {
  for (let ty = 0; ty < GRID_H; ty++) {
    for (let tx = 0; tx < GRID_W; tx++) {
      const X = tx << 8;
      const Y = ty << 8;
      if (!solid(d, tx, ty)) {
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(X, Y, 256, 256);
        ctx.fillStyle = COLORS.bgBrick;
        bricks(ctx, X, Y, 6);
        continue;
      }
      ctx.fillStyle = COLORS.stone;
      ctx.fillRect(X, Y, 256, 256);
      ctx.fillStyle = COLORS.stoneMortar;
      bricks(ctx, X, Y, 10);
      if (!solid(d, tx, ty - 1)) {
        ctx.fillStyle = COLORS.stoneTop;
        ctx.fillRect(X, Y, 256, 26);
      }
      if (!solid(d, tx, ty + 1)) {
        ctx.fillStyle = COLORS.stoneShade;
        ctx.fillRect(X, Y + 236, 256, 20);
      }
      ctx.fillStyle = COLORS.stoneShade;
      if (!solid(d, tx - 1, ty)) ctx.fillRect(X, Y, 12, 256);
      if (!solid(d, tx + 1, ty)) ctx.fillRect(X + 244, Y, 12, 256);
    }
  }
}

/** Ziegelfugen: zwei Reihen pro Kachel, versetzt, über Kachelgrenzen durchgehend. */
function bricks(ctx: CanvasRenderingContext2D, X: number, Y: number, w: number): void {
  ctx.fillRect(X, Y + 128 - w / 2, 256, w);
  ctx.fillRect(X, Y + 256 - w / 2, 256, w / 2);
  ctx.fillRect(X, Y, 256, w / 2);
  const off = ((Y >> 8) & 1) * 128;
  ctx.fillRect(X + ((64 + off) % 256), Y, w, 128);
  ctx.fillRect(X + ((192 + off) % 256), Y + 128, w, 128);
}

// ------------------------------------------------------------------ Fallen

/** Zeichnet in einem Rahmen, in dem „oben“ die Richtung des Elements ist (Befestigung bei y = +128). */
function inDir(ctx: CanvasRenderingContext2D, el: Element, dir: number, fn: () => void): void {
  ctx.save();
  ctx.translate((el.x << 8) + 128, (el.y << 8) + 128);
  ctx.rotate((dir * Math.PI) / 2);
  fn();
  ctx.restore();
}

function drawSpikes(ctx: CanvasRenderingContext2D, el: Element): void {
  inDir(ctx, el, el.p[0], () => {
    const base = 128;
    ctx.fillStyle = COLORS.steelDark;
    ctx.fillRect(-128, base - 16, 256, 16);
    for (let i = 0; i < 4; i++) {
      const x0 = -128 + i * 64;
      const g = ctx.createLinearGradient(x0, 0, x0 + 64, 0);
      g.addColorStop(0, '#eef2fa');
      g.addColorStop(1, '#8d97b2');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 + 2, base - 10);
      ctx.lineTo(x0 + 32, base - SPIKE_DEPTH);
      ctx.lineTo(x0 + 62, base - 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3d4560';
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  });
}

function drawRail(ctx: CanvasRenderingContext2D, el: Element): void {
  const x0 = (el.x << 8) + 128;
  const y0 = (el.y << 8) + 128;
  const x1 = x0 + (el.p[0] << 8);
  const y1 = y0 + (el.p[1] << 8);
  ctx.lineCap = 'round';
  ctx.strokeStyle = COLORS.rail;
  ctx.lineWidth = 40;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = COLORS.railLight;
  ctx.lineWidth = 10;
  ctx.stroke();
  for (const [x, y] of [
    [x0, y0],
    [x1, y1],
  ]) {
    ctx.fillStyle = COLORS.railLight;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.rail;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNozzle(ctx: CanvasRenderingContext2D, el: Element): void {
  inDir(ctx, el, el.p[0], () => {
    ctx.fillStyle = '#4b5270';
    ctx.fillRect(-58, 128 - 50, 116, 50);
    ctx.fillStyle = '#2a2f45';
    ctx.fillRect(-72, 128 - 62, 144, 18);
    ctx.fillStyle = '#ff7a3d';
    ctx.fillRect(-40, 128 - 66, 80, 6);
  });
}

function drawSawBlade(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, angle: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const teeth = 14;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.55) / teeth) * Math.PI * 2;
    ctx.lineTo(Math.cos(a0) * (r - 34), Math.sin(a0) * (r - 34));
    ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
  g.addColorStop(0, '#f2f5fb');
  g.addColorStop(1, '#8d97b2');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#3d4560';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = '#9aa4be';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3d4560';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFlameBeam(ctx: CanvasRenderingContext2D, d: Dungeon, el: Element, tick: number, t: number): void {
  const { pos, off } = flameCycle(el, tick);
  const on = pos >= off;
  const warn = !on && pos >= off - 20;
  if (!on && !warn) return;
  const n = Math.max(1, flameLength(el, d));
  inDir(ctx, el, el.p[0], () => {
    const mouth = 128 - 62;
    if (!on) {
      // Vorwarnung: kleine Flammen an der Düse
      const h = 40 + Math.random() * 50;
      ctx.fillStyle = 'rgba(255, 140, 50, 0.85)';
      flameShape(ctx, mouth, mouth - h, 70, 20);
      ctx.fillStyle = 'rgba(255, 230, 150, 0.9)';
      flameShape(ctx, mouth, mouth - h * 0.6, 34, 10);
      return;
    }
    const tip = 128 - (n << 8) + 24;
    const wob = Math.sin(t * 0.03 + el.x * 3) * 12;
    const glow = ctx.createLinearGradient(0, mouth, 0, tip);
    glow.addColorStop(0, 'rgba(255, 120, 40, 0.95)');
    glow.addColorStop(1, 'rgba(255, 60, 30, 0.55)');
    ctx.fillStyle = glow;
    flameShape(ctx, mouth, tip + wob, FLAME_DRAW_WIDTH, 80);
    ctx.fillStyle = 'rgba(255, 190, 70, 0.95)';
    flameShape(ctx, mouth, tip + 60 - wob, FLAME_DRAW_WIDTH * 0.62, 40);
    ctx.fillStyle = 'rgba(255, 246, 200, 0.95)';
    flameShape(ctx, mouth, tip + 160 + wob, FLAME_DRAW_WIDTH * 0.28, 14);
  });
}

function flameShape(ctx: CanvasRenderingContext2D, base: number, tip: number, wBase: number, wTip: number): void {
  const mid = (base + tip) / 2;
  ctx.beginPath();
  ctx.moveTo(-wBase / 2, base);
  ctx.quadraticCurveTo(-wBase / 2 - 10, mid, -wTip / 2, tip + 20);
  ctx.quadraticCurveTo(0, tip - 30, wTip / 2, tip + 20);
  ctx.quadraticCurveTo(wBase / 2 + 10, mid, wBase / 2, base);
  ctx.closePath();
  ctx.fill();
}

// ------------------------------------------------------------------ Schlüssel und Truhe

function drawKeys(ctx: CanvasRenderingContext2D, d: Dungeon, keys: number, t: number): void {
  d.keys.forEach((k, i) => {
    if (keys & (1 << i)) return;
    const cx = (k.x << 8) + KEY_BOX.dx + KEY_BOX.w / 2;
    const cy = (k.y << 8) + KEY_BOX.dy + KEY_BOX.h / 2 + Math.sin(t * 0.004 + i * 2) * 14;
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 120);
    glow.addColorStop(0, 'rgba(255, 210, 80, 0.35)');
    glow.addColorStop(1, 'rgba(255, 210, 80, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 120, cy - 120, 240, 240);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.5);
    ctx.strokeStyle = COLORS.goldDark;
    ctx.fillStyle = COLORS.gold;
    ctx.lineWidth = 8;
    // Reide
    ctx.beginPath();
    ctx.arc(-40, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.goldDark;
    ctx.beginPath();
    ctx.arc(-40, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    // Schaft und Bart
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(-10, -10, 92, 20);
    ctx.fillRect(48, 6, 14, 26);
    ctx.fillRect(70, 6, 12, 18);
    ctx.strokeRect(-10, -10, 92, 20);
    ctx.restore();
  });
}

function drawChest(ctx: CanvasRenderingContext2D, d: Dungeon, unlocked: boolean, open: boolean, t: number): void {
  const X = (d.chest.x << 8) + CHEST_BOX.dx;
  const Y = (d.chest.y << 8) + CHEST_BOX.dy;
  const W = CHEST_BOX.w;
  const H = CHEST_BOX.h;
  if (unlocked || open) {
    const pulse = open ? 1 : 0.6 + Math.sin(t * 0.008) * 0.3;
    const glow = ctx.createRadialGradient(X + W / 2, Y + H / 2, 20, X + W / 2, Y + H / 2, 260);
    glow.addColorStop(0, `rgba(255, 215, 90, ${0.5 * pulse})`);
    glow.addColorStop(1, 'rgba(255, 215, 90, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(X - 160, Y - 180, W + 320, H + 300);
  }
  // Korpus
  ctx.fillStyle = COLORS.wood;
  ctx.fillRect(X, Y + 50, W, H - 50);
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(X, Y + 100, W, 8);
  ctx.fillRect(X, Y + 140, W, 8);
  // Deckel
  if (open) {
    ctx.fillStyle = COLORS.woodDark;
    ctx.fillRect(X - 6, Y - 40, W + 12, 40);
    ctx.fillStyle = 'rgba(255, 230, 120, 0.9)';
    ctx.fillRect(X + 16, Y + 34, W - 32, 22);
  } else {
    ctx.fillStyle = COLORS.wood;
    ctx.beginPath();
    ctx.moveTo(X - 6, Y + 56);
    ctx.lineTo(X - 6, Y + 20);
    ctx.quadraticCurveTo(X + W / 2, Y - 20, X + W + 6, Y + 20);
    ctx.lineTo(X + W + 6, Y + 56);
    ctx.closePath();
    ctx.fill();
  }
  // Beschläge
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(X + 18, Y + 50, 16, H - 50);
  ctx.fillRect(X + W - 34, Y + 50, 16, H - 50);
  ctx.fillStyle = unlocked || open ? '#fff2b0' : COLORS.goldDark;
  ctx.fillRect(X + W / 2 - 22, Y + 44, 44, 52);
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(X + W / 2 - 5, Y + 62, 10, 20);
}

// ------------------------------------------------------------------ Dieb

export function drawThief(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number,
  ground: boolean,
  wall: number,
  vy: number,
  t: number,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + 76, y + 232);
  ctx.scale(dir, 1);
  const sliding = !ground && wall !== 0;
  const phase = x * 0.045;

  // Beine
  ctx.fillStyle = COLORS.mask;
  if (ground) {
    const s = Math.sin(phase) * 24;
    roundRect(ctx, -36 + s, -56, 30, 56, 10);
    roundRect(ctx, 6 - s, -56, 30, 56, 10);
  } else if (sliding) {
    roundRect(ctx, -30, -64, 30, 52, 10);
    roundRect(ctx, 8, -50, 30, 46, 10);
  } else {
    const tuck = vy > 0 ? 12 : 0;
    roundRect(ctx, -40, -62 + tuck, 30, 48, 10);
    roundRect(ctx, 10, -56 + tuck, 30, 44, 10);
  }

  // Schal weht nach hinten
  const wave = Math.sin(t * 0.02) * 14;
  const lift = ground ? 0 : vy > 0 ? 26 : -18;
  ctx.strokeStyle = COLORS.scarf;
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -172);
  ctx.quadraticCurveTo(-66, -168 + wave - lift * 0.5, -112, -150 + wave * 1.4 + lift);
  ctx.stroke();

  // Umhang
  ctx.fillStyle = COLORS.cloak;
  ctx.beginPath();
  ctx.moveTo(-58, -48);
  ctx.lineTo(-48, -170);
  ctx.quadraticCurveTo(0, -196, 48, -170);
  ctx.lineTo(62, -48);
  ctx.quadraticCurveTo(0, -36, -58, -48);
  ctx.fill();
  ctx.fillStyle = COLORS.cloakDark;
  ctx.fillRect(-52, -92, 110, 14);

  // Kopf mit Kapuze, Gesicht und Maske
  ctx.fillStyle = COLORS.cloakDark;
  ctx.beginPath();
  ctx.arc(0, -206, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.skin;
  ctx.beginPath();
  ctx.arc(14, -200, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.mask;
  roundRect(ctx, -18, -222, 80, 26, 10);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(22, -216, 12, 13);
  ctx.fillRect(42, -216, 12, 13);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// ------------------------------------------------------------------ Partikel und Hitboxen

function drawParticles(ctx: CanvasRenderingContext2D, fx: Effects): void {
  for (const p of fx.items) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawHitboxes(ctx: CanvasRenderingContext2D, d: Dungeon, run: Run, shapes: Shape[], dead: boolean, all: boolean): void {
  ctx.lineWidth = 10;
  for (const s of shapes) {
    const killer = dead && s.el === run.killer;
    if (!all && !killer) continue;
    ctx.strokeStyle = s.on ? COLORS.hit : COLORS.hitOff;
    ctx.fillStyle = killer ? 'rgba(255, 59, 92, 0.45)' : s.on ? 'rgba(255, 59, 92, 0.18)' : 'rgba(138, 147, 178, 0.08)';
    ctx.setLineDash(s.on ? [] : [24, 18]);
    ctx.beginPath();
    if (s.kind === CIRCLE) ctx.arc(s.x, s.y, s.w, 0, Math.PI * 2);
    else ctx.rect(s.x, s.y, s.w, s.h);
    ctx.fill();
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (all) {
    ctx.strokeStyle = 'rgba(255, 208, 77, 0.7)';
    d.keys.forEach((k, i) => {
      if (!(run.keys & (1 << i))) ctx.strokeRect((k.x << 8) + KEY_BOX.dx, (k.y << 8) + KEY_BOX.dy, KEY_BOX.w, KEY_BOX.h);
    });
    ctx.strokeRect((d.chest.x << 8) + CHEST_BOX.dx, (d.chest.y << 8) + CHEST_BOX.dy, CHEST_BOX.w, CHEST_BOX.h);
  }
  ctx.strokeStyle = COLORS.thiefBox;
  ctx.lineWidth = 10;
  ctx.strokeRect(run.thief.x, run.thief.y, run.phys.thiefW, run.phys.thiefH);
}

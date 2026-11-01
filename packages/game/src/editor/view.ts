import { BLOCK, ET, FORTRESS_RULES, GRID_H, GRID_W, createRun, type Dungeon, type Run, type Tile } from '@diebesgut/sim';
import { COLORS, FRAME, drawChest, drawElements, drawHitboxes, drawKeys, drawStatic, drawTerrain, drawThief } from '../game/draw';
import { blockOf, type EdElement } from './model';

export type HandleKind = 'rail' | 'gate' | 'radius' | 'chain';

export interface Handle {
  kind: HandleKind;
  /** Mitte in Kacheln (Bruchteile erlaubt) */
  x: number;
  y: number;
}

/** Griffe eines ausgewählten Elements, mit denen Pfade und Radien gezogen werden. */
export function handlesFor(el: EdElement | undefined): Handle[] {
  if (!el) return [];
  switch (el.type) {
    case ET.RAILSAW:
      return [{ kind: 'rail', x: el.x + el.p[0] + 0.5, y: el.y + el.p[1] + 0.5 }];
    case ET.GATE:
      return [{ kind: 'gate', x: el.x + el.p[0] + 0.5, y: el.y + el.p[1] + 1.5 }];
    case ET.ORBITSAW:
      return [{ kind: 'radius', x: el.x + 0.5 + el.p[0], y: el.y + 0.5 }];
    case ET.PENDULUM:
      return [{ kind: 'chain', x: el.x + 0.5, y: el.y + el.p[0] }];
    default:
      return [];
  }
}

export interface Overlay {
  /** Kacheln der Auswahl (Element oder Pflichtobjekt) */
  selection: Tile | null;
  handles: Handle[];
  /** Kacheln, die das ausgewählte Element gefährdet */
  footprint: Tile[];
  /** Kacheln mit Verstößen gegen die Bauregeln */
  problems: Tile[];
  /** Startschutz-Kreis einblenden */
  startZone: boolean;
  hitboxes: boolean;
  /** Spur des letzten Testlaufs: x, y in SE, abwechselnd */
  trail: number[] | null;
  /** Todesorte (x, y in SE) für die Heatmap */
  heat: number[] | null;
  death: { x: number; y: number } | null;
  /** Vorschau des Rechteck-Werkzeugs */
  rect: { a: Tile; b: Tile; fill: boolean } | null;
  /** Geländewerkzeug aktiv: Markierungen zeigen ganze 2 × 2-Blöcke */
  blocks: boolean;
  /** Lupe: Fingerposition in CSS-Pixeln und Zielkachel */
  magnifier: { px: number; py: number; tile: Tile } | null;
  /** Kachel unter der Maus */
  hover: Tile | null;
}

const MAG_R = 62;

/**
 * Zeichenfläche des Editors. Das Raster passt zunächst genau hinein (Zoom 1), zwei Finger oder das
 * Mausrad zoomen bis dreifach, verschoben wird in CSS-Pixeln.
 */
export class EditorView {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly mag = document.createElement('canvas');
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  baseTile = 24;
  zoom = 1;
  panX = 0;
  panY = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D wird nicht unterstützt');
    this.ctx = ctx;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    // Kachelgröße wie in der Spezifikation: so groß, wie das Raster samt Steinrahmen in die Fläche passt
    this.baseTile = Math.max(6, Math.floor(Math.min(this.cssW / (GRID_W + 2 * FRAME), this.cssH / (GRID_H + 2 * FRAME))));
    this.clampPan();
  }

  get tile(): number {
    return this.baseTile * this.zoom;
  }

  /** Linke obere Ecke des Rasters in CSS-Pixeln */
  get ox(): number {
    return (this.cssW - GRID_W * this.tile) / 2 + this.panX;
  }

  get oy(): number {
    return (this.cssH - GRID_H * this.tile) / 2 + this.panY;
  }

  toTile(px: number, py: number): Tile | null {
    const x = Math.floor((px - this.ox) / this.tile);
    const y = Math.floor((py - this.oy) / this.tile);
    return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H ? { x, y } : null;
  }

  /** Position in Kacheln (mit Bruchteil), auch außerhalb des Rasters */
  toTileF(px: number, py: number): { x: number; y: number } {
    return { x: (px - this.ox) / this.tile, y: (py - this.oy) / this.tile };
  }

  tileCenterPx(x: number, y: number): { px: number; py: number } {
    return { px: this.ox + x * this.tile, py: this.oy + y * this.tile };
  }

  zoomAt(factor: number, px: number, py: number): void {
    const before = this.toTileF(px, py);
    this.zoom = Math.min(3, Math.max(1, this.zoom * factor));
    const after = this.tileCenterPx(before.x, before.y);
    this.panX += px - after.px;
    this.panY += py - after.py;
    this.clampPan();
  }

  setZoom(zoom: number, panX: number, panY: number): void {
    this.zoom = Math.min(3, Math.max(1, zoom));
    this.panX = panX;
    this.panY = panY;
    this.clampPan();
  }

  pan(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
    this.clampPan();
  }

  /** Zeigt eine Kachel möglichst mittig, ohne den Zoom zu ändern. */
  focus(t: Tile): void {
    const c = this.tileCenterPx(t.x + 0.5, t.y + 0.5);
    this.pan(this.cssW / 2 - c.px, this.cssH / 2 - c.py);
  }

  private clampPan(): void {
    const maxX = Math.max(0, ((GRID_W + 2 * FRAME) * this.tile - this.cssW) / 2);
    const maxY = Math.max(0, ((GRID_H + 2 * FRAME) * this.tile - this.cssH) / 2);
    this.panX = Math.min(maxX, Math.max(-maxX, this.panX));
    this.panY = Math.min(maxY, Math.max(-maxY, this.panY));
  }

  draw(d: Dungeon, run: Run, time: number, o: Overlay): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.page;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const k = (this.dpr * this.tile) / 256;
    ctx.setTransform(k, 0, 0, k, this.ox * this.dpr, this.oy * this.dpr);

    const f = FRAME * 256;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-f, -f, (GRID_W << 8) + 2 * f, (GRID_H << 8) + 2 * f);
    ctx.clip();
    drawTerrain(ctx, d, 1);
    ctx.restore();
    if (o.heat) drawHeat(ctx, o.heat);
    drawStatic(ctx, d);
    for (const t of o.footprint) {
      ctx.fillStyle = 'rgba(255, 208, 77, 0.13)';
      ctx.fillRect(t.x << 8, t.y << 8, 256, 256);
    }
    if (o.startZone) {
      ctx.strokeStyle = 'rgba(90, 209, 154, 0.45)';
      ctx.fillStyle = 'rgba(90, 209, 154, 0.06)';
      ctx.lineWidth = 10;
      ctx.setLineDash([30, 24]);
      ctx.beginPath();
      ctx.arc((d.start.x << 8) + 128, (d.start.y << 8) + 128, FORTRESS_RULES.startZone * 256 + 128, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    drawChest(ctx, d, false, false, time);
    drawKeys(ctx, d, 0, time);
    const shapes = drawElements(ctx, d, run, run, 1, time);

    // Start: der Dieb mit Blickrichtung
    const th = run.thief;
    drawThief(ctx, th.x, th.y, d.start.dir, true, 0, 0, time, 0.9, run.phys.thiefW, run.phys.thiefH);
    const ax = (d.start.x << 8) + 128;
    const ay = th.y - 44;
    ctx.fillStyle = '#5ad19a';
    ctx.beginPath();
    ctx.moveTo(ax + d.start.dir * 70, ay);
    ctx.lineTo(ax - d.start.dir * 30, ay - 40);
    ctx.lineTo(ax - d.start.dir * 30, ay + 40);
    ctx.closePath();
    ctx.fill();

    drawGrid(ctx);
    if (o.hitboxes) drawHitboxes(ctx, d, run, shapes, false, true);
    if (o.trail && o.trail.length >= 4) {
      ctx.strokeStyle = 'rgba(77, 225, 255, 0.75)';
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < o.trail.length; i += 2) ctx.lineTo(o.trail[i], o.trail[i + 1]);
      ctx.stroke();
    }
    if (o.death) {
      ctx.strokeStyle = '#ff3b5c';
      ctx.lineWidth = 34;
      ctx.lineCap = 'round';
      const { x, y } = o.death;
      ctx.beginPath();
      ctx.moveTo(x - 70, y - 70);
      ctx.lineTo(x + 70, y + 70);
      ctx.moveTo(x + 70, y - 70);
      ctx.lineTo(x - 70, y + 70);
      ctx.stroke();
    }
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#ff3b5c';
    ctx.setLineDash([]);
    for (const t of o.problems) ctx.strokeRect((t.x << 8) + 8, (t.y << 8) + 8, 240, 240);
    if (o.rect) {
      // Das Rechteck umfasst immer ganze Blöcke.
      const a = blockOf(o.rect.a);
      const b = blockOf(o.rect.b);
      const x0 = Math.min(a.x, b.x);
      const y0 = Math.min(a.y, b.y);
      const w = Math.abs(a.x - b.x) + BLOCK;
      const h = Math.abs(a.y - b.y) + BLOCK;
      ctx.fillStyle = o.rect.fill ? 'rgba(100, 113, 156, 0.55)' : 'rgba(22, 28, 51, 0.6)';
      ctx.fillRect(x0 << 8, y0 << 8, w << 8, h << 8);
      ctx.strokeStyle = '#ffd04d';
      ctx.lineWidth = 12;
      ctx.strokeRect(x0 << 8, y0 << 8, w << 8, h << 8);
    }
    if (o.hover && !o.magnifier) {
      const t = o.blocks ? blockOf(o.hover) : o.hover;
      const size = o.blocks ? BLOCK << 8 : 256;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 10;
      ctx.strokeRect(t.x << 8, t.y << 8, size, size);
    }
    if (o.selection) {
      ctx.strokeStyle = '#ffd04d';
      ctx.lineWidth = 16;
      ctx.strokeRect((o.selection.x << 8) - 8, (o.selection.y << 8) - 8, 272, 272);
    }
    for (const h of o.handles) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1a1f33';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(h.x * 256, h.y * 256, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd04d';
      ctx.beginPath();
      ctx.arc(h.x * 256, h.y * 256, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    if (o.magnifier) this.drawMagnifier(o.magnifier, o.blocks);
  }

  /** Lupe: das Zielfeld (oder der Zielblock) doppelt groß über dem Finger, damit der Daumen es nicht verdeckt. */
  private drawMagnifier(m: { px: number; py: number; tile: Tile }, blocks: boolean): void {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const R = MAG_R;
    const src = R; // Quellbereich in CSS-Pixeln (Kantenlänge), doppelt groß gezeigt
    // über dem Finger; ist dort kein Platz, daneben (der Daumen verdeckt alles darunter)
    let cx = m.px;
    let cy = m.py - R - 46;
    if (cy - R < 4) {
      cy = Math.min(Math.max(m.py, R + 4), this.cssH - R - 4);
      cx = m.px - R - 56 >= R + 4 ? m.px - R - 56 : m.px + R + 56;
    }
    cx = Math.min(Math.max(cx, R + 4), this.cssW - R - 4);
    this.mag.width = Math.round(src * dpr);
    this.mag.height = Math.round(src * dpr);
    const mctx = this.mag.getContext('2d');
    if (!mctx) return;
    mctx.drawImage(this.canvas, Math.round((m.px - src / 2) * dpr), Math.round((m.py - src / 2) * dpr), this.mag.width, this.mag.height, 0, 0, this.mag.width, this.mag.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = COLORS.page;
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.drawImage(this.mag, cx - R, cy - R, 2 * R, 2 * R);
    // Zielkachel oder Zielblock im Bild der Lupe
    const target = blocks ? blockOf(m.tile) : m.tile;
    const t = this.tile * 2 * (blocks ? BLOCK : 1);
    const tl = this.tileCenterPx(target.x, target.y);
    ctx.strokeStyle = '#ffd04d';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx + (tl.px - m.px) * 2, cy + (tl.py - m.py) * 2, t, t);
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Feldlinien schwach (für Elemente), Blocklinien kräftiger (für Gelände). */
function drawGrid(ctx: CanvasRenderingContext2D): void {
  for (const block of [false, true]) {
    ctx.strokeStyle = block ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = block ? 8 : 5;
    ctx.beginPath();
    for (let x = 1; x < GRID_W; x++) {
      if ((x % BLOCK === 0) !== block) continue;
      ctx.moveTo(x << 8, 0);
      ctx.lineTo(x << 8, GRID_H << 8);
    }
    for (let y = 1; y < GRID_H; y++) {
      if ((y % BLOCK === 0) !== block) continue;
      ctx.moveTo(0, y << 8);
      ctx.lineTo(GRID_W << 8, y << 8);
    }
    ctx.stroke();
  }
}

function drawHeat(ctx: CanvasRenderingContext2D, heat: number[]): void {
  for (let i = 0; i < heat.length; i += 2) {
    const g = ctx.createRadialGradient(heat[i], heat[i + 1], 0, heat[i], heat[i + 1], 200);
    g.addColorStop(0, 'rgba(255, 40, 60, 0.32)');
    g.addColorStop(1, 'rgba(255, 40, 60, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(heat[i] - 200, heat[i + 1] - 200, 400, 400);
  }
}

/** Kleines Vorschaubild eines Dungeons (Versionen, Festungsliste). */
export function drawThumb(canvas: HTMLCanvasElement, d: Dungeon, width: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // schmalerer Rahmen als im Spiel, aber die Außenmauer soll erkennbar sein
  const frame = FRAME / 2;
  const tile = width / (GRID_W + 2 * frame);
  const height = tile * (GRID_H + 2 * frame);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const k = (dpr * tile) / 256;
  ctx.setTransform(k, 0, 0, k, frame * tile * dpr, frame * tile * dpr);
  drawTerrain(ctx, d, 1);
  drawStatic(ctx, d);
  drawChest(ctx, d, false, false, 0);
  drawKeys(ctx, d, 0, 0);
  const run = createRun(d);
  drawElements(ctx, d, run, run, 1, 0);
  ctx.fillStyle = '#5ad19a';
  ctx.beginPath();
  ctx.arc((d.start.x << 8) + 128, (d.start.y << 8) + 128, 90, 0, Math.PI * 2);
  ctx.fill();
}

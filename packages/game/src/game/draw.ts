import {
  BUMPER_DEPTH,
  CHEST_BOX,
  CIRCLE,
  CRUMBLE_RESPAWN,
  ET,
  FLAME_DRAW_WIDTH,
  GATE_DURATION,
  GATE_HEIGHT,
  GRID_H,
  GRID_W,
  GUARD_H,
  GUARD_W,
  KEY_BOX,
  PENDULUM_BLADE,
  SAW_DRAW_RADIUS,
  SPIKE_DEPTH,
  SWITCH_BOX,
  dynOffsets,
  flameCycle,
  flameLength,
  gateTile,
  guardPos,
  scoutDir,
  scoutSight,
  shapesAt,
  solid,
  type Dungeon,
  type Element,
  type Run,
  type Shape,
} from '@diebesgut/sim';
import type { Effects } from './effects';

// Szenen-Zeichnung für Spiel und Editor. Alles in SE: Der Aufrufer setzt eine Transformation,
// die 256 SE auf eine Kachel abbildet.

export const COLORS = {
  page: '#0b0f1c',
  bg: '#161c33',
  bgBrick: '#12172b',
  stone: '#3c4668',
  stoneMortar: '#2d3552',
  stoneTop: '#64719c',
  stoneShade: '#262d47',
  steelDark: '#5f6985',
  rail: '#20263b',
  railLight: '#4d5878',
  metal: '#4b5270',
  metalDark: '#2a2f45',
  gold: '#ffd04d',
  goldDark: '#b8860b',
  wood: '#8c5b2f',
  woodDark: '#5c3a1c',
  sand: '#8f7653',
  sandDark: '#5f4c33',
  cloak: '#38b6a6',
  cloakDark: '#23796f',
  skin: '#f0c9a0',
  mask: '#1a1f33',
  scarf: '#ea5440',
  guard: '#a33a35',
  guardDark: '#6e2421',
  helmet: '#9aa3b8',
  hit: '#ff3b5c',
  hitOff: '#8a93b2',
  thiefBox: '#4de1ff',
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Zeichnet in einem Rahmen, in dem „oben“ die Richtung des Elements ist (Befestigung bei y = +128). */
function inDir(ctx: CanvasRenderingContext2D, el: Element, dir: number, fn: () => void): void {
  ctx.save();
  ctx.translate((el.x << 8) + 128, (el.y << 8) + 128);
  ctx.rotate((dir * Math.PI) / 2);
  fn();
  ctx.restore();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// ------------------------------------------------------------------ Gelände

export function drawTerrain(ctx: CanvasRenderingContext2D, d: Dungeon): void {
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

// ------------------------------------------------------------------ Feste Teile der Elemente

/** Alles, was sich nie bewegt: im Spiel einmal vorgezeichnet, im Editor jedes Bild. */
export function drawStatic(ctx: CanvasRenderingContext2D, d: Dungeon): void {
  for (const el of d.elements) {
    switch (el.type) {
      case ET.SPIKES:
        drawSpikes(ctx, el);
        break;
      case ET.SPRING:
        drawSpring(ctx, el);
        break;
      case ET.FLAME:
        drawNozzle(ctx, el);
        break;
      case ET.RAILSAW:
        drawRail(ctx, el);
        break;
      case ET.ORBITSAW:
        drawOrbitPath(ctx, el);
        break;
      case ET.PENDULUM:
        drawMount(ctx, (el.x << 8) + 128, el.y << 8);
        break;
      case ET.STOMPER:
        ctx.fillStyle = COLORS.metalDark;
        ctx.fillRect((el.x << 8) + 24, el.y << 8, 208, 26);
        break;
      case ET.CROSSBOW:
        drawCrossbow(ctx, el);
        break;
      case ET.BUMPER:
        drawBumper(ctx, el);
        break;
    }
  }
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

function drawSpring(ctx: CanvasRenderingContext2D, el: Element): void {
  const X = el.x << 8;
  const Y = el.y << 8;
  ctx.fillStyle = COLORS.metalDark;
  ctx.fillRect(X + 36, Y + 230, 184, 26);
  ctx.strokeStyle = '#c7cfdf';
  ctx.lineWidth = 12;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) ctx.lineTo(X + (i % 2 === 0 ? 80 : 176), Y + 230 - i * 11);
  ctx.stroke();
  ctx.fillStyle = '#ff8a3d';
  roundRect(ctx, X + 40, Y + 150, 176, 20, 8);
  ctx.fillStyle = '#ffd0a8';
  ctx.fillRect(X + 56, Y + 152, 144, 5);
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
    circle(ctx, x, y, 30);
    ctx.fillStyle = COLORS.rail;
    circle(ctx, x, y, 14);
  }
}

function drawNozzle(ctx: CanvasRenderingContext2D, el: Element): void {
  inDir(ctx, el, el.p[0], () => {
    ctx.fillStyle = COLORS.metal;
    ctx.fillRect(-58, 128 - 50, 116, 50);
    ctx.fillStyle = COLORS.metalDark;
    ctx.fillRect(-72, 128 - 62, 144, 18);
    ctx.fillStyle = '#ff7a3d';
    ctx.fillRect(-40, 128 - 66, 80, 6);
  });
}

function drawOrbitPath(ctx: CanvasRenderingContext2D, el: Element): void {
  const cx = (el.x << 8) + 128;
  const cy = (el.y << 8) + 128;
  ctx.strokeStyle = 'rgba(160, 172, 205, 0.28)';
  ctx.lineWidth = 10;
  ctx.setLineDash([30, 26]);
  ctx.beginPath();
  ctx.arc(cx, cy, el.p[0] << 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.railLight;
  circle(ctx, cx, cy, 34);
  ctx.fillStyle = COLORS.rail;
  circle(ctx, cx, cy, 16);
}

function drawMount(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = COLORS.metalDark;
  ctx.beginPath();
  ctx.moveTo(x - 60, y);
  ctx.lineTo(x + 60, y);
  ctx.lineTo(x + 26, y + 40);
  ctx.lineTo(x - 26, y + 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.railLight;
  circle(ctx, x, y + 30, 16);
}

function drawCrossbow(ctx: CanvasRenderingContext2D, el: Element): void {
  inDir(ctx, el, el.p[0], () => {
    ctx.fillStyle = COLORS.woodDark;
    ctx.fillRect(-26, 128 - 40, 52, 40);
    ctx.fillStyle = COLORS.wood;
    roundRect(ctx, -20, 128 - 150, 40, 130, 10);
    ctx.strokeStyle = '#3b2a1a';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-100, 128 - 70);
    ctx.quadraticCurveTo(0, 128 - 170, 100, 128 - 70);
    ctx.stroke();
    ctx.strokeStyle = '#d9d2c0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-100, 128 - 70);
    ctx.lineTo(0, 128 - 96);
    ctx.lineTo(100, 128 - 70);
    ctx.stroke();
  });
}

function drawBumper(ctx: CanvasRenderingContext2D, el: Element): void {
  const X = el.x << 8;
  const Y = el.y << 8;
  const left = el.p[0] === 0;
  const wall = left ? X : X + 256;
  const face = left ? X + BUMPER_DEPTH : X + 256 - BUMPER_DEPTH;
  ctx.strokeStyle = '#c7cfdf';
  ctx.lineWidth = 8;
  for (const yy of [Y + 70, Y + 186]) {
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) ctx.lineTo(lerp(wall, face, i / 4), yy + (i % 2 === 0 ? -14 : 14));
    ctx.stroke();
  }
  const x0 = left ? face : face - 26;
  ctx.fillStyle = '#ffcf3a';
  ctx.fillRect(x0, Y + 26, 26, 204);
  ctx.fillStyle = '#2a2f45';
  for (let i = 0; i < 4; i++) ctx.fillRect(x0, Y + 46 + i * 50, 26, 22);
}

// ------------------------------------------------------------------ Bewegliche Teile

/** Fallen, Böden, Tore und Wächter zum Zustand zwischen prev und cur. */
export function drawElements(ctx: CanvasRenderingContext2D, d: Dungeon, prev: Run, cur: Run, alpha: number, t: number): Shape[] {
  const offs = dynOffsets(d);
  d.elements.forEach((el, id) => {
    const o = offs[id];
    if (el.type === ET.CRUMBLE) drawCrumble(ctx, el, cur.dyn[o], cur.dyn[o + 1], t);
    else if (el.type === ET.GATE) drawGate(ctx, el, cur.dyn[o + 1] === 1, cur.dyn[o]);
    else if (el.type === ET.SCOUT) drawScoutSight(ctx, d, el, cur.dyn[o]);
  });

  const a = shapesAt(d, prev);
  const b = shapesAt(d, cur);
  for (let i = 0; i < b.length; i++) {
    const s = b[i];
    const p = a[i] ?? s;
    const el = d.elements[s.el];
    const x = lerp(p.x, s.x, alpha);
    const y = lerp(p.y, s.y, alpha);
    switch (el.type) {
      case ET.SAW:
      case ET.RAILSAW:
        drawSawBlade(ctx, x, y, SAW_DRAW_RADIUS, t * 0.014 * (el.x % 2 === 0 ? 1 : -1));
        break;
      case ET.ORBITSAW:
        ctx.strokeStyle = COLORS.rail;
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.moveTo((el.x << 8) + 128, (el.y << 8) + 128);
        ctx.lineTo(x, y);
        ctx.stroke();
        drawSawBlade(ctx, x, y, SAW_DRAW_RADIUS, t * 0.016 * (el.p[2] === 0 ? 1 : -1));
        break;
      case ET.PENDULUM:
        drawPendulum(ctx, (el.x << 8) + 128, (el.y << 8) + 30, x, y);
        break;
      case ET.STOMPER:
        drawStomper(ctx, el, y - 20 - (el.y << 8));
        break;
      case ET.FLAME:
        drawFlameBeam(ctx, d, el, cur.tick, t);
        break;
      case ET.CROSSBOW:
        if (s.on) drawBolt(ctx, x, y, s.w, s.h, el.p[0]);
        break;
      case ET.GUARD:
        drawGuard(ctx, x - 16, y - 24, guardPos(el, d, cur.tick).dir);
        break;
      case ET.SCOUT:
        drawScout(ctx, el, cur.dyn[offs[s.el]]);
        if (s.on) drawBolt(ctx, x, y, s.w, s.h, scoutDir(el) > 0 ? 1 : 3);
        break;
    }
  }
  return b;
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
  circle(ctx, 0, 0, r * 0.5);
  ctx.fillStyle = '#3d4560';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    circle(ctx, Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, 12);
  }
  circle(ctx, 0, 0, 24);
  ctx.restore();
}

function drawPendulum(ctx: CanvasRenderingContext2D, px: number, py: number, bx: number, by: number): void {
  const n = 9;
  ctx.strokeStyle = '#8d97b2';
  ctx.lineWidth = 8;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    ctx.beginPath();
    ctx.ellipse(lerp(px, bx, t), lerp(py, by, t), 14, 22, Math.atan2(by - py, bx - px) + Math.PI / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Klinge: Halbmond, Schneide nach unten
  const ang = Math.atan2(by - py, bx - px);
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(ang - Math.PI / 2);
  const r = PENDULUM_BLADE + 34;
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, '#8d97b2');
  g.addColorStop(1, '#f2f5fb');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0.05 * Math.PI, 0.95 * Math.PI);
  ctx.quadraticCurveTo(0, r * 0.15, Math.cos(0.05 * Math.PI) * r, Math.sin(0.05 * Math.PI) * r);
  ctx.fill();
  ctx.strokeStyle = '#3d4560';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = COLORS.metalDark;
  circle(ctx, 0, 0, 30);
  ctx.restore();
}

function drawStomper(ctx: CanvasRenderingContext2D, el: Element, drop: number): void {
  const X = el.x << 8;
  const Y = el.y << 8;
  ctx.fillStyle = '#333a52';
  ctx.fillRect(X + 104, Y + 26, 48, Math.max(0, drop));
  const top = Y + drop + 16;
  ctx.fillStyle = '#4d5570';
  ctx.fillRect(X + 16, top, 224, 196);
  ctx.fillStyle = '#6b7593';
  ctx.fillRect(X + 16, top, 224, 18);
  ctx.fillStyle = '#2a2f45';
  for (const rx of [X + 44, X + 212]) for (const ry of [top + 50, top + 150]) circle(ctx, rx, ry, 10);
  ctx.fillStyle = '#c7cfdf';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const x0 = X + 16 + i * 37.3;
    ctx.moveTo(x0, top + 196);
    ctx.lineTo(x0 + 18.6, top + 228);
    ctx.lineTo(x0 + 37.3, top + 196);
  }
  ctx.fill();
}

function drawBolt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number): void {
  ctx.fillStyle = '#d9c9a3';
  ctx.strokeStyle = '#5a4630';
  ctx.lineWidth = 4;
  const horizontal = dir === 1 || dir === 3;
  if (horizontal) {
    const cy = y + h / 2;
    ctx.fillRect(x, cy - 5, w, 10);
    ctx.fillStyle = '#c7cfdf';
    ctx.beginPath();
    const tip = dir === 1 ? x + w + 18 : x - 18;
    const base = dir === 1 ? x + w - 10 : x + 10;
    ctx.moveTo(tip, cy);
    ctx.lineTo(base, cy - 18);
    ctx.lineTo(base, cy + 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    const cx = x + w / 2;
    ctx.fillRect(cx - 5, y, 10, h);
    ctx.fillStyle = '#c7cfdf';
    ctx.beginPath();
    const tip = dir === 2 ? y + h + 18 : y - 18;
    const base = dir === 2 ? y + h - 10 : y + 10;
    ctx.moveTo(cx, tip);
    ctx.lineTo(cx - 18, base);
    ctx.lineTo(cx + 18, base);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawCrumble(ctx: CanvasRenderingContext2D, el: Element, state: number, counter: number, t: number): void {
  const X = el.x << 8;
  const Y = el.y << 8;
  if (state === 2) {
    // weg: gestrichelter Umriss, deutlicher kurz vor der Rückkehr
    ctx.strokeStyle = `rgba(200, 170, 120, ${0.15 + 0.45 * (1 - counter / CRUMBLE_RESPAWN)})`;
    ctx.lineWidth = 10;
    ctx.setLineDash([26, 20]);
    ctx.strokeRect(X + 10, Y + 10, 236, 236);
    ctx.setLineDash([]);
    return;
  }
  const shake = state === 1 ? Math.sin(t * 0.09) * 8 : 0;
  ctx.fillStyle = state === 1 ? '#a38559' : COLORS.sand;
  ctx.fillRect(X + shake, Y, 256, 256);
  ctx.fillStyle = '#b39468';
  ctx.fillRect(X + shake, Y, 256, 24);
  ctx.strokeStyle = COLORS.sandDark;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(X + shake + 40, Y + 30);
  ctx.lineTo(X + shake + 100, Y + 120);
  ctx.lineTo(X + shake + 80, Y + 220);
  ctx.moveTo(X + shake + 180, Y + 26);
  ctx.lineTo(X + shake + 150, Y + 110);
  ctx.lineTo(X + shake + 210, Y + 190);
  if (state === 1) {
    ctx.moveTo(X + shake + 100, Y + 120);
    ctx.lineTo(X + shake + 150, Y + 110);
    ctx.moveTo(X + shake + 20, Y + 160);
    ctx.lineTo(X + shake + 120, Y + 200);
  }
  ctx.stroke();
}

function drawGate(ctx: CanvasRenderingContext2D, el: Element, open: boolean, remaining: number): void {
  const g = gateTile(el);
  const GX = g.x << 8;
  const GY = g.y << 8;
  const H = GATE_HEIGHT << 8;
  // Verbindung Schalter – Tor
  ctx.strokeStyle = open ? 'rgba(90, 209, 154, 0.35)' : 'rgba(255, 120, 100, 0.25)';
  ctx.lineWidth = 8;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  ctx.moveTo((el.x << 8) + 128, (el.y << 8) + 236);
  ctx.lineTo(GX + 128, GY + H / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Pfosten
  ctx.fillStyle = COLORS.metalDark;
  ctx.fillRect(GX + 8, GY, 26, H);
  ctx.fillRect(GX + 222, GY, 26, H);
  // Gitter: geschlossen ganz unten, offen oben zusammengeschoben
  const bars = open ? 40 : H;
  ctx.fillStyle = '#7d869f';
  for (let i = 0; i < 5; i++) ctx.fillRect(GX + 44 + i * 38, GY, 16, bars);
  ctx.fillStyle = '#5f6985';
  for (let k = 0; k * 128 < bars; k++) ctx.fillRect(GX + 34, GY + Math.min(bars - 16, k * 128 + 40), 188, 14);
  // Schalterplatte
  const SX = (el.x << 8) + SWITCH_BOX.dx;
  const SY = (el.y << 8) + SWITCH_BOX.dy;
  ctx.fillStyle = COLORS.metalDark;
  ctx.fillRect(SX - 8, SY + 22, SWITCH_BOX.w + 16, 20);
  ctx.fillStyle = open ? '#5ad19a' : '#e8503f';
  roundRect(ctx, SX + 10, open ? SY + 14 : SY, SWITCH_BOX.w - 20, open ? 12 : 26, 6);
  if (open && remaining > 0) {
    const total = GATE_DURATION[el.p[2]] ?? GATE_DURATION[1];
    ctx.fillStyle = 'rgba(90, 209, 154, 0.8)';
    ctx.fillRect(GX + 34, GY - 26, 188 * (remaining / total), 14);
  }
}

function drawScoutSight(ctx: CanvasRenderingContext2D, d: Dungeon, el: Element, state: number): void {
  const s = scoutSight(el, d);
  const y = (el.y << 8) + 128;
  ctx.strokeStyle = state === 1 ? 'rgba(255, 70, 70, 0.7)' : state === 2 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 240, 200, 0.16)';
  ctx.lineWidth = state === 1 ? 14 : 10;
  ctx.setLineDash([28, 22]);
  ctx.beginPath();
  ctx.moveTo(s.from, y);
  ctx.lineTo(s.to, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawScout(ctx: CanvasRenderingContext2D, el: Element, state: number): void {
  const X = el.x << 8;
  const Y = el.y << 8;
  const dir = scoutDir(el);
  ctx.fillStyle = COLORS.metalDark;
  ctx.fillRect(X + 92, Y + 170, 72, 86);
  ctx.fillStyle = '#58507a';
  roundRect(ctx, X + 52, Y + 40, 152, 140, 60);
  ctx.fillStyle = '#ffffff';
  circle(ctx, X + 128 + dir * 16, Y + 108, 44);
  ctx.fillStyle = state === 1 ? '#ff3b3b' : '#1a1f33';
  circle(ctx, X + 128 + dir * 34, Y + 108, 20);
  if (state === 1) {
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(X + 118, Y - 70, 20, 64);
    circle(ctx, X + 128, Y + 8, 11);
  }
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

// ------------------------------------------------------------------ Figuren

export function drawGuard(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number): void {
  ctx.save();
  ctx.translate(x + GUARD_W / 2, y + GUARD_H);
  ctx.scale(dir, 1);
  const s = Math.sin(x * 0.05) * 20;
  ctx.fillStyle = COLORS.mask;
  roundRect(ctx, -40 + s, -56, 32, 56, 10);
  roundRect(ctx, 8 - s, -56, 32, 56, 10);
  // Speer nach vorn
  ctx.strokeStyle = '#8c5b2f';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(-30, -120);
  ctx.lineTo(118, -150);
  ctx.stroke();
  ctx.fillStyle = '#c7cfdf';
  ctx.beginPath();
  ctx.moveTo(150, -157);
  ctx.lineTo(112, -170);
  ctx.lineTo(118, -138);
  ctx.closePath();
  ctx.fill();
  // Körper
  ctx.fillStyle = COLORS.guard;
  roundRect(ctx, -62, -176, 124, 126, 30);
  ctx.fillStyle = COLORS.guardDark;
  ctx.fillRect(-60, -96, 120, 16);
  // Kopf mit Helm
  ctx.fillStyle = COLORS.skin;
  circle(ctx, 4, -196, 40);
  ctx.fillStyle = COLORS.helmet;
  ctx.beginPath();
  ctx.arc(0, -200, 50, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-52, -204, 104, 14);
  ctx.fillStyle = COLORS.mask;
  ctx.fillRect(14, -190, 26, 9);
  ctx.restore();
}

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
  circle(ctx, 0, -206, 58);
  ctx.fillStyle = COLORS.skin;
  circle(ctx, 14, -200, 40);
  ctx.fillStyle = COLORS.mask;
  roundRect(ctx, -18, -222, 80, 26, 10);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(22, -216, 12, 13);
  ctx.fillRect(42, -216, 12, 13);
  ctx.restore();
}

// ------------------------------------------------------------------ Schlüssel und Truhe

export function drawKeys(ctx: CanvasRenderingContext2D, d: Dungeon, keys: number, t: number): void {
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
    ctx.beginPath();
    ctx.arc(-40, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.goldDark;
    circle(ctx, -40, 0, 12);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(-10, -10, 92, 20);
    ctx.fillRect(48, 6, 14, 26);
    ctx.fillRect(70, 6, 12, 18);
    ctx.strokeRect(-10, -10, 92, 20);
    ctx.restore();
  });
}

export function drawChest(ctx: CanvasRenderingContext2D, d: Dungeon, unlocked: boolean, open: boolean, t: number): void {
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
  ctx.fillStyle = COLORS.wood;
  ctx.fillRect(X, Y + 50, W, H - 50);
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(X, Y + 100, W, 8);
  ctx.fillRect(X, Y + 140, W, 8);
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
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(X + 18, Y + 50, 16, H - 50);
  ctx.fillRect(X + W - 34, Y + 50, 16, H - 50);
  ctx.fillStyle = unlocked || open ? '#fff2b0' : COLORS.goldDark;
  ctx.fillRect(X + W / 2 - 22, Y + 44, 44, 52);
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(X + W / 2 - 5, Y + 62, 10, 20);
}

// ------------------------------------------------------------------ Partikel und Hitboxen

export function drawParticles(ctx: CanvasRenderingContext2D, fx: Effects): void {
  for (const p of fx.items) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

/**
 * Trefferflächen: alle (all) oder nur die tödliche beim Tod (dead). Zusätzlich die Kacheln, die
 * Elemente gerade fest machen, und die Sammelflächen.
 */
export function drawHitboxes(ctx: CanvasRenderingContext2D, d: Dungeon, run: Run, shapes: Shape[], dead: boolean, all: boolean): void {
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
    ctx.strokeStyle = 'rgba(77, 225, 255, 0.5)';
    ctx.setLineDash([20, 16]);
    for (let i = 0; i < run.block.length; i++) if (run.block[i]) ctx.strokeRect((i % GRID_W) << 8, Math.floor(i / GRID_W) << 8, 256, 256);
    ctx.setLineDash([]);
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

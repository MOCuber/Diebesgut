export const RECT = 0;
export const CIRCLE = 1;

/**
 * Trefferfläche in SE.
 * Rechteck: (x, y) ist die linke obere Ecke, w × h die Größe.
 * Kreis: (x, y) ist der Mittelpunkt, w = h = Radius.
 * on: in diesem Tick tödlich. Eine ausgeschaltete Flamme bleibt als Fläche erhalten, damit
 * Grafik und Editor zwischen zwei Ticks dieselben Formen in derselben Reihenfolge sehen.
 */
export interface Shape {
  el: number;
  kind: number;
  x: number;
  y: number;
  w: number;
  h: number;
  on: boolean;
}

/** Wiederverwendbare Formenliste, damit ein Tick ohne neue Objekte auskommt. */
export class ShapeList {
  readonly items: Shape[] = [];
  count = 0;

  clear(): void {
    this.count = 0;
  }

  rect(el: number, x: number, y: number, w: number, h: number, on: boolean): void {
    const s = this.next();
    s.el = el;
    s.kind = RECT;
    s.x = x;
    s.y = y;
    s.w = w;
    s.h = h;
    s.on = on;
  }

  circle(el: number, x: number, y: number, r: number, on: boolean): void {
    const s = this.next();
    s.el = el;
    s.kind = CIRCLE;
    s.x = x;
    s.y = y;
    s.w = r;
    s.h = r;
    s.on = on;
  }

  private next(): Shape {
    if (this.count === this.items.length) this.items.push({ el: 0, kind: RECT, x: 0, y: 0, w: 0, h: 0, on: false });
    return this.items[this.count++];
  }
}

/** Überlappen sich zwei Rechtecke? Halboffen: bloße Berührung zählt nicht. */
export function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
}

/** Schneidet ein Kreis ein Rechteck? Über quadrierte Abstände, ohne Wurzel. */
export function circleHitsRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number): boolean {
  const nx = cx < x ? x : cx > x + w ? x + w : cx;
  const ny = cy < y ? y : cy > y + h ? y + h : cy;
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function shapeHitsRect(s: Shape, x: number, y: number, w: number, h: number): boolean {
  return s.kind === RECT ? rectsOverlap(s.x, s.y, s.w, s.h, x, y, w, h) : circleHitsRect(s.x, s.y, s.w, x, y, w, h);
}

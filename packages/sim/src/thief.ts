import type { Physics } from './constants';
import type { Dungeon } from './dungeon';
import { colSolid, rowSolid } from './terrain';
import { idiv } from './units';

/** Eingabe für genau einen Tick. pressed: neuer Druck seit dem letzten Tick. */
export interface TickInput {
  held: boolean;
  pressed: boolean;
}

export interface Thief {
  /** linke obere Ecke der Hitbox in SE */
  x: number;
  y: number;
  /** SE/Tick, > 0 heißt aufwärts */
  vy: number;
  dir: 1 | -1;
  ground: boolean;
  /** Wand, an der der Dieb in der Luft hängt: -1 links, 1 rechts, 0 keine */
  wall: -1 | 0 | 1;
  /** Tick des letzten eigenen Absprungs, -1 = keiner (eine Sprungfeder zählt nicht) */
  jumpTick: number;
  /** verbleibende Coyote-Ticks nach dem Verlassen einer Kante */
  coyote: number;
  /** verbleibende Ticks, in denen ein Tippen noch als Sprung zählt */
  buffer: number;
}

/** Dieb auf Kachel (tx, ty): mittig, Füße an der Unterkante der Kachel. */
export function createThief(d: Dungeon, ph: Physics, tx: number, ty: number, dir: 1 | -1): Thief {
  const th: Thief = {
    x: (tx << 8) + idiv(256 - ph.thiefW, 2),
    y: (ty << 8) + 256 - ph.thiefH,
    vy: 0,
    dir,
    ground: false,
    wall: 0,
    jumpTick: -1,
    coyote: 0,
    buffer: 0,
  };
  const bottom = th.y + ph.thiefH;
  if (rowSolid(d, bottom >> 8, th.x >> 8, (th.x + ph.thiefW - 1) >> 8)) {
    th.ground = true;
    th.coyote = ph.coyote;
  }
  return th;
}

/** Wandkontakt: Die Kachel direkt neben der Hitbox ist fest und der Abstand beträgt 0 SE. */
function touchingWall(d: Dungeon, th: Thief, ph: Physics, dir: number): boolean {
  const r0 = th.y >> 8;
  const r1 = (th.y + ph.thiefH - 1) >> 8;
  if (dir > 0) {
    const edge = th.x + ph.thiefW;
    return (edge & 255) === 0 && colSolid(d, edge >> 8, r0, r1);
  }
  return (th.x & 255) === 0 && colSolid(d, (th.x >> 8) - 1, r0, r1);
}

/** Schritte 1 bis 6 der verbindlichen Tick-Reihenfolge für den Dieb (t = laufender Tick). */
export function moveThief(d: Dungeon, th: Thief, ph: Physics, input: TickInput, t: number): void {
  const W = ph.thiefW;
  const H = ph.thiefH;

  // 1. Eingaben dieses Ticks übernehmen: ein neues Tippen landet im Eingabepuffer.
  if (input.pressed) th.buffer = ph.buffer;

  // 2. Sprung: am Boden oder in der Coyote-Zeit vom Boden, sonst in der Luft von der Wand.
  const canJump = th.ground || th.coyote > 0;
  if (!th.ground && th.coyote > 0) th.coyote--;
  if (th.buffer > 0) {
    if (canJump) {
      th.vy = ph.jumpVy;
      th.ground = false;
      th.coyote = 0;
      th.buffer = 0;
      th.jumpTick = t;
    } else if (th.wall !== 0) {
      th.vy = ph.wallJumpVy;
      th.dir = th.dir === 1 ? -1 : 1;
      th.wall = 0;
      th.buffer = 0;
      th.jumpTick = t;
    } else {
      th.buffer--;
    }
  }

  // 3. Sprungabbruch: losgelassen, Absprung mindestens minJumpTicks her und noch schnell.
  if (ph.variableJump !== 0 && !input.held && th.jumpTick >= 0 && t - th.jumpTick >= ph.minJumpTicks && th.vy > ph.releaseVy) {
    th.vy = ph.releaseVy;
  }

  // 4. Schwerkraft, danach Untergrenze (an der Wand langsamer rutschen).
  th.vy -= ph.gravity;
  const minVy = th.wall !== 0 ? -ph.wallSlide : -ph.maxFall;
  if (th.vy < minVy) th.vy = minVy;

  // 5. Horizontal bewegen, Kollision auflösen. Eine Wand am Boden heißt umdrehen.
  let x = th.x + th.dir * ph.runSpeed;
  const r0 = th.y >> 8;
  const r1 = (th.y + H - 1) >> 8;
  if (th.dir > 0) {
    const col = (x + W - 1) >> 8;
    if (colSolid(d, col, r0, r1)) x = (col << 8) - W;
  } else {
    const col = x >> 8;
    if (colSolid(d, col, r0, r1)) x = (col + 1) << 8;
  }
  th.x = x;
  if (touchingWall(d, th, ph, th.dir)) {
    if (th.ground) {
      th.dir = th.dir === 1 ? -1 : 1;
      th.wall = 0;
    } else {
      th.wall = th.dir;
    }
  } else {
    th.wall = 0;
  }

  // 6. Vertikal bewegen, Kollision auflösen. Eine Landung setzt vy := 0.
  const c0 = x >> 8;
  const c1 = (x + W - 1) >> 8;
  let y = th.y - th.vy;
  th.ground = false;
  if (th.vy < 0) {
    const row = (y + H - 1) >> 8;
    if (rowSolid(d, row, c0, c1)) {
      y = (row << 8) - H;
      th.vy = 0;
      th.ground = true;
    }
  } else if (th.vy > 0) {
    const row = y >> 8;
    if (rowSolid(d, row, c0, c1)) {
      y = (row + 1) << 8;
      th.vy = 0;
    }
  }
  th.y = y;
  if (th.ground) th.coyote = ph.coyote;
}

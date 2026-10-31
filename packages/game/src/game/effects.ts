/** Rein grafische Partikel in SE-Koordinaten. Gehören nicht zur Simulation. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
}

export class Effects {
  readonly items: Particle[] = [];

  burst(x: number, y: number, n: number, colors: readonly string[], speed: number, size: number, life: number, gravity = 0.9): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.items.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.3,
        life,
        max: life,
        size: size * (0.6 + Math.random() * 0.6),
        color: colors[i % colors.length],
        gravity,
      });
    }
  }

  /** Staubwolke an den Füßen, dir = Richtung, in die der Staub weht */
  dust(x: number, y: number, n: number, dir = 0): void {
    for (let i = 0; i < n; i++) {
      this.items.push({
        x: x + (Math.random() - 0.5) * 80,
        y,
        vx: dir * (1 + Math.random() * 3) + (Math.random() - 0.5) * 3,
        vy: -1 - Math.random() * 2.5,
        life: 260,
        max: 260,
        size: 18 + Math.random() * 16,
        color: '#8d96b5',
        gravity: 0,
      });
    }
  }

  /** dt in ms; Geschwindigkeiten in SE pro 1/60 s */
  update(dt: number): void {
    const k = dt / (1000 / 60);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * k;
      p.x += p.vx * k;
      p.y += p.vy * k;
    }
  }

  clear(): void {
    this.items.length = 0;
  }
}

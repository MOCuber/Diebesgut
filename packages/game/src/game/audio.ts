/**
 * Kleine Klangerzeugung mit Web Audio, ohne Dateien. Browser spielen erst nach einer ersten
 * Berührung Ton ab, deshalb schaltet unlock() den Ton beim Tipp auf „Los“ frei.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  unlock(): void {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private tone(from: number, to: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to > 0) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.buffer = buf;
    src.connect(gain).connect(this.master);
    src.start();
  }

  jump(): void {
    this.tone(330, 620, 0.09, 'square', 0.05);
  }

  wallJump(): void {
    this.tone(440, 880, 0.09, 'square', 0.05);
  }

  land(): void {
    this.tone(140, 90, 0.05, 'triangle', 0.06);
  }

  key(): void {
    this.tone(988, 0, 0.09, 'triangle', 0.09);
    this.tone(1319, 0, 0.14, 'triangle', 0.09, 0.07);
  }

  death(): void {
    this.noise(0.22, 0.18);
    this.tone(260, 70, 0.25, 'sawtooth', 0.06);
  }

  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0, 0.18, 'triangle', 0.09, i * 0.08));
  }
}

/** Haptik: navigator.vibrate gibt es in Chrome für Android, Safari auf dem iPhone kennt es nicht. */
export function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // nicht unterstützt
  }
}

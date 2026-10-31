import type { TickInput } from '@diebesgut/sim';

/**
 * Der Sprungfinger. Jede Berührung außerhalb der Knöpfe zählt, am PC auch Leertaste, Pfeil
 * nach oben und W. Ein Druck, der zwischen zwei Ticks beginnt und endet, geht nicht verloren:
 * pressed bleibt bis zum nächsten Tick gemerkt.
 */
export class JumpInput {
  private readonly pointers = new Set<number>();
  /** Finger, die schon beim Start des Laufs lagen; sie zählen erst nach dem Loslassen wieder. */
  private ignored = new Set<number>();
  private key = false;
  private keyIgnored = false;
  private pressed = false;
  private anyPress = false;
  /** wird bei jedem neuen Druck aufgerufen (Ton freischalten) */
  onPress?: () => void;

  pointerDown(id: number): void {
    if (this.pointers.has(id)) return;
    this.pointers.add(id);
    this.press();
  }

  pointerUp(id: number): void {
    this.pointers.delete(id);
    this.ignored.delete(id);
  }

  keyDown(): void {
    if (this.key) return;
    this.key = true;
    this.press();
  }

  keyUp(): void {
    this.key = false;
    this.keyIgnored = false;
  }

  private press(): void {
    this.pressed = true;
    this.anyPress = true;
    this.onPress?.();
  }

  get held(): boolean {
    for (const id of this.pointers) if (!this.ignored.has(id)) return true;
    return this.key && !this.keyIgnored;
  }

  /** held und pressed für genau diesen Tick. */
  consumeTick(): TickInput {
    const pressed = this.pressed;
    this.pressed = false;
    return { held: this.held, pressed };
  }

  /** Gab es seit dem letzten Aufruf einen Druck? (Todes-Effekt überspringen) */
  takePress(): boolean {
    const p = this.anyPress;
    this.anyPress = false;
    return p;
  }

  /** Neuer Lauf: Ein Lauf beginnt immer mit losgelassenem Finger. */
  resetForNewRun(): void {
    this.ignored = new Set(this.pointers);
    this.keyIgnored = this.key;
    this.pressed = false;
    this.anyPress = false;
  }

  /** App im Hintergrund oder Fenster verlassen: nichts bleibt hängen. */
  releaseAll(): void {
    this.pointers.clear();
    this.ignored.clear();
    this.key = false;
    this.keyIgnored = false;
  }
}

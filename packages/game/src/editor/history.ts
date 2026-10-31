import type { EdState } from './model';

/** Rückgängig und Wiederholen, unbegrenzt innerhalb der Sitzung: Jede Änderung ist ein Schritt. */
export class History {
  private past: EdState[] = [];
  private future: EdState[] = [];

  /** Vor einer Änderung den bisherigen Zustand ablegen. */
  push(before: EdState): void {
    this.past.push(before);
    this.future.length = 0;
  }

  undo(current: EdState): EdState | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(current);
    return prev;
  }

  redo(current: EdState): EdState | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(current);
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }
}

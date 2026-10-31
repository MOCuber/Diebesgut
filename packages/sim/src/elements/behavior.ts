import type { Dungeon, Element, Tile } from '../dungeon';
import type { ShapeList } from '../shapes';

/**
 * Verhalten eines Elementtyps. Periodische Elemente sind reine Funktionen des Ticks
 * (Zustand = f((t + Phase) mod Periode)), deshalb kann der Editor jeden Zeitpunkt sofort zeigen.
 * Reaktive Elemente (Späher, Bröckelboden, Tor) bekommen später dynSize Plätze in run.dyn.
 */
export interface ElementBehavior {
  readonly dynSize: number;
  /** Alle Kacheln, die das Element jemals gefährdet (Startschutz, Editor-Markierung). */
  footprint(el: Element, d: Dungeon, out: Tile[]): void;
  /** Bauregeln, die nur dieses Element betreffen (Befestigung, Pfad). */
  check?(el: Element, d: Dungeon, report: (msg: string) => void): void;
  /** Trefferflächen zum Tick t, in fester Reihenfolge. */
  shapes(el: Element, d: Dungeon, t: number, dyn: Int32Array, off: number, id: number, out: ShapeList): void;
}

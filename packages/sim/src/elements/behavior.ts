import type { Dungeon, Element, Tile } from '../dungeon';
import type { ShapeList } from '../shapes';
import type { Run } from '../step';

/**
 * Verhalten eines Elementtyps. Periodische Elemente sind reine Funktionen des Ticks
 * (Zustand = f((t + Phase) mod Periode)), deshalb kann der Editor jeden Zeitpunkt sofort zeigen.
 * Reaktive Elemente (Späher, Bröckelboden, Tor) haben dynSize Plätze in run.dyn und werden
 * Tick für Tick weitergerechnet.
 */
export interface ElementBehavior {
  readonly dynSize: number;
  /** Alle Kacheln, die das Element jemals gefährdet oder belegt (Startschutz, Editor-Markierung). */
  footprint(el: Element, d: Dungeon, out: Tile[]): void;
  /** Bauregeln, die nur dieses Element betreffen (Befestigung, Pfad). */
  check?(el: Element, d: Dungeon, report: (msg: string) => void): void;
  /** Anfangszustand in dyn bei Laufbeginn; ohne diese Funktion bleibt alles 0. */
  init?(el: Element, d: Dungeon, dyn: Int32Array, off: number): void;
  /** Schritt 7: Element auf Tick t setzen, reaktiven Zustand weiterrechnen, auf den Dieb wirken. */
  update?(el: Element, d: Dungeon, run: Run, t: number, off: number): void;
  /** Kacheln, die das Element gerade fest macht; gilt für die Bewegung im nächsten Tick. */
  blocks?(el: Element, dyn: Int32Array, off: number, block: Uint8Array): void;
  /** Trefferflächen zum Tick t, je Tick in gleicher Anzahl und Reihenfolge. */
  shapes?(el: Element, d: Dungeon, t: number, dyn: Int32Array, off: number, id: number, out: ShapeList): void;
}

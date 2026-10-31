import { seconds } from './format';
import type { RunLog } from './storage';

const STATUS: Record<RunLog['status'], string> = {
  running: 'läuft',
  dead: 'Tod',
  won: 'geschafft',
  timeout: 'Zeit um',
  abort: 'Abbruch',
};

/** Semikolon und Dezimalkomma, damit Excel und LibreOffice die Datei direkt richtig öffnen. */
export function runsToCsv(runs: RunLog[], revealBlind: (label: string) => string): string {
  const head = ['Zeit', 'Raum', 'Versuch', 'Ergebnis', 'Sekunden', 'Ticks', 'Schlüssel', 'Falle', 'Tod x', 'Tod y', 'Sprung', 'Blindtest', 'Tuning', 'Neustart ms'];
  const rows = runs.map((r) => [
    new Date(r.time).toISOString(),
    r.room,
    r.attempt,
    STATUS[r.status],
    seconds(r.ticks),
    r.ticks,
    r.keys,
    r.killer,
    r.deathX < 0 ? '' : r.deathX,
    r.deathY < 0 ? '' : r.deathY,
    r.blind ? revealBlind(r.blind) : r.jump,
    r.blind,
    r.tuned ? 'ja' : 'nein',
    r.restartMs < 0 ? '' : r.restartMs,
  ]);
  return [head, ...rows].map((row) => row.map(cell).join(';')).join('\r\n');
}

function cell(v: string | number): string {
  const s = String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Bietet einen Text als Datei zum Speichern an. */
export function download(name: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const blob = new Blob(['﻿', text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

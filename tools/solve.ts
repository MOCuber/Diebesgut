/**
 * npm run solve -- [Raum-Datei …]
 * Prüft mitgelieferte Level auf Lösbarkeit und Bauregeln und zeigt die schnellste gefundene Zeit.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
  DEFAULT_PHYSICS,
  GRID_H,
  GRID_W,
  ReplayInput,
  createRun,
  fromJson,
  solid,
  step,
  validate,
  verify,
  ELEMENT_INFO,
  type Dungeon,
  type DungeonJson,
} from '@diebesgut/sim';
import { solve } from './solver';

/** Raum mit dem Weg der Lösung: Ziffer = Anzahl gesammelter Schlüssel an dieser Stelle. */
function drawPath(d: Dungeon, toggles: number[], ticks: number): string {
  const grid: string[][] = [];
  for (let y = 0; y < GRID_H; y++) {
    grid.push([]);
    for (let x = 0; x < GRID_W; x++) grid[y].push(solid(d, x, y) ? '#' : ' ');
  }
  for (const el of d.elements) grid[el.y][el.x] = ELEMENT_INFO[el.type].name[0].toLowerCase();
  const run = createRun(d);
  const input = new ReplayInput(toggles);
  while (run.status === 'running' && run.tick < ticks) {
    step(d, run, input.at(run.tick + 1));
    const cx = (run.thief.x + 76) >> 8;
    const cy = (run.thief.y + 116) >> 8;
    if (grid[cy][cx] === ' ') grid[cy][cx] = String((run.keys & 1) + ((run.keys >> 1) & 1) + ((run.keys >> 2) & 1));
  }
  d.keys.forEach((k) => (grid[k.y][k.x] = 'K'));
  grid[d.chest.y][d.chest.x] = 'T';
  grid[d.start.y][d.start.x] = 'S';
  return grid.map((r) => '    ' + r.join('')).join('\n');
}

const files = process.argv.slice(2);
const targets = files.length > 0 ? files : ['raum1', 'raum2', 'raum3'].map((n) => `packages/content/rooms/${n}.json`);
let failed = false;

for (const file of targets) {
  const path = file.endsWith('.json') ? file : `packages/content/rooms/${file}.json`;
  const json = JSON.parse(readFileSync(path, 'utf8')) as DungeonJson;
  const d = fromJson(json);
  const problems = validate(d);
  const t0 = Date.now();
  const res = solve(d, { iterations: Number(process.env.ITER ?? 60000), seed: Number(process.env.SEED ?? 1) });
  const ms = Date.now() - t0;
  const name = `${basename(path)} („${d.name}“)`;
  if (problems.length > 0) {
    failed = true;
    console.log(`✗ ${name}: ${problems.length} Bauregel-Verstöße`);
    for (const p of problems) console.log(`    ${p.msg} (${p.x}, ${p.y})`);
  }
  if (!res.best) {
    failed = true;
    console.log(`✗ ${name}: keine Lösung gefunden, höchstens ${res.maxKeys} Schlüssel (${res.cells} Zellen, ${ms} ms)`);
    continue;
  }
  const check = verify(d, { phys: DEFAULT_PHYSICS, toggles: res.best.toggles, ticks: res.best.ticks });
  const seconds = (res.best.ticks / 60).toFixed(2);
  console.log(`✓ ${name}: geschafft in ${seconds} s (${res.best.ticks} Ticks, ${res.best.toggles.length / 2} Drücke, Nachspielen: ${check.status}, ${ms} ms)`);
  if (process.env.PATHS) console.log(drawPath(d, res.best.toggles, res.best.ticks));
}
process.exit(failed ? 1 : 0);

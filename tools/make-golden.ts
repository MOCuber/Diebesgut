/**
 * npm run golden            legt fehlende Golden Replays in tests/golden an
 * npm run golden -- --update  schreibt alle neu (nur nach einer gewollten Physikänderung,
 *                             zusammen mit einem höheren SIM_VERSION)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Recorder, fromJson, makeGolden, type DungeonJson, type GoldenReplay, type Physics, type TickInput } from '@diebesgut/sim';
import { solve } from './solver';

const DIR = 'tests/golden';
const update = process.argv.includes('--update');

function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Zufällige, aber stimmige Eingaben: Drücke mit zufälliger Haltedauer, auch Tippen innerhalb eines Ticks. */
function randomToggles(seed: number, ticks: number): number[] {
  const rnd = lcg(seed);
  const rec = new Recorder();
  let held = false;
  let left = 0;
  for (let t = 1; t <= ticks; t++) {
    let input: TickInput;
    if (left > 0) {
      left--;
      input = { held, pressed: false };
    } else if (held) {
      held = false;
      left = 2 + Math.floor(rnd() * 30);
      input = { held: false, pressed: false };
    } else if (rnd() < 0.15) {
      left = 1 + Math.floor(rnd() * 20);
      input = { held: false, pressed: true };
    } else {
      held = true;
      left = Math.floor(rnd() * 24);
      input = { held: true, pressed: true };
    }
    rec.add(t, input);
  }
  return rec.toggles;
}

// Zwei hängende Säulen aus Blöcken mit einem Schacht dazwischen, darunter durchgehender Boden.
const SHAFT_ROOM: DungeonJson = {
  name: 'Physik-Testraum',
  rows: [
    '..............',
    '..K........K..',
    '....##..##....',
    '....##..##....',
    '....##..##....',
    '....##..##....',
    '..............',
    'S......K.....T',
  ],
  elements: [],
};

const room = (id: string) => JSON.parse(readFileSync(`packages/content/rooms/${id}.json`, 'utf8')) as DungeonJson;
const goldens: GoldenReplay[] = [];

for (const id of ['raum1', 'raum2', 'raum3']) {
  const json = room(id);
  const sol = solve(fromJson(json), { iterations: 60000, seed: 1 }).best;
  if (sol) goldens.push(makeGolden(`${id}-loesung`, `Gefundene Lösung für „${json.name}“`, json, undefined, sol.toggles, sol.ticks));
  else console.warn(`Keine Lösung für ${id} gefunden`);
  for (const seed of [1, 2]) {
    goldens.push(makeGolden(`${id}-zufall-${seed}`, `Zufallseingaben, Seed ${seed}`, json, undefined, randomToggles(seed * 1000 + id.length, 3600), 3600));
  }
}

const variable: Partial<Physics> = { variableJump: 1 };
const tuned: Partial<Physics> = { runSpeed: 30, gravity: 4, jumpVy: 84, coyote: 3, buffer: 4, thiefW: 136, thiefH: 216 };
goldens.push(makeGolden('raum1-variabel', 'Variable Sprunghöhe (A/B-Variante)', room('raum1'), variable, randomToggles(77, 3600), 3600));
goldens.push(makeGolden('raum2-tuning', 'Geänderte Physik aus dem Tuning-Panel', room('raum2'), tuned, randomToggles(88, 3600), 3600));
for (const seed of [1, 2, 3]) {
  goldens.push(makeGolden(`physik-${seed}`, `Säulen, Schacht und Walljumps, Seed ${seed}`, SHAFT_ROOM, undefined, randomToggles(seed * 31, 3600), 3600));
}
goldens.push(makeGolden('physik-umdrehen', 'Umdrehen an Wänden wie im ursprünglichen Spielkonzept', SHAFT_ROOM, { wallTurn: 1 }, randomToggles(97, 3600), 3600));
const allElements = JSON.parse(readFileSync('tests/fixtures/alle-elemente.json', 'utf8')) as DungeonJson;
// Der weiteste Lauf der Suche kommt an vielen Elementen vorbei, auch ohne den Raum zu schaffen.
const deep = solve(fromJson(allElements), { iterations: 60000, seed: 5 }).deepest;
goldens.push(makeGolden('alle-weit', 'Alle 14 Elemente, weitester Lauf der Suche', allElements, undefined, deep.toggles, deep.ticks));
for (const seed of [1, 2, 3, 4]) {
  goldens.push(makeGolden(`alle-${seed}`, `Alle 14 Elemente, Zufallseingaben, Seed ${seed}`, allElements, undefined, randomToggles(seed * 53 + 7, 3600), 3600));
}

/** JSON mit Einrückung, Zahlenlisten aber in einer Zeile. */
function format(g: GoldenReplay): string {
  return JSON.stringify(g, null, 2).replace(/\[\s*(-?\d+(?:,\s*-?\d+)*)\s*\]/g, (_, list: string) => `[${list.split(/,\s*/).join(', ')}]`) + '\n';
}

mkdirSync(DIR, { recursive: true });
let written = 0;
for (const g of goldens) {
  const path = `${DIR}/${g.name}.json`;
  if (existsSync(path) && !update) continue;
  writeFileSync(path, format(g));
  written++;
  console.log(`${path}: ${g.expect.status} nach ${g.ticks} Ticks, ${g.toggles.length} Wechsel`);
}
console.log(written ? `${written} Golden Replays geschrieben.` : 'Alle Golden Replays sind schon da (--update überschreibt).');

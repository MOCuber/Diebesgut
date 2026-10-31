# Diebesgut – Solo-Testversion

Ein-Finger-Plattformer fürs Handy: Fallen-Dungeons bauen und knacken. Spielkonzept und Plan der
Solo-Testversion liegen als PDFs nur lokal im Projektordner und gehören nicht zum Repository.

Zum Spielen: <https://mocuber.github.io/Diebesgut/>

Die Solo-Testversion ist eine reine Offline-Web-App (PWA) in TypeScript. Derselbe Sim-Kern trägt später
auch den Server.

## Stand: Meilenstein S0 „Laufgefühl“

| Teil | Inhalt |
| --- | --- |
| Sim-Kern | Ganzzahl-Physik exakt nach Spielkonzept (Sprung 3,23 / 1,77 Kacheln, Walljump 2,71, Coyote 5, Puffer 6), verbindliche Tick-Reihenfolge, Zustands-Hash alle 60 Ticks, kanonische Kodierung mit SHA-256, Bauregeln, Replays |
| 4 Fallen | Stacheln, Säge, Schienensäge, Flammendüse; alle 13 Elementtypen sind schon nummeriert |
| 3 Testräume | „Erste Schritte“, „Sägewerk“, „Feuerprobe“, jeweils vom Löser als schaffbar bewiesen |
| Spiel | Touch und Leertaste, 60 Ticks/s mit Interpolation, Sofort-Neustart (0,25 s Effekt, Tippen überspringt), Timer, Schlüssel, Truhe, Bestzeiten |
| Tuning-Panel | Alle Physikwerte am Handy einstellen, abgeleitete Sprungwerte live, feste oder variable Sprunghöhe, A/B-Blindtest |
| Hitbox-Anzeige | Umschaltbar; beim Tod immer kurz die tödliche Fläche |
| Messen | Letzte 500 Läufe in IndexedDB, Statistik pro Raum und Variante, CSV-Export für den Playtest-Plan |
| Golden Replays | 14 Replays mit erwarteten Hashes; Selbsttest-Bildschirm prüft sie auf dem Gerät |
| Web-App | Installierbar, offline nach dem ersten Laden, „Bitte drehen“ im Hochformat |

Abschlusskriterium S0: Du spielst 15 Minuten freiwillig weiter.

## Loslegen

```bash
npm install
npm run dev
```

Der Entwicklungsserver zeigt zwei Adressen. `Local` öffnet das Spiel am PC, die `Network`-Adresse öffnet es
auf dem Handy im selben WLAN. Offline-Betrieb und Installation gibt es nur im fertigen Build:

```bash
npm run build
npm run preview
```

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver, auch im WLAN erreichbar |
| `npm test` | Sim-Tests und Golden Replays |
| `npm run check` | Lint, Typprüfung und Tests zusammen |
| `npm run solve` | Prüft die Testräume auf Bauregeln und Lösbarkeit (`PATHS=1` zeigt den Weg) |
| `npm run golden` | Legt fehlende Golden Replays an; `-- --update` nimmt alle neu auf |
| `npm run icons` | Zeichnet die App-Icons neu |

Am PC: Leertaste, Pfeil hoch oder W springt. R startet neu, H schaltet Hitboxen, T öffnet das Tuning, Esc
führt zurück.

## Projektaufbau

```
packages/
  sim/        Deterministische Simulation, kein DOM, keine Abhängigkeiten
    src/units.ts       SE, Ticks, idiv(), Sinustabelle
    src/constants.ts   Physikwerte, Bauregeln, SIM_VERSION
    src/dungeon.ts     Datentyp, Prüfung, kanonische Kodierung, Hash, JSON-Format
    src/elements/      eine Datei pro Element: Trefferflächen zum Tick t
    src/thief.ts       Bewegung, Sprung, Walljump, Kollision
    src/step.ts        Tick-Reihenfolge aus dem Spielkonzept
    src/replay.ts      Fingerwechsel, Nachspielen, Binärform
    src/golden.ts      Golden-Replay-Format
  game/       Web-App: Schleife, Eingabe, Grafik, Menüs, Speicher (Preact, Canvas 2D)
  content/    Mitgelieferte Level als JSON
tests/golden/ Golden Replays mit erwarteten Hashes
tools/        Löser, Golden-Generator, Icon-Generator
```

## Regeln für den Sim-Kern

ESLint erzwingt sie in `packages/sim/src`: nur ganze Zahlen, Division nur über `idiv()`, kein `Math.random`,
keine Uhr, von `Math` nur `abs`, `min`, `max`, `sign`, `trunc` und `imul`, Iteration nur über Arrays.

Jede gewollte Physikänderung erhöht `SIM_VERSION` in `packages/sim/src/constants.ts`. Danach die Golden
Replays mit `npm run golden -- --update` neu aufnehmen. Weicht ein Golden Replay ohne Absicht ab, rechnet
die Simulation anders als vorher.

## Veröffentlichen

`.github/workflows/pages.yml` baut bei jedem Push auf `main` und veröffentlicht auf GitHub Pages. Dafür in
den Repository-Einstellungen unter *Pages* als Quelle „GitHub Actions“ wählen; mit einem kostenlosen
GitHub-Konto geht das nur bei einem öffentlichen Repository. Die Versionsnummer im Menü zeigt den Commit.

## Nächster Meilenstein

S1 „Festungs-Editor“: Raster mit Lupe und Zoom, alle 13 Elemente, Eigenschaften, Live-Prüfung, Zeitleiste,
Rückgängig, Test- und Beweislauf.

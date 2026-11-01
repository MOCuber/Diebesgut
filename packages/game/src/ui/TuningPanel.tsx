import { DEFAULT_PHYSICS, PHYSICS_LIMITS, type Physics } from '@diebesgut/sim';
import { num } from '../format';
import type { BlindTest } from '../storage';
import { TUNING_PARAMS, effectivePhysics, jumpStats, newBlindTest } from '../tuning';

interface Props {
  tuning: Physics;
  blind: BlindTest | null;
  onTuning(t: Physics): void;
  onBlind(b: BlindTest | null): void;
  onClose(): void;
}

/** Physik direkt am Handy einstellen. Jede Änderung startet den Lauf neu. */
export function TuningPanel({ tuning, blind, onTuning, onBlind, onClose }: Props) {
  const stats = jumpStats(effectivePhysics(tuning, blind));
  const set = (key: keyof Physics, value: number) => {
    const [lo, hi] = PHYSICS_LIMITS[key];
    onTuning({ ...tuning, [key]: Math.min(hi, Math.max(lo, value)) });
  };

  return (
    <div class="panel" role="dialog" aria-label="Tuning">
      <div class="panel-head">
        <h2>Tuning</h2>
        <button class="btn small" onClick={onClose}>
          Fertig
        </button>
      </div>

      <div class="stats-grid">
        <span>Voller Sprung</span>
        <b>
          {num(stats.fullHeight)} hoch · {num(stats.fullWidth, 1)} weit
        </b>
        {stats.minHeight !== stats.fullHeight && (
          <>
            <span>Kürzester Sprung</span>
            <b>
              {num(stats.minHeight)} hoch · {num(stats.minWidth, 1)} weit
            </b>
          </>
        )}
        <span>Walljump</span>
        <b>{num(stats.wallHeight)} hoch</b>
        <span>Laufen / Fallen / Rutschen</span>
        <b>
          {num(stats.runSpeed, 1)} / {num(stats.maxFall, 1)} / {num(stats.wallSlide, 1)} F/s
        </b>
      </div>
      <p class="panel-note">Werte in Feldern bzw. Feldern pro Sekunde (F/s). 1 Feld = 256 SE, ein Block = 2 × 2 Felder, 1 Tick = 1/60 s.</p>

      <section class="panel-section">
        <h3>Sprunghöhe</h3>
        {blind ? (
          <div class="blind">
            <div class="seg">
              {([1, 2] as const).map((v) => (
                <button key={v} class={`btn small ${blind.current === v ? 'primary' : ''}`} onClick={() => onBlind({ ...blind, current: v })}>
                  Variante {v}
                  {blind.revealed ? ` (${blind.map[v - 1] ? 'variabel' : 'fest'})` : ''}
                </button>
              ))}
            </div>
            <div class="seg">
              {!blind.revealed && (
                <button class="btn small" onClick={() => onBlind({ ...blind, revealed: true })}>
                  Auflösen
                </button>
              )}
              <button class="btn small" onClick={() => onBlind(null)}>
                Blindtest beenden
              </button>
            </div>
            <p class="panel-note">Spiele je 3 Räume mit beiden Varianten. Welche variabel ist, bleibt verdeckt, bis du auflöst.</p>
          </div>
        ) : (
          <>
            <div class="seg">
              <button class={`btn small ${tuning.variableJump ? '' : 'primary'}`} onClick={() => set('variableJump', 0)}>
                Fest (Standard)
              </button>
              <button class={`btn small ${tuning.variableJump ? 'primary' : ''}`} onClick={() => set('variableJump', 1)}>
                Variabel (halten = höher)
              </button>
            </div>
            <button class="btn small" onClick={() => onBlind(newBlindTest())}>
              A/B-Blindtest starten
            </button>
          </>
        )}
      </section>

      <section class="panel-section">
        <h3>An der Wand</h3>
        <div class="seg">
          <button class={`btn small ${tuning.wallTurn ? '' : 'primary'}`} onClick={() => set('wallTurn', 0)}>
            Stehen bleiben
          </button>
          <button class={`btn small ${tuning.wallTurn ? 'primary' : ''}`} onClick={() => set('wallTurn', 1)}>
            Umdrehen (Spielkonzept)
          </button>
        </div>
        <p class="panel-note">Beim Stehenbleiben kommst du per Sprung und Walljump weg, oder ein Prallbrett drückt dich zurück.</p>
      </section>

      <section class="panel-section">
        <h3>Physik</h3>
        {TUNING_PARAMS.map((p) => {
          const v = tuning[p.key];
          const changed = v !== DEFAULT_PHYSICS[p.key];
          const [lo, hi] = PHYSICS_LIMITS[p.key];
          return (
            <div class={`param ${changed ? 'changed' : ''}`} key={p.key}>
              <span class="param-label">
                {p.label}
                <small>
                  {p.unit}
                  {changed ? ` · Standard ${DEFAULT_PHYSICS[p.key]}` : ''}
                </small>
              </span>
              <button class="step" disabled={v <= lo} onClick={() => set(p.key, v - p.step)} aria-label={`${p.label} verringern`}>
                −
              </button>
              <span class="param-value">{v}</span>
              <button class="step" disabled={v >= hi} onClick={() => set(p.key, v + p.step)} aria-label={`${p.label} erhöhen`}>
                +
              </button>
            </div>
          );
        })}
        <button class="btn small" onClick={() => onTuning({ ...DEFAULT_PHYSICS })}>
          Alles auf Standard
        </button>
      </section>
    </div>
  );
}

export function StartScreen({ onGo }: { onGo: () => void }) {
  return (
    <div class="screen start">
      <div class="logo" aria-hidden="true">
        <svg viewBox="0 0 120 120" width="96" height="96">
          <circle cx="60" cy="60" r="56" fill="#161c33" stroke="#ffd04d" stroke-width="4" />
          <circle cx="44" cy="60" r="16" fill="none" stroke="#ffd04d" stroke-width="9" />
          <path d="M60 60h38M84 60v14M96 60v10" stroke="#ffd04d" stroke-width="9" stroke-linecap="round" />
        </svg>
      </div>
      <h1>Diebesgut</h1>
      <p class="sub">Solo-Testversion · S1 „Festungs-Editor“</p>
      <button class="btn primary big" onClick={onGo}>
        Los
      </button>
      <p class="hint">Ein Finger: Tippen springt, an der Wand ist es ein Walljump. Am PC geht auch die Leertaste.</p>
    </div>
  );
}

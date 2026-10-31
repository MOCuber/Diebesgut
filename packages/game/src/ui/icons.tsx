// Kleine Strich-Icons für die Spielleiste.

const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2.2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const;

export const IconBack = () => (
  <svg {...base} aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const IconRestart = () => (
  <svg {...base} aria-hidden="true">
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v5h5" />
  </svg>
);

export const IconHitbox = () => (
  <svg {...base} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 3" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconTuning = () => (
  <svg {...base} aria-hidden="true">
    <path d="M5 6h14M5 12h14M5 18h14" />
    <circle cx="9" cy="6" r="2" fill="currentColor" />
    <circle cx="15" cy="12" r="2" fill="currentColor" />
    <circle cx="8" cy="18" r="2" fill="currentColor" />
  </svg>
);

export const IconKey = ({ on }: { on: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" class={on ? 'key on' : 'key'}>
    <circle cx="7" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2.6" />
    <path d="M11.5 12H21M17 12v4M20 12v3" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
  </svg>
);

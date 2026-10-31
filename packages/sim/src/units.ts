/**
 * Einheiten und Ganzzahl-Arithmetik des Sim-Kerns.
 *
 * 1 Kachel = 256 Subeinheiten (SE), 1 Tick = 1/60 s.
 * x wächst nach rechts, y nach unten. Geschwindigkeiten in SE pro Tick, vy > 0 heißt aufwärts.
 */

export const SE_PER_TILE = 256;
export const TILE_SHIFT = 8;
export const TICKS_PER_SECOND = 60;

/** Ganzzahl-Division, rundet Richtung 0. Exakt für |a| < 2^53. */
export function idiv(a: number, b: number): number {
  // eslint-disable-next-line no-restricted-syntax -- die einzige Division im Sim-Kern
  return Math.trunc(a / b);
}

/** Rest mit Ergebnis in [0, b) für b > 0. */
export function imod(a: number, b: number): number {
  const r = a % b;
  // + 0 macht aus -0 (etwa bei -10 % 5) eine echte 0
  return r < 0 ? r + b : r + 0;
}

/** Kachel einer SE-Koordinate, rundet ab (auch für negative Werte). */
export function tileOf(se: number): number {
  return se >> TILE_SHIFT;
}

/** Winkel werden in 1/1024 Umdrehungen gemessen, sin und cos mit SIN_ONE skaliert. */
export const ANGLE_STEPS = 1024;
export const SIN_ONE = 16384;

// Viertelwelle round(16384 · sin(π/2 · i/256)) für i = 0…256. Fest eingebaut, weil
// Math.sin zwischen Engines abweichen darf.
const QUARTER: readonly number[] = [
  0, 101, 201, 302, 402, 503, 603, 704, 804, 904, 1005, 1105, 1205, 1306, 1406, 1506,
  1606, 1706, 1806, 1906, 2006, 2105, 2205, 2305, 2404, 2503, 2603, 2702, 2801, 2900, 2999, 3098,
  3196, 3295, 3393, 3492, 3590, 3688, 3786, 3883, 3981, 4078, 4176, 4273, 4370, 4467, 4563, 4660,
  4756, 4852, 4948, 5044, 5139, 5235, 5330, 5425, 5520, 5614, 5708, 5803, 5897, 5990, 6084, 6177,
  6270, 6363, 6455, 6547, 6639, 6731, 6823, 6914, 7005, 7096, 7186, 7276, 7366, 7456, 7545, 7635,
  7723, 7812, 7900, 7988, 8076, 8163, 8250, 8337, 8423, 8509, 8595, 8680, 8765, 8850, 8935, 9019,
  9102, 9186, 9269, 9352, 9434, 9516, 9598, 9679, 9760, 9841, 9921, 10001, 10080, 10159, 10238, 10316,
  10394, 10471, 10549, 10625, 10702, 10778, 10853, 10928, 11003, 11077, 11151, 11224, 11297, 11370, 11442, 11514,
  11585, 11656, 11727, 11797, 11866, 11935, 12004, 12072, 12140, 12207, 12274, 12340, 12406, 12472, 12537, 12601,
  12665, 12729, 12792, 12854, 12916, 12978, 13039, 13100, 13160, 13219, 13279, 13337, 13395, 13453, 13510, 13567,
  13623, 13678, 13733, 13788, 13842, 13896, 13949, 14001, 14053, 14104, 14155, 14206, 14256, 14305, 14354, 14402,
  14449, 14497, 14543, 14589, 14635, 14680, 14724, 14768, 14811, 14854, 14896, 14937, 14978, 15019, 15059, 15098,
  15137, 15175, 15213, 15250, 15286, 15322, 15357, 15392, 15426, 15460, 15493, 15525, 15557, 15588, 15619, 15649,
  15679, 15707, 15736, 15763, 15791, 15817, 15843, 15868, 15893, 15917, 15941, 15964, 15986, 16008, 16029, 16049,
  16069, 16088, 16107, 16125, 16143, 16160, 16176, 16192, 16207, 16221, 16235, 16248, 16261, 16273, 16284, 16295,
  16305, 16315, 16324, 16332, 16340, 16347, 16353, 16359, 16364, 16369, 16373, 16376, 16379, 16381, 16383, 16384,
  16384,
];

/** sin(Winkel) · SIN_ONE, Winkel in 1/1024 Umdrehungen (beliebiges Vorzeichen). */
export function isin(angle: number): number {
  const i = angle & (ANGLE_STEPS - 1);
  const r = i & 255;
  switch (i >> 8) {
    case 0:
      return QUARTER[r];
    case 1:
      return QUARTER[256 - r];
    case 2:
      return 0 - QUARTER[r];
    default:
      return 0 - QUARTER[256 - r];
  }
}

/** cos(Winkel) · SIN_ONE. */
export function icos(angle: number): number {
  return isin(angle + 256);
}

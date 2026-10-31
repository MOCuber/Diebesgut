import type { ElementBehavior } from './behavior';

// Säge: statisch, Trefferkreis Ø 1,2 Kacheln, Mittelpunkt in der Kachelmitte.

export const SAW_RADIUS = 154;
/** Grafik rund 15 % größer als die Trefferfläche. */
export const SAW_DRAW_RADIUS = 180;

export const saw: ElementBehavior = {
  dynSize: 0,

  footprint(el, _d, out) {
    out.push({ x: el.x, y: el.y });
  },

  shapes(el, _d, _t, _dyn, _off, id, out) {
    out.circle(id, (el.x << 8) + 128, (el.y << 8) + 128, SAW_RADIUS, true);
  },
};

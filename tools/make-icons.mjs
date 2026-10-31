// npm run icons — zeichnet die App-Icons (goldener Schlüssel) ohne Abhängigkeiten als PNG.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [22, 28, 51];
const GOLD = [255, 208, 77];
const OUT = 'packages/game/public';

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Schlüssel in Einheiten 0…1, Mitte bei (0.5, 0.5). */
function inKey(x, y) {
  const dx = x - 0.33;
  const dy = y - 0.5;
  const d = Math.hypot(dx, dy);
  if (d <= 0.17 && d >= 0.085) return true;
  if (x >= 0.47 && x <= 0.85 && Math.abs(y - 0.5) <= 0.045) return true;
  if (x >= 0.69 && x <= 0.76 && y >= 0.5 && y <= 0.65) return true;
  if (x >= 0.79 && x <= 0.85 && y >= 0.5 && y <= 0.6) return true;
  return false;
}

function inRoundedSquare(x, y, r) {
  const qx = Math.max(Math.abs(x - 0.5) - (0.5 - r), 0);
  const qy = Math.max(Math.abs(y - 0.5) - (0.5 - r), 0);
  return qx * qx + qy * qy <= r * r;
}

function render(size, { rounded, keyScale }) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let gold = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const inside = rounded ? inRoundedSquare(x, y, 0.2) : true;
          if (!inside) continue;
          const kx = 0.5 + (x - 0.5) / keyScale;
          const ky = 0.5 + (y - 0.5) / keyScale;
          if (inKey(kx, ky)) gold++;
          else bg++;
        }
      }
      const n = SS * SS;
      const a = (bg + gold) / n;
      const i = (py * size + px) * 4;
      if (a === 0) continue;
      const g = gold / (bg + gold);
      for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(BG[c] * (1 - g) + GOLD[c] * g);
      rgba[i + 3] = Math.round(a * 255);
    }
  }
  return png(size, rgba);
}

const icons = [
  ['icon-192.png', 192, { rounded: true, keyScale: 0.95 }],
  ['icon-512.png', 512, { rounded: true, keyScale: 0.95 }],
  // maskable: vollflächig, Schlüssel innerhalb der sicheren Zone (80 %)
  ['icon-maskable-512.png', 512, { rounded: false, keyScale: 0.72 }],
  // iOS füllt Transparenz schwarz, deshalb vollflächig
  ['apple-touch-icon.png', 180, { rounded: false, keyScale: 0.85 }],
];

for (const [name, size, opts] of icons) {
  writeFileSync(`${OUT}/${name}`, render(size, opts));
  console.log(`${OUT}/${name} (${size}×${size})`);
}

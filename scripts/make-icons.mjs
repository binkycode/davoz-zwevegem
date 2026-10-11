// Draws the app icons (orange volleyball on navy, same artwork as the favicon) as PNG files
// for the web app manifest and iOS. No dependencies: shapes are rasterised by distance.
// Usage: node scripts/make-icons.mjs   → site/icons/*.png

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'site', 'icons');
const NAVY = [0x0B, 0x1B, 0x2E];
const ORANGE = [0xFF, 0x7A, 0x1A];

// Ball artwork in the favicon's 40×40 coordinate system.
const CIRCLE = { cx: 20, cy: 20, r: 17 };
const CURVES = [
  [[20, 3], [18, 11], [20, 19], [28, 25]],
  [[5, 26], [13, 23], [21, 24], [27, 32]],
  [[33, 9], [26, 11], [21, 16], [20, 23]]
];
const STROKE = 2.6;

const bezier = ([p0, p1, p2, p3], t) => {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
};
const SEGMENTS = CURVES.flatMap((c) => {
  const pts = Array.from({ length: 49 }, (_, i) => bezier(c, i / 48));
  return pts.slice(1).map((p, i) => [pts[i], p]);
});

function segDist([x, y], [[ax, ay], [bx, by]]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

// `ballSize`: share of the icon width the ball covers (smaller for maskable icons' safe zone).
function draw(size, ballSize) {
  const scale = (size * ballSize) / 40;
  const offset = (size - size * ballSize) / 2;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = [(x + 0.5 - offset) / scale, (y + 0.5 - offset) / scale];
      let d = Math.abs(Math.hypot(p[0] - CIRCLE.cx, p[1] - CIRCLE.cy) - CIRCLE.r);
      for (const s of SEGMENTS) d = Math.min(d, segDist(p, s));
      // Anti-aliased edge: coverage over one device pixel.
      const cover = Math.max(0, Math.min(1, (STROKE / 2 - d) * scale + 0.5));
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(NAVY[c] + (ORANGE[c] - NAVY[c]) * cover);
      px[i + 3] = 255;
    }
  }
  return png(size, size, px);
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

await mkdir(outDir, { recursive: true });
const icons = [
  ['icon-192.png', 192, 0.74],
  ['icon-512.png', 512, 0.74],
  ['icon-maskable-512.png', 512, 0.58],
  ['apple-touch-icon.png', 180, 0.7]
];
for (const [file, size, ball] of icons) {
  await writeFile(resolve(outDir, file), draw(size, ball));
  console.log(`site/icons/${file}`);
}

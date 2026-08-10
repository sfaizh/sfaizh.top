#!/usr/bin/env node
/**
 * Draws the site icon: a terminal prompt — Catppuccin green chevron, rosewater
 * block cursor, on the Mocha base.
 *
 * Written by hand rather than pulled in from a design tool so the icon is
 * reproducible, reviewable in a diff, and locked to the same palette as the
 * rest of the site. No dependencies: PNG is assembled from `zlib.deflateSync`,
 * and ICO is a container around those PNGs.
 *
 *   node tools/scripts/generate-favicon.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '../../apps/blog/src/app');

// ── palette (Catppuccin Mocha) ───────────────────────────────────────────────
const BASE = [0x1e, 0x1e, 0x2e];
const GREEN = [0xa6, 0xe3, 0xa1];
const ROSEWATER = [0xf5, 0xe0, 0xdc];

// ── geometry, in a 0..1 square ───────────────────────────────────────────────
const CORNER_RADIUS = 0.2;
const CHEVRON = {
  points: [
    [0.3, 0.29],
    [0.53, 0.5],
    [0.3, 0.71],
  ],
  halfWidth: 0.068,
};
const CURSOR = { x0: 0.6, x1: 0.8, y0: 0.6, y1: 0.72 };

/** Distance from a point to a line segment. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const length = bax * bax + bay * bay;
  const h = length === 0 ? 0 : Math.min(1, Math.max(0, (pax * bax + pay * bay) / length));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

/** Signed-distance test for the rounded background square. */
function insideRoundedSquare(x, y, radius) {
  const dx = Math.abs(x - 0.5) - (0.5 - radius);
  const dy = Math.abs(y - 0.5) - (0.5 - radius);
  if (dx <= 0 || dy <= 0) return Math.max(dx, dy) <= 0;
  return Math.hypot(dx, dy) <= radius;
}

/** The colour at a point, or null where the icon is transparent. */
function sample(x, y) {
  if (!insideRoundedSquare(x, y, CORNER_RADIUS)) return null;

  if (x >= CURSOR.x0 && x <= CURSOR.x1 && y >= CURSOR.y0 && y <= CURSOR.y1) {
    return ROSEWATER;
  }

  const [a, b, c] = CHEVRON.points;
  const onChevron =
    distanceToSegment(x, y, a[0], a[1], b[0], b[1]) <= CHEVRON.halfWidth ||
    distanceToSegment(x, y, b[0], b[1], c[0], c[1]) <= CHEVRON.halfWidth;

  return onChevron ? GREEN : BASE;
}

/** Render to RGBA, supersampling 4×4 per pixel for antialiasing. */
function render(size) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let hits = 0;

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const colour = sample(
            (x + (sx + 0.5) / samples) / size,
            (y + (sy + 0.5) / samples) / size
          );
          if (!colour) continue;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          hits++;
        }
      }

      const total = samples * samples;
      const offset = (y * size + x) * 4;
      if (hits === 0) continue;

      pixels[offset] = Math.round(r / hits);
      pixels[offset + 1] = Math.round(g / hits);
      pixels[offset + 2] = Math.round(b / hits);
      pixels[offset + 3] = Math.round((hits / total) * 255);
    }
  }

  return pixels;
}

// ── PNG ──────────────────────────────────────────────────────────────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  // Each scanline is prefixed with its filter type; 0 means "none".
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** ICO is a directory of images; PNG payloads are valid entries. */
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // palette size
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32BE(0, 8);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

// ── SVG, for browsers that prefer a vector ───────────────────────────────────
function encodeSvg() {
  const hex = (rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  const [a, b, c] = CHEVRON.points;
  const scale = (n) => +(n * 32).toFixed(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <title>sfaizh.top</title>
  <rect width="32" height="32" rx="${scale(CORNER_RADIUS)}" fill="${hex(BASE)}"/>
  <path d="M${scale(a[0])} ${scale(a[1])} L${scale(b[0])} ${scale(b[1])} L${scale(c[0])} ${scale(c[1])}"
        fill="none" stroke="${hex(GREEN)}" stroke-width="${scale(CHEVRON.halfWidth * 2)}"
        stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="${scale(CURSOR.x0)}" y="${scale(CURSOR.y0)}"
        width="${scale(CURSOR.x1 - CURSOR.x0)}" height="${scale(CURSOR.y1 - CURSOR.y0)}"
        rx="1" fill="${hex(ROSEWATER)}"/>
</svg>
`;
}

async function main() {
  const icoSizes = [16, 32, 48];
  const ico = encodeIco(
    icoSizes.map((size) => ({ size, png: encodePng(size, render(size)) }))
  );
  await writeFile(join(appDir, 'favicon.ico'), ico);

  // Home-screen icon for iOS, which ignores SVG and ICO.
  const apple = encodePng(180, render(180));
  await writeFile(join(appDir, 'apple-icon.png'), apple);

  await writeFile(join(appDir, 'icon.svg'), encodeSvg(), 'utf8');

  console.log(`[favicon] favicon.ico    ${icoSizes.join('/')}px, ${ico.length} bytes`);
  console.log(`[favicon] apple-icon.png 180px, ${apple.length} bytes`);
  console.log(`[favicon] icon.svg       vector`);
}

main().catch((error) => {
  console.error('[favicon] generation failed');
  console.error(error);
  process.exitCode = 1;
});

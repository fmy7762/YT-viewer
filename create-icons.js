/**
 * Generates icons/icon-192.png and icons/icon-512.png
 * using only Node.js built-in modules (no external deps).
 * Run: node create-icons.js
 */
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = path.join(__dirname, 'icons');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);

// ── CRC32 ──────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── PNG chunk ──────────────────────────────────
function chunk(type, data) {
  const tb  = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([tb, data]);
  const crc  = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }

// ── Draw icon pixels ───────────────────────────
//   Red background + white rounded-rect YouTube logo
function makePixels(size) {
  const pixels = Buffer.alloc(size * size * 4); // RGBA

  const cx = size / 2, cy = size / 2;
  const rr = size * 0.18; // rounded rect half-width
  const rh = size * 0.13; // rounded rect half-height
  const radius = size * 0.04;

  // Triangle (play button) dimensions
  const tw = size * 0.14, th = size * 0.18;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - cx, dy = y - cy;

      // Background: solid red circle
      const dist = Math.sqrt(dx * dx + dy * dy);
      const inCircle = dist < size * 0.46;

      // White rounded rectangle (YouTube logo box)
      const inRect = inRoundedRect(dx, dy, rr, rh, radius);

      // Play triangle (red, inside the white rect)
      const inTri = inTriangle(dx, dy, tw, th);

      if (!inCircle) {
        // transparent outside circle
        pixels[i]   = 0x0f; // dark bg bleed
        pixels[i+1] = 0x0f;
        pixels[i+2] = 0x0f;
        pixels[i+3] = 255;
      } else if (inRect && !inTri) {
        // white rect
        pixels[i] = pixels[i+1] = pixels[i+2] = 255;
        pixels[i+3] = 255;
      } else if (inRect && inTri) {
        // red triangle inside white rect
        pixels[i]   = 0xff;
        pixels[i+1] = 0x00;
        pixels[i+2] = 0x00;
        pixels[i+3] = 255;
      } else {
        // red background
        pixels[i]   = 0xff;
        pixels[i+1] = 0x00;
        pixels[i+2] = 0x00;
        pixels[i+3] = 255;
      }
    }
  }
  return pixels;
}

function inRoundedRect(dx, dy, hw, hh, r) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax > hw || ay > hh) return false;
  if (ax <= hw - r || ay <= hh - r) return true;
  const qx = ax - (hw - r), qy = ay - (hh - r);
  return qx * qx + qy * qy <= r * r;
}

function inTriangle(dx, dy, tw, th) {
  // Right-pointing triangle centered slightly right of center
  const ox = dx - tw * 0.1;
  if (ox < -tw || ox > tw) return false;
  const slope = th / tw;
  return Math.abs(dy) <= slope * (tw - ox);
}

// ── Build PNG buffer ───────────────────────────
function buildPNG(size) {
  const pixels = makePixels(size);

  // RGBA → RGB scanlines with filter byte 0
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0); // filter None
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      raw.push(pixels[i], pixels[i+1], pixels[i+2]); // RGB only
    }
  }

  const rawBuf = Buffer.from(raw);
  const compressed = zlib.deflateSync(rawBuf, { level: 9 });

  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = chunk('IHDR', Buffer.concat([
    u32(size), u32(size),
    Buffer.from([8, 2, 0, 0, 0]) // 8-bit RGB, no interlace
  ]));
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// ── Write files ────────────────────────────────
for (const size of [192, 512]) {
  const out = path.join(DIR, `icon-${size}.png`);
  fs.writeFileSync(out, buildPNG(size));
  console.log(`✅ icons/icon-${size}.png (${size}x${size})`);
}
console.log('Done!');

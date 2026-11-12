import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCrcTable();
function calcCrc(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = calcCrc(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function createPng(width, height, pixelFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = writeChunk('IHDR', ihdrData);

  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = writeChunk('IDAT', compressedData);
  const iendChunk = writeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw QRForge icon
function renderIconPixel(x, y, width, height, isMaskable = false) {
  const nx = x / width;
  const ny = y / height;

  const bgR = Math.round(5 + (10 - 5) * ny);
  const bgG = Math.round(6 + (18 - 6) * ny);
  const bgB = Math.round(15 + (48 - 15) * ny);

  if (!isMaskable) {
    const radius = 0.22;
    const checkCorner = (cx, cy) => {
      const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - radius));
      const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - radius));
      return (dx * dx + dy * dy) <= (radius * radius);
    };
    if (!checkCorner(nx, ny)) {
      return [0, 0, 0, 0];
    }
  }

  const dOrb1 = Math.hypot(nx - 0.7, ny - 0.3);
  const dOrb2 = Math.hypot(nx - 0.3, ny - 0.7);

  let r = bgR;
  let g = bgG;
  let b = bgB;

  if (dOrb1 < 0.4) {
    const intensity = Math.pow(1 - dOrb1 / 0.4, 2) * 0.4;
    r = Math.min(255, Math.round(r + 47 * intensity));
    g = Math.min(255, Math.round(g + 107 * intensity));
    b = Math.min(255, Math.round(b + 255 * intensity));
  }
  if (dOrb2 < 0.35) {
    const intensity = Math.pow(1 - dOrb2 / 0.35, 2) * 0.35;
    r = Math.min(255, Math.round(r + 255 * intensity));
    g = Math.min(255, Math.round(g + 59 * intensity));
    b = Math.min(255, Math.round(b + 78 * intensity));
  }

  const pad = isMaskable ? 0.16 : 0.08;
  const qx = (nx - pad) / (1 - 2 * pad);
  const qy = (ny - pad) / (1 - 2 * pad);

  if (qx >= 0 && qx <= 1 && qy >= 0 && qy <= 1) {
    const inFinder = (fx, fy) => {
      const rx = qx - fx;
      const ry = qy - fy;
      if (rx >= 0 && rx <= 0.28 && ry >= 0 && ry <= 0.28) {
        const outer = rx <= 0.055 || rx >= 0.225 || ry <= 0.055 || ry >= 0.225;
        const inner = rx >= 0.09 && rx <= 0.19 && ry >= 0.09 && ry <= 0.19;
        return outer || inner;
      }
      return false;
    };

    if (inFinder(0.08, 0.08) || inFinder(0.64, 0.08) || inFinder(0.08, 0.64)) {
      return [60, 140, 255, 255];
    }

    const cx = qx - 0.5;
    const cy = qy - 0.5;
    if (Math.abs(cx) <= 0.06 && Math.abs(cy) <= 0.06) {
      return [255, 59, 78, 255];
    }

    const modGrid = (col, row) => {
      const mx = 0.08 + col * 0.065;
      const my = 0.08 + row * 0.065;
      return qx >= mx && qx <= mx + 0.048 && qy >= my && qy <= my + 0.048;
    };

    if (
      modGrid(6, 2) || modGrid(6, 3) || modGrid(7, 4) ||
      modGrid(2, 6) || modGrid(3, 7) ||
      modGrid(8, 7) || modGrid(9, 7) || modGrid(7, 9) || modGrid(9, 9) || modGrid(10, 8)
    ) {
      return [77, 163, 255, 255];
    }
  }

  return [r, g, b, 255];
}

// Render app screenshot
function renderScreenshotPixel(x, y, width, height, isMobile = true) {
  const nx = x / width;
  const ny = y / height;

  // Background deep dark gradient
  let r = Math.round(5 + 5 * ny);
  let g = Math.round(6 + 12 * ny);
  let b = Math.round(15 + 33 * ny);

  // Floating blue & red glow
  const dGlow = Math.hypot(nx - 0.3, ny - 0.25);
  if (dGlow < 0.5) {
    const f = Math.pow(1 - dGlow / 0.5, 2);
    r = Math.min(255, Math.round(r + 47 * f * 0.5));
    g = Math.min(255, Math.round(g + 107 * f * 0.5));
    b = Math.min(255, Math.round(b + 255 * f * 0.5));
  }

  // Header strip
  if (ny < 0.08) {
    return [10, 18, 48, 255];
  }

  // Central scannable preview tile
  const tileX = isMobile ? 0.22 : 0.65;
  const tileY = isMobile ? 0.35 : 0.25;
  const tileW = isMobile ? 0.56 : 0.25;
  const tileH = tileW * (width / height);

  if (nx >= tileX && nx <= tileX + tileW && ny >= tileY && ny <= tileY + tileH) {
    // White QR tile
    const qx = (nx - tileX) / tileW;
    const qy = (ny - tileY) / tileH;
    if (qx > 0.08 && qx < 0.92 && qy > 0.08 && qy < 0.92) {
      // Draw simulated QR matrix
      const col = Math.floor((qx - 0.08) / (0.84 / 21));
      const row = Math.floor((qy - 0.08) / (0.84 / 21));
      // Finder corners
      const isFinderTL = col < 7 && row < 7;
      const isFinderTR = col >= 14 && row < 7;
      const isFinderBL = col < 7 && row >= 14;
      if (isFinderTL || isFinderTR || isFinderBL) {
        const fc = isFinderTL ? col : isFinderTR ? col - 14 : col;
        const fr = isFinderTL ? row : isFinderTR ? row : row - 14;
        const outer = fc === 0 || fc === 6 || fr === 0 || fr === 6;
        const inner = fc >= 2 && fc <= 4 && fr >= 2 && fr <= 4;
        if (outer || inner) return [47, 107, 255, 255];
        return [255, 255, 255, 255];
      }
      if ((col * 7 + row * 13) % 5 <= 2) {
        return [10, 15, 30, 255];
      }
    }
    return [255, 255, 255, 255];
  }

  return [r, g, b, 255];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Icons
const png192 = createPng(192, 192, (x, y, w, h) => renderIconPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);

const png512 = createPng(512, 512, (x, y, w, h) => renderIconPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);

const pngMaskable = createPng(512, 512, (x, y, w, h) => renderIconPixel(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pngMaskable);

const appleIcon = createPng(180, 180, (x, y, w, h) => renderIconPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);

fs.writeFileSync(path.join(publicDir, 'favicon.ico'), png192);

// 2. Screenshots for Google Play WebAPK rich install dialog
// Mobile portrait: 720x1280
const screenshotMobile = createPng(360, 640, (x, y, w, h) => renderScreenshotPixel(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'screenshot-mobile.png'), screenshotMobile);

// Desktop landscape: 1280x720
const screenshotDesktop = createPng(640, 360, (x, y, w, h) => renderScreenshotPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'screenshot-desktop.png'), screenshotDesktop);

console.log('All PWA PNG icons & WebAPK screenshots generated successfully!');

const fs = require('fs');
const path = require('path');

// Simple minimal 1x1 PNG generator extended for standard colored PNG icon files,
// or SVG file generator. Note: Chrome V3 action manifest allows PNG icons.
// Let's build a minimal PNG generator in pure Node.js without external dependencies.

function createPNG(size, primaryColorHex) {
  const width = size;
  const height = size;

  // Hex parsing
  const r = parseInt(primaryColorHex.slice(1, 3), 16);
  const g = parseInt(primaryColorHex.slice(3, 5), 16);
  const b = parseInt(primaryColorHex.slice(5, 7), 16);

  // We can write raw uncompressed PNG or use zlib (built-in in Node.js)
  const zlib = require('zlib');

  // Raw pixel data RGBA
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    rawData[rowStart] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 4;
      
      // Draw a rounded circle/card icon with YouTube Red styling
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = size * 0.45;

      // Play button triangle logic inside center
      const inTriangle = (x >= width * 0.4 && x <= width * 0.68 &&
                          y >= height * 0.32 + (x - width * 0.4) * 0.6 &&
                          y <= height * 0.68 - (x - width * 0.4) * 0.6);

      if (dist <= radius) {
        if (inTriangle) {
          rawData[idx] = 255;     // Red
          rawData[idx + 1] = 255; // Green
          rawData[idx + 2] = 255; // Blue
          rawData[idx + 3] = 255; // Alpha
        } else {
          rawData[idx] = r;
          rawData[idx + 1] = g;
          rawData[idx + 2] = b;
          rawData[idx + 3] = 255;
        }
      } else {
        // Transparent border
        rawData[idx] = 0;
        rawData[idx + 1] = 0;
        rawData[idx + 2] = 0;
        rawData[idx + 3] = 0;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const bodyBuf = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(bodyBuf), 0);

  return Buffer.concat([len, bodyBuf, crcBuf]);
}

// Minimal CRC32 implementation
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ -1) >>> 0;
}

const iconsDir = path.join(__dirname);
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const iconBuffer = createPNG(size, '#ff0000');
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, iconBuffer);
  console.log(`Generated icon: ${filePath}`);
});

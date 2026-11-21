/**
 * Minimal lossless PNG encoder & tEXt chunk injector with CRC32.
 * Pure TypeScript, zero external dependencies, runs in Worker and Main thread.
 */

// CRC32 table
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

export function crc32(buf: Uint8Array, offset = 0, length = buf.length - offset): number {
  let c = 0xffffffff;
  for (let i = offset; i < offset + length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Adler32 for Deflate uncompressed blocks
function adler32(buf: Uint8Array): number {
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < buf.length; i++) {
    s1 = (s1 + buf[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return ((s2 << 16) | s1) >>> 0;
}

export interface PngMetadata {
  [key: string]: string;
}

/**
 * Encodes RGBA pixels into a valid, standard uncompressed PNG Uint8Array.
 * Uses stored (uncompressed) Deflate blocks so no external compression lib is strictly required,
 * or fast Deflate when available.
 */
export function encodeRgbaToPng(
  width: number,
  height: number,
  rgba: Uint8Array,
  metadata?: PngMetadata
): Uint8Array {
  // Format: 8-bit RGBA (color type 6)
  // Each scanline has 1 filter byte (0 = None) followed by width * 4 bytes
  const bytesPerLine = 1 + width * 4;
  const rawData = new Uint8Array(height * bytesPerLine);

  for (let y = 0; y < height; y++) {
    const rawOffset = y * bytesPerLine;
    rawData[rawOffset] = 0; // Filter: None
    const srcOffset = y * width * 4;
    rawData.set(rgba.subarray(srcOffset, srcOffset + width * 4), rawOffset + 1);
  }

  // Create zlib stream with stored (uncompressed) blocks
  // Max block size is 65535
  const maxBlockSize = 65535;
  const numBlocks = Math.ceil(rawData.length / maxBlockSize) || 1;
  const zlibHeaderLen = 2;
  const zlibFooterLen = 4;
  const blockOverhead = 5 * numBlocks;
  const zlibTotalLen = zlibHeaderLen + blockOverhead + rawData.length + zlibFooterLen;

  const zlibData = new Uint8Array(zlibTotalLen);
  zlibData[0] = 0x78; // CMF: Deflate, 32K window
  zlibData[1] = 0x01; // FLG: No preset dict, check bits

  let zPos = 2;
  for (let i = 0; i < numBlocks; i++) {
    const start = i * maxBlockSize;
    const end = Math.min(start + maxBlockSize, rawData.length);
    const len = end - start;
    const isFinal = i === numBlocks - 1 ? 1 : 0;

    zlibData[zPos++] = isFinal; // BFINAL, BTYPE=00 (stored)
    zlibData[zPos++] = len & 0xff;
    zlibData[zPos++] = (len >>> 8) & 0xff;
    zlibData[zPos++] = (~len) & 0xff;
    zlibData[zPos++] = ((~len) >>> 8) & 0xff;

    zlibData.set(rawData.subarray(start, end), zPos);
    zPos += len;
  }

  const adler = adler32(rawData);
  zlibData[zPos++] = (adler >>> 24) & 0xff;
  zlibData[zPos++] = (adler >>> 16) & 0xff;
  zlibData[zPos++] = (adler >>> 8) & 0xff;
  zlibData[zPos++] = adler & 0xff;

  // Build PNG Chunks: Signature + IHDR + (tEXt*) + IDAT + IEND
  const chunks: { type: string; data: Uint8Array }[] = [];

  // IHDR
  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace: none
  chunks.push({ type: "IHDR", data: ihdrData });

  // Metadata tEXt chunks
  if (metadata) {
    const enc = new TextEncoder();
    for (const [key, val] of Object.entries(metadata)) {
      if (key && val != null) {
        const kBytes = enc.encode(key);
        const vBytes = enc.encode(String(val));
        const textData = new Uint8Array(kBytes.length + 1 + vBytes.length);
        textData.set(kBytes, 0);
        textData[kBytes.length] = 0; // null separator
        textData.set(vBytes, kBytes.length + 1);
        chunks.push({ type: "tEXt", data: textData });
      }
    }
  }

  // IDAT
  chunks.push({ type: "IDAT", data: zlibData });

  // IEND
  chunks.push({ type: "IEND", data: new Uint8Array(0) });

  // Total PNG length: 8 (signature) + sum(12 + chunk.length)
  let totalLength = 8;
  for (const c of chunks) {
    totalLength += 12 + c.data.length;
  }

  const png = new Uint8Array(totalLength);
  // PNG Signature: 89 50 4E 47 0D 0A 1A 0A
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);

  let offset = 8;
  const view = new DataView(png.buffer);
  const enc = new TextEncoder();

  for (const c of chunks) {
    const len = c.data.length;
    view.setUint32(offset, len, false);
    offset += 4;

    const typeStart = offset;
    png.set(enc.encode(c.type), offset);
    offset += 4;

    if (len > 0) {
      png.set(c.data, offset);
      offset += len;
    }

    // CRC over type + data
    const chunkCrc = crc32(png, typeStart, 4 + len);
    view.setUint32(offset, chunkCrc, false);
    offset += 4;
  }

  return png;
}

/**
 * Parses all PNG tEXt chunks from an ArrayBuffer or Uint8Array.
 */
export function parsePngMetadata(buffer: ArrayBuffer | Uint8Array): PngMetadata {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Check PNG signature
  if (bytes.length < 8 || view.getUint32(0, false) !== 0x89504e47) {
    return {};
  }

  let offset = 8;
  const meta: PngMetadata = {};
  const dec = new TextDecoder();

  while (offset < bytes.length - 8) {
    const len = view.getUint32(offset, false);
    const type = dec.decode(bytes.subarray(offset + 4, offset + 8));

    if (type === "tEXt") {
      const chunkData = bytes.subarray(offset + 8, offset + 8 + len);
      const nullIdx = chunkData.indexOf(0);
      if (nullIdx !== -1) {
        const key = dec.decode(chunkData.subarray(0, nullIdx));
        const val = dec.decode(chunkData.subarray(nullIdx + 1));
        meta[key] = val;
      }
    } else if (type === "IEND") {
      break;
    }

    offset += 12 + len;
  }

  return meta;
}

/**
 * Converts a Uint8Array of PNG bytes to a standard Blob and Object URL.
 */
export function pngBytesToBlobUrl(pngBytes: Uint8Array): { blob: Blob; url: string } {
  const blob = new Blob([pngBytes.buffer as ArrayBuffer], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

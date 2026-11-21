/**
 * Mode D: B/W XOR (n, n) (P6, Wang et al. 2005)
 * Binary XOR visual secret sharing with 0× pixel expansion and exact reconstruction.
 */

import { fillCryptoRandomValues } from "./cryptoRandom";

export interface BwXorResult {
  shares: Uint8Array[];
  reconstruction: Uint8Array;
  width: number;
  height: number;
  n: number;
}

export function generateBwXor(
  rgba: Uint8Array,
  width: number,
  height: number,
  n: number,
  threshold = 128,
  onProgress?: (percent: number, message: string) => void
): BwXorResult {
  onProgress?.(15, "Thresholding to 1-bit binary secret...");

  const numPixels = width * height;
  const binarySecret = new Uint8Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const src = i * 4;
    const lum = 0.299 * rgba[src] + 0.587 * rgba[src + 1] + 0.114 * rgba[src + 2];
    // 0 = white (255), 1 = black (0)
    binarySecret[i] = lum < threshold ? 1 : 0;
  }

  onProgress?.(35, `Generating ${n - 1} binary random shares...`);

  const shares: Uint8Array[] = [];
  const shareByteLen = numPixels * 4;

  for (let k = 0; k < n - 1; k++) {
    const rand = new Uint8Array(numPixels);
    fillCryptoRandomValues(rand);
    const s = new Uint8Array(shareByteLen);

    for (let i = 0; i < numPixels; i++) {
      const bit = rand[i] & 1;
      const val = bit === 1 ? 0 : 255;
      const dest = i * 4;
      s[dest] = val;
      s[dest + 1] = val;
      s[dest + 2] = val;
      s[dest + 3] = 255;
    }

    shares.push(s);
  }

  onProgress?.(70, `Computing final parity share ${n}...`);

  const lastShare = new Uint8Array(shareByteLen);
  for (let i = 0; i < numPixels; i++) {
    let bit = binarySecret[i];
    for (let k = 0; k < n - 1; k++) {
      // 0 brightness = bit 1 (black), 255 brightness = bit 0 (white)
      const sBit = shares[k][i * 4] === 0 ? 1 : 0;
      bit ^= sBit;
    }

    const val = bit === 1 ? 0 : 255;
    const dest = i * 4;
    lastShare[dest] = val;
    lastShare[dest + 1] = val;
    lastShare[dest + 2] = val;
    lastShare[dest + 3] = 255;
  }
  shares.push(lastShare);

  onProgress?.(85, "Reconstructing binary secret via XOR...");
  const reconstruction = reconstructBwXor(shares);

  onProgress?.(100, "B/W XOR sharing complete.");

  return {
    shares,
    reconstruction,
    width,
    height,
    n,
  };
}

export function reconstructBwXor(shares: Uint8Array[]): Uint8Array {
  if (shares.length === 0) return new Uint8Array(0);

  const numBytes = shares[0].length;
  const numPixels = numBytes / 4;
  const result = new Uint8Array(numBytes);

  for (let i = 0; i < numPixels; i++) {
    let bit = 0;
    for (let k = 0; k < shares.length; k++) {
      const sBit = shares[k][i * 4] === 0 ? 1 : 0;
      bit ^= sBit;
    }

    const val = bit === 1 ? 0 : 255;
    const dest = i * 4;
    result[dest] = val;
    result[dest + 1] = val;
    result[dest + 2] = val;
    result[dest + 3] = 255;
  }

  return result;
}

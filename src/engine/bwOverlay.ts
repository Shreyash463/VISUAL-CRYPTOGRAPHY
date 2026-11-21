/**
 * Mode C: B/W Overlay 2-out-of-2 (P1, Naor & Shamir 1994)
 * Classical 2x2 subpixel expansion baseline.
 * Contrast loss: white pixels stack to 50% grey (2 black subpixels); black pixels stack to 100% black (4 black subpixels).
 */

import { PATTERNS_2X2, COMPLEMENT_PATTERN_INDEX } from "./colorOverlay";
import { fillCryptoRandomValues } from "./cryptoRandom";

export interface BwOverlayResult {
  share1Rgba: Uint8Array;
  share2Rgba: Uint8Array;
  rawStackRgba: Uint8Array;
  shareWidth: number;
  shareHeight: number;
  secretWidth: number;
  secretHeight: number;
}

export function generateBwOverlay(
  rgba: Uint8Array,
  width: number,
  height: number,
  threshold = 128,
  onProgress?: (percent: number, message: string) => void
): BwOverlayResult {
  onProgress?.(15, "Converting to binary luminance field...");

  const numPixels = width * height;
  const binarySecret = new Uint8Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const src = i * 4;
    // Standard luminance: 0.299 R + 0.587 G + 0.114 B
    const lum = 0.299 * rgba[src] + 0.587 * rgba[src + 1] + 0.114 * rgba[src + 2];
    // In VC convention: 1 = black (secret ink), 0 = white (transparent)
    binarySecret[i] = lum < threshold ? 1 : 0;
  }

  onProgress?.(45, "Generating 2×2 Naor-Shamir shares...");

  const shareW = width * 2;
  const shareH = height * 2;
  const share1Rgba = new Uint8Array(shareW * shareH * 4);
  const share2Rgba = new Uint8Array(shareW * shareH * 4);

  const randBytes = new Uint8Array(numPixels);
  fillCryptoRandomValues(randBytes);

  const subOffsets = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pIdx = y * width + x;
      const isBlack = binarySecret[pIdx] === 1;

      // Random pattern 0..5
      const patIdx = randBytes[pIdx] % 6;
      const compIdx = COMPLEMENT_PATTERN_INDEX[patIdx];

      const s1Pat = PATTERNS_2X2[patIdx];
      const s2Pat = isBlack ? PATTERNS_2X2[compIdx] : s1Pat;

      for (let s = 0; s < 4; s++) {
        const sx = x * 2 + subOffsets[s][0];
        const sy = y * 2 + subOffsets[s][1];
        const destIdx = (sy * shareW + sx) * 4;

        // 1 = black ink (0, 0, 0), 0 = white transparent (255, 255, 255)
        const val1 = s1Pat[s] === 1 ? 0 : 255;
        share1Rgba[destIdx] = val1;
        share1Rgba[destIdx + 1] = val1;
        share1Rgba[destIdx + 2] = val1;
        share1Rgba[destIdx + 3] = 255;

        const val2 = s2Pat[s] === 1 ? 0 : 255;
        share2Rgba[destIdx] = val2;
        share2Rgba[destIdx + 1] = val2;
        share2Rgba[destIdx + 2] = val2;
        share2Rgba[destIdx + 3] = 255;
      }
    }
  }

  onProgress?.(80, "Computing optical overlay superposition...");
  const rawStackRgba = new Uint8Array(share1Rgba.length);
  for (let i = 0; i < rawStackRgba.length; i += 4) {
    const v = Math.min(share1Rgba[i], share2Rgba[i]);
    rawStackRgba[i] = v;
    rawStackRgba[i + 1] = v;
    rawStackRgba[i + 2] = v;
    rawStackRgba[i + 3] = 255;
  }

  onProgress?.(100, "B/W overlay sharing complete.");

  return {
    share1Rgba,
    share2Rgba,
    rawStackRgba,
    shareWidth: shareW,
    shareHeight: shareH,
    secretWidth: width,
    secretHeight: height,
  };
}

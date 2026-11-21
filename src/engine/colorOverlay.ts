/**
 * Mode A: Colour Overlay 2-out-of-2 (P5, Hou 2003)
 * Subtractive CMY Primary Decomposition + Floyd-Steinberg Halftoning +
 * Naor-Shamir 2x2 Subpixel Expansion + Subtractive Minimum Overlay Superposition +
 * 2x2 Block Enhanced Colour Recovery with Gaussian Filtering.
 */

import { fillCryptoRandomValues } from "./cryptoRandom";

// Six 2x2 patterns with exactly 2 ones (inked) and 2 zeros (transparent)
// Index order in 2x2 block: [top-left, top-right, bottom-left, bottom-right]
export const PATTERNS_2X2: readonly (readonly number[])[] = [
  [1, 0, 0, 1], // 0: diagonal main
  [0, 1, 1, 0], // 1: diagonal anti (complement of 0)
  [1, 1, 0, 0], // 2: horizontal top
  [0, 0, 1, 1], // 3: horizontal bottom (complement of 2)
  [1, 0, 1, 0], // 4: vertical left
  [0, 1, 0, 1], // 5: vertical right (complement of 4)
] as const;

export const COMPLEMENT_PATTERN_INDEX = [1, 0, 3, 2, 5, 4] as const;

/**
 * Floyd-Steinberg Error Diffusion Halftoning for a single channel (0..255).
 * Returns a binary Uint8Array where 1 = ink present, 0 = ink absent.
 */
export function floydSteinbergHalftone(
  channel: Float32Array,
  width: number,
  height: number
): Uint8Array {
  const binary = new Uint8Array(width * height);
  const buf = new Float32Array(channel); // copy to mutate with diffused error

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = buf[idx];
      const newVal = oldVal >= 127.5 ? 255 : 0;
      binary[idx] = newVal === 255 ? 1 : 0;
      const err = oldVal - newVal;

      if (x + 1 < width) {
        buf[idx + 1] += (err * 7) / 16;
      }
      if (y + 1 < height) {
        if (x - 1 >= 0) {
          buf[(y + 1) * width + (x - 1)] += (err * 3) / 16;
        }
        buf[(y + 1) * width + x] += (err * 5) / 16;
        if (x + 1 < width) {
          buf[(y + 1) * width + (x + 1)] += (err * 1) / 16;
        }
      }
    }
  }

  return binary;
}

export interface ColorOverlayResult {
  share1Rgba: Uint8Array;
  share2Rgba: Uint8Array;
  rawStackRgba: Uint8Array;
  enhancedRevealRgba: Uint8Array;
  shareWidth: number;
  shareHeight: number;
  secretWidth: number;
  secretHeight: number;
}

/**
 * Generates two 2-out-of-2 colour visual cryptography shares from an RGBA image.
 */
export function generateColorOverlay(
  rgba: Uint8Array,
  width: number,
  height: number,
  onProgress?: (percent: number, message: string) => void
): ColorOverlayResult {
  onProgress?.(10, "Extracting subtractive CMY ink densities...");

  const numPixels = width * height;
  const cChannel = new Float32Array(numPixels);
  const mChannel = new Float32Array(numPixels);
  const yChannel = new Float32Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const src = i * 4;
    // Subtractive primaries (CMY)
    cChannel[i] = 255 - rgba[src];
    mChannel[i] = 255 - rgba[src + 1];
    yChannel[i] = 255 - rgba[src + 2];
  }

  onProgress?.(25, "Performing Floyd-Steinberg error diffusion...");
  const cBinary = floydSteinbergHalftone(cChannel, width, height);
  const mBinary = floydSteinbergHalftone(mChannel, width, height);
  const yBinary = floydSteinbergHalftone(yChannel, width, height);

  onProgress?.(45, "Expanding 2×2 subpixel visual shares with crypto randomness...");
  const shareW = width * 2;
  const shareH = height * 2;
  const share1Rgba = new Uint8Array(shareW * shareH * 4);
  const share2Rgba = new Uint8Array(shareW * shareH * 4);

  // Random pattern indices (0..5) per pixel per channel using cryptographically secure values
  const randBytes = new Uint8Array(numPixels * 3);
  fillCryptoRandomValues(randBytes);

  // Subpixel offsets in 2x2 grid: (dx, dy)
  const subOffsets = [
    [0, 0], // top-left
    [1, 0], // top-right
    [0, 1], // bottom-left
    [1, 1], // bottom-right
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pIdx = y * width + x;

      // Random 2x2 pattern for each channel
      const patC = randBytes[pIdx * 3] % 6;
      const patM = randBytes[pIdx * 3 + 1] % 6;
      const patY = randBytes[pIdx * 3 + 2] % 6;

      const compC = COMPLEMENT_PATTERN_INDEX[patC];
      const compM = COMPLEMENT_PATTERN_INDEX[patM];
      const compY = COMPLEMENT_PATTERN_INDEX[patY];

      const bitC = cBinary[pIdx];
      const bitM = mBinary[pIdx];
      const bitY = yBinary[pIdx];

      // S1 gets base pattern P
      const s1PatC = PATTERNS_2X2[patC];
      const s1PatM = PATTERNS_2X2[patM];
      const s1PatY = PATTERNS_2X2[patY];

      // S2 gets P if secret bit is 0 (no ink), complement P_bar if secret bit is 1 (ink)
      const s2PatC = bitC === 0 ? s1PatC : PATTERNS_2X2[compC];
      const s2PatM = bitM === 0 ? s1PatM : PATTERNS_2X2[compM];
      const s2PatY = bitY === 0 ? s1PatY : PATTERNS_2X2[compY];

      // Write 4 subpixels into Share 1 and Share 2
      for (let s = 0; s < 4; s++) {
        const sx = x * 2 + subOffsets[s][0];
        const sy = y * 2 + subOffsets[s][1];
        const destIdx = (sy * shareW + sx) * 4;

        // Share 1 subpixel
        const ink1C = s1PatC[s];
        const ink1M = s1PatM[s];
        const ink1Y = s1PatY[s];
        share1Rgba[destIdx] = 255 * (1 - ink1C);     // R
        share1Rgba[destIdx + 1] = 255 * (1 - ink1M); // G
        share1Rgba[destIdx + 2] = 255 * (1 - ink1Y); // B
        share1Rgba[destIdx + 3] = 255;               // A

        // Share 2 subpixel
        const ink2C = s2PatC[s];
        const ink2M = s2PatM[s];
        const ink2Y = s2PatY[s];
        share2Rgba[destIdx] = 255 * (1 - ink2C);     // R
        share2Rgba[destIdx + 1] = 255 * (1 - ink2M); // G
        share2Rgba[destIdx + 2] = 255 * (1 - ink2Y); // B
        share2Rgba[destIdx + 3] = 255;               // A
      }
    }
  }

  onProgress?.(70, "Simulating optical subtractive overlay superposition...");
  const rawStackRgba = computeSubtractiveStack(share1Rgba, share2Rgba);

  onProgress?.(85, "Executing 2×2 block colour recovery and spatial filtering...");
  const enhancedRevealRgba = recoverColorFromStack(rawStackRgba, width, height);

  onProgress?.(100, "Colour visual cryptography complete.");

  return {
    share1Rgba,
    share2Rgba,
    rawStackRgba,
    enhancedRevealRgba,
    shareWidth: shareW,
    shareHeight: shareH,
    secretWidth: width,
    secretHeight: height,
  };
}

/**
 * Simulates physical transparency overlay via subtractive channel minimum.
 */
export function computeSubtractiveStack(
  share1: Uint8Array,
  share2: Uint8Array
): Uint8Array {
  const len = share1.length;
  const stack = new Uint8Array(len);
  for (let i = 0; i < len; i += 4) {
    stack[i] = Math.min(share1[i], share2[i]);         // R
    stack[i + 1] = Math.min(share1[i + 1], share2[i + 1]); // G
    stack[i + 2] = Math.min(share1[i + 2], share2[i + 2]); // B
    stack[i + 3] = 255;                                // A
  }
  return stack;
}

/**
 * Recovers full-colour continuous-tone RGB from the 2x2 stacked overlay image.
 * Evaluates 2x2 block ink coverage per channel, thresholds at 0.75, and applies light Gaussian smoothing.
 */
export function recoverColorFromStack(
  stackRgba: Uint8Array,
  secretW: number,
  secretH: number
): Uint8Array {
  const shareW = secretW * 2;
  const rawRecovered = new Uint8Array(secretW * secretH * 4);

  // Subpixel offsets
  const subOffsets = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ];

  for (let y = 0; y < secretH; y++) {
    for (let x = 0; x < secretW; x++) {
      let countC = 0;
      let countM = 0;
      let countY = 0;

      for (let s = 0; s < 4; s++) {
        const sx = x * 2 + subOffsets[s][0];
        const sy = y * 2 + subOffsets[s][1];
        const idx = (sy * shareW + sx) * 4;

        // Inked in stack if channel value is absorbed (< 128)
        if (stackRgba[idx] < 128) countC++;     // R absorbs C
        if (stackRgba[idx + 1] < 128) countM++; // G absorbs M
        if (stackRgba[idx + 2] < 128) countY++; // B absorbs Y
      }

      // 50% coverage (2 of 4) = white (no ink, 0); 100% coverage (4 of 4) = ink (1)
      // Threshold at 0.75 (3 of 4)
      const recC = countC >= 3 ? 1 : 0;
      const recM = countM >= 3 ? 1 : 0;
      const recY = countY >= 3 ? 1 : 0;

      const destIdx = (y * secretW + x) * 4;
      rawRecovered[destIdx] = 255 * (1 - recC);
      rawRecovered[destIdx + 1] = 255 * (1 - recM);
      rawRecovered[destIdx + 2] = 255 * (1 - recY);
      rawRecovered[destIdx + 3] = 255;
    }
  }

  // 3x3 Gaussian smoothing filter (sigma ~ 0.8) for smooth continuous colour
  // Kernel: [[1, 2, 1], [2, 4, 2], [1, 2, 1]] / 16
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1],
  ];
  const smoothed = new Uint8Array(secretW * secretH * 4);

  for (let y = 0; y < secretH; y++) {
    for (let x = 0; x < secretW; x++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let wSum = 0;

      for (let ky = -1; ky <= 1; ky++) {
        const py = Math.min(Math.max(y + ky, 0), secretH - 1);
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(Math.max(x + kx, 0), secretW - 1);
          const weight = kernel[ky + 1][kx + 1];
          const srcIdx = (py * secretW + px) * 4;

          rSum += rawRecovered[srcIdx] * weight;
          gSum += rawRecovered[srcIdx + 1] * weight;
          bSum += rawRecovered[srcIdx + 2] * weight;
          wSum += weight;
        }
      }

      const destIdx = (y * secretW + x) * 4;
      smoothed[destIdx] = Math.round(rSum / wSum);
      smoothed[destIdx + 1] = Math.round(gSum / wSum);
      smoothed[destIdx + 2] = Math.round(bSum / wSum);
      smoothed[destIdx + 3] = 255;
    }
  }

  return smoothed;
}

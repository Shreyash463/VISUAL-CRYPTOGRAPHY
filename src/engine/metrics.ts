/**
 * Cryptographic & Visual Quality Evaluation Metrics.
 * PSNR, MSE, Mean Colour Distance (Delta-E), Contrast, and Exact Match verification.
 */

export interface EvaluationMetrics {
  mse: number;
  psnr: number;
  meanColorError: number;
  exactMatch: boolean;
  pixelExpansion: string;
  reconstructionMethod: "subtractive_overlay" | "bitwise_xor";
  processingTimeMs: number;
  contrast?: number;
}

export function computeMetrics(
  originalRgba: Uint8Array,
  reconstructedRgba: Uint8Array,
  width: number,
  height: number,
  isOverlay: boolean,
  processingTimeMs: number
): EvaluationMetrics {
  const numPixels = width * height;
  let sse = 0;
  let totalDeltaE = 0;
  let exact = true;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const rDiff = originalRgba[idx] - reconstructedRgba[idx];
    const gDiff = originalRgba[idx + 1] - reconstructedRgba[idx + 1];
    const bDiff = originalRgba[idx + 2] - reconstructedRgba[idx + 2];

    if (rDiff !== 0 || gDiff !== 0 || bDiff !== 0) {
      exact = false;
    }

    const sqDiff = (rDiff * rDiff + gDiff * gDiff + bDiff * bDiff) / 3;
    sse += sqDiff;

    const deltaE = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
    totalDeltaE += deltaE;
  }

  const mse = sse / numPixels;
  const psnr = mse === 0 ? 999.0 : 10 * Math.log10((255 * 255) / mse);
  const meanColorError = totalDeltaE / numPixels;

  return {
    mse: parseFloat(mse.toFixed(3)),
    psnr: parseFloat(psnr.toFixed(2)),
    meanColorError: parseFloat(meanColorError.toFixed(2)),
    exactMatch: exact,
    pixelExpansion: isOverlay ? "2× linear (4 subpixels)" : "1× (0% expansion)",
    reconstructionMethod: isOverlay ? "subtractive_overlay" : "bitwise_xor",
    processingTimeMs: Math.round(processingTimeMs),
    contrast: isOverlay ? 0.5 : 1.0,
  };
}

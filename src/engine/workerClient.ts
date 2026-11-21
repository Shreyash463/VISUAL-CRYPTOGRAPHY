/**
 * Typed client for On-Device Cryptography Worker.
 * Handles client-side EXIF decoding, canvas alpha-on-white compositing,
 * preset resizing, progress subscriptions, and promise resolution.
 */

import type {
  WorkerGenerateResult,
  WorkerReconstructResult,
  WorkerCompareResult,
} from "./worker";

export type QualityPreset = "standard" | "high" | "ultra";

export const PRESET_DIMS: Record<QualityPreset, number> = {
  standard: 320,
  high: 480,
  ultra: 640,
};

let workerInstance: Worker | null = null;
const pendingPromises = new Map<
  string,
  {
    resolve: (val: any) => void;
    reject: (err: any) => void;
    onProgress?: (percent: number, message: string) => void;
  }
>();

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    workerInstance.onmessage = (e: MessageEvent) => {
      const { type, id, percent, message, result, error } = e.data;
      const pending = pendingPromises.get(id);
      if (!pending) return;

      if (type === "PROGRESS") {
        pending.onProgress?.(percent, message);
      } else if (type === "SUCCESS") {
        pending.resolve(result);
        pendingPromises.delete(id);
      } else if (type === "ERROR") {
        pending.reject(error);
        pendingPromises.delete(id);
      }
    };

    workerInstance.onerror = (err) => {
      console.error("[Worker Error]", err);
    };
  }
  return workerInstance;
}

/**
 * Reads an image File or Blob into an RGBA Uint8Array with alpha composited on white
 * and resized to the specified preset long-side limit.
 */
export async function prepareImageRgba(
  fileOrBlob: Blob,
  maxDimension: number
): Promise<{ rgba: Uint8Array; width: number; height: number; originalWidth: number; originalHeight: number }> {
  // Use createImageBitmap to handle EXIF automatically where available
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(fileOrBlob, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(fileOrBlob);
  }

  const origW = bitmap.width;
  const origH = bitmap.height;

  // Calculate target dimensions
  let targetW = origW;
  let targetH = origH;

  const longSide = Math.max(origW, origH);
  if (longSide > maxDimension) {
    const scale = maxDimension / longSide;
    targetW = Math.round(origW * scale);
    targetH = Math.round(origH * scale);
  }

  // Ensure dimensions are even numbers for 2x2 subpixel alignment
  if (targetW % 2 !== 0) targetW += 1;
  if (targetH % 2 !== 0) targetH += 1;

  // Draw onto canvas compositing on white background
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not acquire 2D canvas context.");

  // Composite on white
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  bitmap.close();

  return {
    rgba: new Uint8Array(imgData.data.buffer),
    width: targetW,
    height: targetH,
    originalWidth: origW,
    originalHeight: origH,
  };
}

/**
 * Checks whether an image has meaningful color variation (vs greyscale).
 */
export function detectImageIsColor(rgba: Uint8Array): boolean {
  const step = Math.max(4, Math.floor(rgba.length / (1000 * 4)) * 4);
  let colorPixels = 0;
  let totalChecked = 0;

  for (let i = 0; i < rgba.length; i += step) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];

    const diffRG = Math.abs(r - g);
    const diffRB = Math.abs(r - b);
    const diffGB = Math.abs(g - b);

    if (diffRG > 10 || diffRB > 10 || diffGB > 10) {
      colorPixels++;
    }
    totalChecked++;
  }

  return colorPixels / totalChecked > 0.05;
}

export function generateSharesOnDevice(
  rgba: Uint8Array,
  width: number,
  height: number,
  scheme: "color_overlay" | "color_xor" | "overlay" | "xor",
  n: number,
  quality: QualityPreset,
  threshold?: number,
  groupId?: string,
  onProgress?: (percent: number, message: string) => void
): Promise<WorkerGenerateResult> {
  const worker = getWorker();
  const id = "gen_" + Math.random().toString(36).slice(2, 11);

  return new Promise((resolve, reject) => {
    pendingPromises.set(id, { resolve, reject, onProgress });
    worker.postMessage({
      id,
      action: "GENERATE",
      payload: {
        rgbaBuffer: rgba.buffer,
        width,
        height,
        scheme,
        n,
        quality,
        threshold,
        groupId,
      },
    });
  });
}

export function reconstructSharesOnDevice(
  files: Array<{ name: string; bytes: ArrayBuffer; rgba: Uint8Array; width: number; height: number }>,
  modeOverride?: string,
  nTotal?: number,
  onProgress?: (percent: number, message: string) => void
): Promise<WorkerReconstructResult> {
  const worker = getWorker();
  const id = "rec_" + Math.random().toString(36).slice(2, 11);

  return new Promise((resolve, reject) => {
    pendingPromises.set(id, { resolve, reject, onProgress });
    worker.postMessage({
      id,
      action: "RECONSTRUCT",
      payload: { files, modeOverride, nTotal },
    });
  });
}

export function compareSchemesOnDevice(
  rgba: Uint8Array,
  width: number,
  height: number,
  onProgress?: (percent: number, message: string) => void
): Promise<WorkerCompareResult> {
  const worker = getWorker();
  const id = "cmp_" + Math.random().toString(36).slice(2, 11);

  return new Promise((resolve, reject) => {
    pendingPromises.set(id, { resolve, reject, onProgress });
    worker.postMessage({
      id,
      action: "COMPARE",
      payload: { rgbaBuffer: rgba.buffer, width, height },
    });
  });
}

export function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    pendingPromises.clear();
  }
}

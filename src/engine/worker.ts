/**
 * On-Device Cryptography Web Worker.
 * All computations run locally inside this dedicated background thread.
 * Zero network transmission of secret images or generated shares.
 */

import { generateColorOverlay, computeSubtractiveStack, recoverColorFromStack } from "./colorOverlay";
import { generateColorXor, reconstructColorXor } from "./colorXor";
import { generateBwOverlay } from "./bwOverlay";
import { generateBwXor, reconstructBwXor } from "./bwXor";
import { encodeRgbaToPng, parsePngMetadata, type PngMetadata } from "./pngChunk";
import { computeMetrics, type EvaluationMetrics } from "./metrics";

export interface WorkerShareItem {
  index: number;
  filename: string;
  pngBytes: Uint8Array;
  width: number;
  height: number;
  metadata: PngMetadata;
}

export interface WorkerGenerateResult {
  shares: WorkerShareItem[];
  reconstruction: {
    filename: string;
    rawPngBytes: Uint8Array;
    enhancedPngBytes?: Uint8Array;
    width: number;
    height: number;
    metadata: PngMetadata;
  };
  metrics: EvaluationMetrics;
  groupId: string;
  scheme: string;
  n: number;
  secretPngBytes: Uint8Array;
}

export interface WorkerReconstructResult {
  rawStackPngBytes: Uint8Array;
  enhancedPngBytes?: Uint8Array;
  width: number;
  height: number;
  scheme: string;
  sufficient: boolean;
  supplied: number;
  required: number;
  groupId?: string;
}

export interface WorkerCompareItem {
  schemeId: string;
  name: string;
  metrics: EvaluationMetrics;
}

export interface WorkerCompareResult {
  results: WorkerCompareItem[];
}

self.onmessage = async (e: MessageEvent) => {
  const { id, action, payload } = e.data;

  try {
    if (action === "GENERATE") {
      const {
        rgbaBuffer,
        width,
        height,
        scheme,
        n,
        quality,
        threshold = 128,
        groupId: customGroupId,
      } = payload;

      const rgba = new Uint8Array(rgbaBuffer);
      const groupId = customGroupId || (typeof crypto.randomUUID === "function" ? crypto.randomUUID().slice(0, 8) : Math.random().toString(16).slice(2, 10));

      const sendProgress = (percent: number, message: string) => {
        self.postMessage({ type: "PROGRESS", id, percent, message });
      };

      const t0 = performance.now();
      let sharesPayload: WorkerShareItem[] = [];
      let rawRecRgba: Uint8Array;
      let enhancedRecRgba: Uint8Array | undefined;
      let recWidth = width;
      let recHeight = height;
      let shareWidth = width;
      let shareHeight = height;
      let isOverlay = false;

      // Encode original secret PNG
      const secretMeta: PngMetadata = {
        vc_kind: "secret",
        vc_version: "3.0",
        vc_w: String(width),
        vc_h: String(height),
      };
      const secretPngBytes = encodeRgbaToPng(width, height, rgba, secretMeta);

      if (scheme === "color_overlay") {
        isOverlay = true;
        const res = generateColorOverlay(rgba, width, height, sendProgress);
        rawRecRgba = res.rawStackRgba;
        enhancedRecRgba = res.enhancedRevealRgba;
        recWidth = width;
        recHeight = height;
        shareWidth = res.shareWidth;
        shareHeight = res.shareHeight;

        // Share 1
        const meta1: PngMetadata = {
          vc_kind: "share",
          vc_scheme: "color_overlay",
          vc_version: "3.0",
          vc_group: groupId,
          vc_index: "1",
          vc_n: "2",
          vc_w: String(shareWidth),
          vc_h: String(shareHeight),
        };
        const s1Bytes = encodeRgbaToPng(shareWidth, shareHeight, res.share1Rgba, meta1);
        sharesPayload.push({
          index: 1,
          filename: `veilshare-color-overlay-${groupId}-share-1-of-2.png`,
          pngBytes: s1Bytes,
          width: shareWidth,
          height: shareHeight,
          metadata: meta1,
        });

        // Share 2
        const meta2: PngMetadata = {
          vc_kind: "share",
          vc_scheme: "color_overlay",
          vc_version: "3.0",
          vc_group: groupId,
          vc_index: "2",
          vc_n: "2",
          vc_w: String(shareWidth),
          vc_h: String(shareHeight),
        };
        const s2Bytes = encodeRgbaToPng(shareWidth, shareHeight, res.share2Rgba, meta2);
        sharesPayload.push({
          index: 2,
          filename: `veilshare-color-overlay-${groupId}-share-2-of-2.png`,
          pngBytes: s2Bytes,
          width: shareWidth,
          height: shareHeight,
          metadata: meta2,
        });
      } else if (scheme === "color_xor") {
        isOverlay = false;
        const res = generateColorXor(rgba, width, height, n, sendProgress);
        rawRecRgba = res.reconstruction;
        enhancedRecRgba = res.reconstruction;
        recWidth = width;
        recHeight = height;
        shareWidth = width;
        shareHeight = height;

        for (let k = 0; k < n; k++) {
          const idx = k + 1;
          const meta: PngMetadata = {
            vc_kind: "share",
            vc_scheme: "color_xor",
            vc_version: "3.0",
            vc_group: groupId,
            vc_index: String(idx),
            vc_n: String(n),
            vc_w: String(shareWidth),
            vc_h: String(shareHeight),
          };
          const bytes = encodeRgbaToPng(shareWidth, shareHeight, res.shares[k], meta);
          sharesPayload.push({
            index: idx,
            filename: `veilshare-color-xor-${groupId}-share-${idx}-of-${n}.png`,
            pngBytes: bytes,
            width: shareWidth,
            height: shareHeight,
            metadata: meta,
          });
        }
      } else if (scheme === "overlay") {
        isOverlay = true;
        const res = generateBwOverlay(rgba, width, height, threshold, sendProgress);
        rawRecRgba = res.rawStackRgba;
        enhancedRecRgba = res.rawStackRgba;
        recWidth = res.shareWidth;
        recHeight = res.shareHeight;
        shareWidth = res.shareWidth;
        shareHeight = res.shareHeight;

        // Share 1
        const meta1: PngMetadata = {
          vc_kind: "share",
          vc_scheme: "overlay",
          vc_version: "3.0",
          vc_group: groupId,
          vc_index: "1",
          vc_n: "2",
          vc_w: String(shareWidth),
          vc_h: String(shareHeight),
        };
        const s1Bytes = encodeRgbaToPng(shareWidth, shareHeight, res.share1Rgba, meta1);
        sharesPayload.push({
          index: 1,
          filename: `veilshare-bw-overlay-${groupId}-share-1-of-2.png`,
          pngBytes: s1Bytes,
          width: shareWidth,
          height: shareHeight,
          metadata: meta1,
        });

        // Share 2
        const meta2: PngMetadata = {
          vc_kind: "share",
          vc_scheme: "overlay",
          vc_version: "3.0",
          vc_group: groupId,
          vc_index: "2",
          vc_n: "2",
          vc_w: String(shareWidth),
          vc_h: String(shareHeight),
        };
        const s2Bytes = encodeRgbaToPng(shareWidth, shareHeight, res.share2Rgba, meta2);
        sharesPayload.push({
          index: 2,
          filename: `veilshare-bw-overlay-${groupId}-share-2-of-2.png`,
          pngBytes: s2Bytes,
          width: shareWidth,
          height: shareHeight,
          metadata: meta2,
        });
      } else {
        // B/W XOR
        isOverlay = false;
        const res = generateBwXor(rgba, width, height, n, threshold, sendProgress);
        rawRecRgba = res.reconstruction;
        enhancedRecRgba = res.reconstruction;
        recWidth = width;
        recHeight = height;
        shareWidth = width;
        shareHeight = height;

        for (let k = 0; k < n; k++) {
          const idx = k + 1;
          const meta: PngMetadata = {
            vc_kind: "share",
            vc_scheme: "xor",
            vc_version: "3.0",
            vc_group: groupId,
            vc_index: String(idx),
            vc_n: String(n),
            vc_w: String(shareWidth),
            vc_h: String(shareHeight),
          };
          const bytes = encodeRgbaToPng(shareWidth, shareHeight, res.shares[k], meta);
          sharesPayload.push({
            index: idx,
            filename: `veilshare-bw-xor-${groupId}-share-${idx}-of-${n}.png`,
            pngBytes: bytes,
            width: shareWidth,
            height: shareHeight,
            metadata: meta,
          });
        }
      }

      // Encode reconstruction PNGs
      const recMeta: PngMetadata = {
        vc_kind: "reconstruction",
        vc_scheme: scheme,
        vc_version: "3.0",
        vc_group: groupId,
        vc_w: String(recWidth),
        vc_h: String(recHeight),
      };

      const rawRecPngBytes = encodeRgbaToPng(
        isOverlay && scheme === "color_overlay" ? shareWidth : recWidth,
        isOverlay && scheme === "color_overlay" ? shareHeight : recHeight,
        rawRecRgba,
        recMeta
      );

      const enhancedRecPngBytes = enhancedRecRgba
        ? encodeRgbaToPng(recWidth, recHeight, enhancedRecRgba, recMeta)
        : rawRecPngBytes;

      const elapsed = performance.now() - t0;
      const metrics = computeMetrics(
        rgba,
        enhancedRecRgba || rawRecRgba,
        width,
        height,
        isOverlay,
        elapsed
      );

      const result: WorkerGenerateResult = {
        shares: sharesPayload,
        reconstruction: {
          filename: `veilshare-reveal-${scheme}-${groupId}.png`,
          rawPngBytes: rawRecPngBytes,
          enhancedPngBytes: enhancedRecPngBytes,
          width: recWidth,
          height: recHeight,
          metadata: recMeta,
        },
        metrics,
        groupId,
        scheme,
        n: sharesPayload.length,
        secretPngBytes,
      };

      self.postMessage({ type: "SUCCESS", id, result });
    } else if (action === "RECONSTRUCT") {
      const { files, modeOverride, nTotal } = payload as {
        files: Array<{ name: string; bytes: ArrayBuffer; rgba: Uint8Array; width: number; height: number }>;
        modeOverride?: string;
        nTotal?: number;
      };

      if (!files || files.length === 0) {
        throw new Error("No share files provided for reconstruction.");
      }

      // Check 1: Wrong kind (e.g. user dropped a reconstruction file instead of a share)
      for (const f of files) {
        const meta = parsePngMetadata(f.bytes);
        if (meta.vc_kind === "reconstruction") {
          self.postMessage({
            type: "ERROR",
            id,
            error: {
              code: "RECONSTRUCTION_DROPPED",
              message: `"${f.name}" is a reconstruction result, not a visual share. Please upload the noise share files (share-1 / share-2).`,
            },
          });
          return;
        }
      }

      // Check 2: Same file twice (across all pairs)
      if (files.length >= 2) {
        for (let i = 0; i < files.length; i++) {
          for (let j = i + 1; j < files.length; j++) {
            const b1 = new Uint8Array(files[i].bytes);
            const b2 = new Uint8Array(files[j].bytes);
            if (b1.length === b2.length) {
              let identical = true;
              for (let k = 0; k < Math.min(b1.length, 1000); k++) {
                if (b1[k] !== b2[k]) {
                  identical = false;
                  break;
                }
              }
              if (identical) {
                self.postMessage({
                  type: "ERROR",
                  id,
                  error: {
                    code: "IDENTICAL_SHARES",
                    message: `Shares "${files[i].name}" and "${files[j].name}" contain the exact same data. Distinct shares are required to reconstruct.`,
                  },
                });
                return;
              }
            }
          }
        }
      }

      // Check 3: Dimension Mismatch
      const baseW = files[0].width;
      const baseH = files[0].height;
      for (let i = 1; i < files.length; i++) {
        if (files[i].width !== baseW || files[i].height !== baseH) {
          self.postMessage({
            type: "ERROR",
            id,
            error: {
              code: "DIMENSION_MISMATCH",
              message: `Share dimensions do not match (${files[0].width}×${files[0].height} vs ${files[i].width}×${files[i].height}). Shares must be identical in size.`,
            },
          });
          return;
        }
      }

      // Detect scheme from metadata or fallback
      const m0 = parsePngMetadata(files[0].bytes);
      const scheme = modeOverride || m0.vc_scheme || "color_overlay";
      const group0 = m0.vc_group;

      // Check 4: Group ID Mismatch
      if (files.length > 1) {
        const groups = files
          .map((f) => parsePngMetadata(f.bytes).vc_group)
          .filter(Boolean);
        if (groups.length > 1 && new Set(groups).size > 1) {
          self.postMessage({
            type: "ERROR",
            id,
            error: {
              code: "GROUP_MISMATCH",
              message: "These shares belong to different generation runs (group ID mismatch). Stacking them will result in uncorrelated noise.",
            },
          });
          return;
        }
      }

      const isOverlay = scheme === "color_overlay" || scheme === "overlay";
      const required = isOverlay ? 2 : (nTotal || parseInt(m0.vc_n || "2", 10));
      const supplied = files.length;
      const sufficient = supplied >= required;

      let rawRecRgba: Uint8Array;
      let enhancedRecRgba: Uint8Array | undefined;
      let outW = baseW;
      let outH = baseH;

      if (scheme === "color_overlay") {
        rawRecRgba = files.length >= 2
          ? computeSubtractiveStack(files[0].rgba, files[1].rgba)
          : files[0].rgba.slice();
        if (sufficient) {
          outW = baseW / 2;
          outH = baseH / 2;
          enhancedRecRgba = recoverColorFromStack(rawRecRgba, outW, outH);
        }
      } else if (scheme === "color_xor") {
        rawRecRgba = reconstructColorXor(files.map((f) => f.rgba));
        enhancedRecRgba = rawRecRgba;
      } else if (scheme === "overlay") {
        if (files.length >= 2) {
          rawRecRgba = new Uint8Array(files[0].rgba.length);
          for (let i = 0; i < rawRecRgba.length; i += 4) {
            const v = Math.min(files[0].rgba[i], files[1].rgba[i]);
            rawRecRgba[i] = v;
            rawRecRgba[i + 1] = v;
            rawRecRgba[i + 2] = v;
            rawRecRgba[i + 3] = 255;
          }
        } else {
          rawRecRgba = files[0].rgba.slice();
        }
        enhancedRecRgba = rawRecRgba;
      } else {
        rawRecRgba = reconstructBwXor(files.map((f) => f.rgba));
        enhancedRecRgba = rawRecRgba;
      }

      const recMeta: PngMetadata = {
        vc_kind: "reconstruction",
        vc_scheme: scheme,
        vc_version: "3.0",
        vc_group: group0 || "recon",
        vc_w: String(outW),
        vc_h: String(outH),
      };

      const rawStackPngBytes = encodeRgbaToPng(baseW, baseH, rawRecRgba, recMeta);
      const enhancedPngBytes = enhancedRecRgba
        ? encodeRgbaToPng(outW, outH, enhancedRecRgba, recMeta)
        : rawStackPngBytes;

      const result: WorkerReconstructResult = {
        rawStackPngBytes,
        enhancedPngBytes,
        width: outW,
        height: outH,
        scheme,
        sufficient,
        supplied,
        required,
        groupId: group0,
      };

      self.postMessage({ type: "SUCCESS", id, result });
    } else if (action === "COMPARE") {
      const { rgbaBuffer, width, height } = payload;
      const rgba = new Uint8Array(rgbaBuffer);

      // Run all 4 schemes and gather metrics
      const schemes: Array<{ id: string; name: string }> = [
        { id: "color_overlay", name: "Colour Overlay 2-of-2 (P5, Hou CMY)" },
        { id: "color_xor", name: "Colour XOR (n,n) Exact (P6 Extension)" },
        { id: "overlay", name: "B/W Overlay 2-of-2 (P1, Naor-Shamir)" },
        { id: "xor", name: "B/W XOR (n,n) (P6, Wang et al.)" },
      ];

      const results: WorkerCompareItem[] = [];

      for (const sc of schemes) {
        const t0 = performance.now();
        let rec: Uint8Array;
        let isOverlay = false;

        if (sc.id === "color_overlay") {
          isOverlay = true;
          const res = generateColorOverlay(rgba, width, height);
          rec = res.enhancedRevealRgba;
        } else if (sc.id === "color_xor") {
          isOverlay = false;
          const res = generateColorXor(rgba, width, height, 2);
          rec = res.reconstruction;
        } else if (sc.id === "overlay") {
          isOverlay = true;
          const res = generateBwOverlay(rgba, width, height);
          rec = res.rawStackRgba;
        } else {
          isOverlay = false;
          const res = generateBwXor(rgba, width, height, 2);
          rec = res.reconstruction;
        }

        const elapsed = performance.now() - t0;
        const metrics = computeMetrics(rgba, rec, width, height, isOverlay, elapsed);
        results.push({ schemeId: sc.id, name: sc.name, metrics });
      }

      self.postMessage({ type: "SUCCESS", id, result: { results } });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: "ERROR", id, error: { code: "INTERNAL", message: errorMsg } });
  }
};

import { describe, it, expect } from "vitest";
import { generateColorOverlay, computeSubtractiveStack, recoverColorFromStack } from "../../src/engine/colorOverlay";
import { generateColorXor, reconstructColorXor } from "../../src/engine/colorXor";
import { generateBwOverlay } from "../../src/engine/bwOverlay";
import { generateBwXor, reconstructBwXor } from "../../src/engine/bwXor";
import { encodeRgbaToPng, parsePngMetadata } from "../../src/engine/pngChunk";
import { computeMetrics } from "../../src/engine/metrics";
import { generateProceduralDemoImage } from "../../src/engine/proceduralSample";

describe("On-Device Cryptographic Engine", () => {
  describe("PNG Encoder & Metadata Chunks", () => {
    it("should encode RGBA image and preserve custom tEXt chunks", () => {
      const width = 4;
      const height = 4;
      const rgba = new Uint8Array(width * height * 4);
      for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = 255; // R
        rgba[i + 1] = 0; // G
        rgba[i + 2] = 128; // B
        rgba[i + 3] = 255; // A
      }

      const meta = {
        vc_scheme: "COLOR_OVERLAY",
        vc_index: "0",
        vc_total: "2",
        vc_group: "test-grp-123",
        vc_stage: "Final Review",
      };

      const pngBytes = encodeRgbaToPng(width, height, rgba, meta);
      expect(pngBytes).toBeInstanceOf(Uint8Array);
      expect(pngBytes.length).toBeGreaterThan(50);

      // Verify PNG signature: 137 80 78 71 13 10 26 10
      expect(pngBytes[0]).toBe(0x89);
      expect(pngBytes[1]).toBe(0x50);
      expect(pngBytes[2]).toBe(0x4e);
      expect(pngBytes[3]).toBe(0x47);

      // Parse metadata back
      const parsedMeta = parsePngMetadata(pngBytes);
      expect(parsedMeta.vc_scheme).toBe("COLOR_OVERLAY");
      expect(parsedMeta.vc_index).toBe("0");
      expect(parsedMeta.vc_group).toBe("test-grp-123");
    });
  });

  describe("Color Overlay (Mode A - Hou 2003)", () => {
    it("should expand dimensions by 2x and produce 2 valid shares", () => {
      const width = 8;
      const height = 8;
      const rgba = new Uint8Array(width * height * 4);
      // Fill with colorful blocks
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          rgba[idx] = x < 4 ? 255 : 0;
          rgba[idx + 1] = y < 4 ? 255 : 0;
          rgba[idx + 2] = (x + y) % 2 === 0 ? 255 : 0;
          rgba[idx + 3] = 255;
        }
      }

      const result = generateColorOverlay(rgba, width, height);
      expect(result.shareWidth).toBe(width * 2);
      expect(result.shareHeight).toBe(height * 2);
      expect(result.share1Rgba.length).toBe(width * 2 * (height * 2) * 4);
      expect(result.share2Rgba.length).toBe(width * 2 * (height * 2) * 4);

      // Physical optical superposition (subtractive stack)
      const stackRgba = computeSubtractiveStack(result.share1Rgba, result.share2Rgba);
      expect(stackRgba.length).toBe(result.share1Rgba.length);

      // Enhanced colour recovery (2x2 block de-expansion)
      const enhancedRgba = recoverColorFromStack(stackRgba, width, height);
      expect(enhancedRgba.length).toBe(width * height * 4);

      // Compare original vs enhanced
      const metrics = computeMetrics(rgba, enhancedRgba, width, height, true, 10);
      expect(metrics.psnr).toBeGreaterThan(5);
      expect(metrics.contrast).toBeGreaterThan(0.1);
    });
  });

  describe("Color XOR (Mode B - Wang et al. 2005)", () => {
    it("should achieve byte-exact 100% reconstruction for n=2, 3, 4, 5", () => {
      const width = 16;
      const height = 16;
      const rgba = new Uint8Array(width * height * 4);
      for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = (i * 17) % 256;
        rgba[i + 1] = (i * 31) % 256;
        rgba[i + 2] = (i * 73) % 256;
        rgba[i + 3] = 255;
      }

      for (const n of [2, 3, 4, 5]) {
        const result = generateColorXor(rgba, width, height, n);
        expect(result.shares.length).toBe(n);
        expect(result.width).toBe(width);
        expect(result.height).toBe(height);

        // Individual share randomness: verify it is not identical to secret
        const share0 = result.shares[0];
        let diff = 0;
        for (let i = 0; i < rgba.length; i += 4) {
          if (share0[i] !== rgba[i] || share0[i + 1] !== rgba[i + 1] || share0[i + 2] !== rgba[i + 2]) {
            diff++;
          }
        }
        expect(diff).toBeGreaterThan(width * height * 0.9);

        // Reconstruction
        const reconstructed = reconstructColorXor(result.shares);
        expect(reconstructed.length).toBe(rgba.length);

        // Byte-exact verification
        let mismatchCount = 0;
        for (let i = 0; i < rgba.length; i++) {
          if (reconstructed[i] !== rgba[i]) mismatchCount++;
        }
        expect(mismatchCount).toBe(0);

        const metrics = computeMetrics(rgba, reconstructed, width, height, false, 5);
        expect(metrics.exactMatch).toBe(true);
        expect(metrics.mse).toBe(0);
        expect(metrics.psnr).toBe(999);
      }
    });
  });

  describe("Binary Overlay (Mode C - Naor & Shamir 1994)", () => {
    it("should generate 2x2 binary subpixel shares and reconstruct via physical superposition", () => {
      const width = 8;
      const height = 8;
      const rgba = new Uint8Array(width * height * 4);
      for (let i = 0; i < rgba.length; i += 4) {
        // Black and white checkerboard
        const pixelIdx = i / 4;
        const isWhite = (Math.floor(pixelIdx / width) + (pixelIdx % width)) % 2 === 0;
        const val = isWhite ? 255 : 0;
        rgba[i] = val;
        rgba[i + 1] = val;
        rgba[i + 2] = val;
        rgba[i + 3] = 255;
      }

      const result = generateBwOverlay(rgba, width, height);
      expect(result.shareWidth).toBe(width * 2);
      expect(result.shareHeight).toBe(height * 2);
      expect(result.share1Rgba.length).toBe(width * 2 * (height * 2) * 4);
      expect(result.share2Rgba.length).toBe(width * 2 * (height * 2) * 4);
      expect(result.rawStackRgba.length).toBe(width * 2 * (height * 2) * 4);
    });
  });

  describe("Binary XOR (Mode D)", () => {
    it("should reconstruct exact binary secret for n=2, 3", () => {
      const width = 10;
      const height = 10;
      const rgba = new Uint8Array(width * height * 4);
      for (let i = 0; i < rgba.length; i += 4) {
        const val = (i % 8 === 0) ? 255 : 0;
        rgba[i] = val;
        rgba[i + 1] = val;
        rgba[i + 2] = val;
        rgba[i + 3] = 255;
      }

      for (const n of [2, 3]) {
        const result = generateBwXor(rgba, width, height, n);
        const reconstructed = reconstructBwXor(result.shares);
        const metrics = computeMetrics(rgba, reconstructed, width, height, false, 5);
        expect(metrics.exactMatch).toBe(true);
        expect(metrics.mse).toBe(0);
      }
    });
  });

  describe("Procedural Demo Sample Generator", () => {
    it("should produce valid RGBA canvas buffer with quadrant colors and text patterns", () => {
      const sample = generateProceduralDemoImage(320, 180);
      expect(sample).toBeInstanceOf(Uint8Array);
      expect(sample.length).toBe(320 * 180 * 4);
    });
  });
});

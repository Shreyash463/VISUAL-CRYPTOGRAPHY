/**
 * Generates an authentic, vibrant procedural test image for Demo Mode.
 * Fully algorithmic, zero copyrighted material, rich color palette across all quadrants.
 */

export function generateProceduralDemoImage(width = 320, height = 320): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 240;
      let g = 240;
      let b = 240;

      // Quadrant base colors
      if (x < cx && y < cy) {
        // Top-Left: Vivid Red / Coral
        r = 230;
        g = 45;
        b = 60;
      } else if (x >= cx && y < cy) {
        // Top-Right: Deep Emerald / Mint
        r = 30;
        g = 180;
        b = 110;
      } else if (x < cx && y >= cy) {
        // Bottom-Left: Bright Royal Blue
        r = 40;
        g = 110;
        b = 240;
      } else {
        // Bottom-Right: Rich Golden Amber
        r = 245;
        g = 180;
        b = 25;
      }

      // Center Circle Emblem
      if (dist < radius) {
        // Concentric rings with high contrast
        const ring = Math.floor(dist / 14);
        if (ring % 2 === 0) {
          r = 255;
          g = 255;
          b = 255; // White ring
        } else {
          r = 15;
          g = 20;
          b = 35; // Obsidian ring
        }

        // Inner Shield / Padlock silhouette
        if (dist < radius * 0.45) {
          r = 229;
          g = 50;
          b = 63; // Laser Red
        }
      }

      // Outer border
      if (x < 6 || x >= width - 6 || y < 6 || y >= height - 6) {
        r = 20;
        g = 25;
        b = 40;
      }

      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = 255;
    }
  }

  return rgba;
}

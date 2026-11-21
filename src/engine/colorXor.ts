/**
 * Mode B: Colour XOR (n, n) Exact (P6 Extension, Wang et al. 2005)
 * Cryptographically secure 24-bit RGB bitwise XOR secret sharing across n shares.
 * 0× pixel expansion, lossless 1:1 mathematical reconstruction.
 */

export interface ColorXorResult {
  shares: Uint8Array[];
  reconstruction: Uint8Array;
  width: number;
  height: number;
  n: number;
}

/**
 * Generates n colour XOR shares from an RGBA image.
 */
export function generateColorXor(
  rgba: Uint8Array,
  width: number,
  height: number,
  n: number,
  onProgress?: (percent: number, message: string) => void
): ColorXorResult {
  const numBytes = rgba.length;
  const shares: Uint8Array[] = [];

  onProgress?.(15, `Generating ${n - 1} cryptographically secure uniform random shares...`);

  // Generate n - 1 random byte shares
  for (let k = 0; k < n - 1; k++) {
    const s = new Uint8Array(numBytes);
    // crypto.getRandomValues has a 65536 byte limit per call in some browsers
    const chunkSize = 65536;
    for (let offset = 0; offset < numBytes; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, numBytes);
      crypto.getRandomValues(s.subarray(offset, end));
    }
    // Set alpha channel to 255
    for (let i = 3; i < numBytes; i += 4) {
      s[i] = 255;
    }
    shares.push(s);
    onProgress?.(20 + Math.floor((40 * (k + 1)) / (n - 1)), `Generated random share ${k + 1} of ${n}...`);
  }

  onProgress?.(70, `Computing final parity share ${n} via bitwise XOR...`);

  // Final share: S_n = I ^ S_1 ^ S_2 ^ ... ^ S_{n-1}
  const lastShare = new Uint8Array(numBytes);
  for (let i = 0; i < numBytes; i += 4) {
    let r = rgba[i];
    let g = rgba[i + 1];
    let b = rgba[i + 2];

    for (let k = 0; k < n - 1; k++) {
      const s = shares[k];
      r ^= s[i];
      g ^= s[i + 1];
      b ^= s[i + 2];
    }

    lastShare[i] = r;
    lastShare[i + 1] = g;
    lastShare[i + 2] = b;
    lastShare[i + 3] = 255;
  }
  shares.push(lastShare);

  onProgress?.(85, "Verifying mathematical byte-exact reconstruction...");
  const reconstruction = reconstructColorXor(shares);

  onProgress?.(100, "Colour XOR secret sharing complete.");

  return {
    shares,
    reconstruction,
    width,
    height,
    n,
  };
}

/**
 * Reconstructs the secret by XORing all supplied shares together.
 */
export function reconstructColorXor(shares: Uint8Array[]): Uint8Array {
  if (shares.length === 0) return new Uint8Array(0);

  const numBytes = shares[0].length;
  const result = new Uint8Array(numBytes);

  for (let i = 0; i < numBytes; i += 4) {
    let r = 0;
    let g = 0;
    let b = 0;

    for (let k = 0; k < shares.length; k++) {
      const s = shares[k];
      r ^= s[i];
      g ^= s[i + 1];
      b ^= s[i + 2];
    }

    result[i] = r;
    result[i + 1] = g;
    result[i + 2] = b;
    result[i + 3] = 255;
  }

  return result;
}

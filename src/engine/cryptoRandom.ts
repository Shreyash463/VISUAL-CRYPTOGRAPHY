/**
 * Fills an arbitrary-length Uint8Array with cryptographically secure random bytes
 * while respecting the Web Crypto API limit (maximum 65,536 bytes per call).
 */
export function fillCryptoRandomValues(buffer: Uint8Array): Uint8Array {
  const CHUNK_SIZE = 65536;
  for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
    const end = Math.min(offset + CHUNK_SIZE, buffer.length);
    crypto.getRandomValues(buffer.subarray(offset, end));
  }
  return buffer;
}

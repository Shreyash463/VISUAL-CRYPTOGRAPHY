"""XOR mode (Wang et al. 2005) share generation and reconstruction."""
from typing import List
import numpy as np
from vc import rng


def generate_xor_shares(S: np.ndarray, n: int) -> List[np.ndarray]:
    """Generate n (n, n) visual cryptography shares for secret S using XOR.

    Args:
        S: uint8 array of shape (H, W) where 1=black, 0=white.
        n: Number of shares (2 <= n <= 6).

    Returns:
        List of n uint8 arrays of shape (H, W).
    """
    if n < 2 or n > 6:
        raise ValueError(f"XOR mode requires n between 2 and 6, got {n}")

    H, W = S.shape
    shares: List[np.ndarray] = []
    accum = S.copy().astype(np.uint8)

    for _ in range(n - 1):
        share_i = rng.random_bits(H * W).reshape(H, W)
        shares.append(share_i)
        accum ^= share_i

    shares.append(accum)
    return shares


def reconstruct_xor(shares: List[np.ndarray]) -> np.ndarray:
    """Reconstruct image from XOR shares by bitwise XOR.

    Args:
        shares: List of uint8 arrays of identical shape (H, W).

    Returns:
        Combined uint8 array of shape (H, W).
    """
    if not shares:
        raise ValueError("Cannot reconstruct from empty shares list.")
    if len(shares) == 1:
        return shares[0].copy()
    return np.bitwise_xor.reduce(shares)

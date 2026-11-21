"""Colour XOR mode (8-bit per-channel extension of Wang et al. 2005 / P6).

Implements n-out-of-n secret sharing on full 24-bit RGB images using bitwise XOR.
Produces zero pixel expansion and byte-for-byte exact color reconstruction.
"""
import secrets
from typing import List
import numpy as np


def generate_color_xor_shares(rgb: np.ndarray, n: int) -> List[np.ndarray]:
    """Generate n (n, n) shares for secret RGB image using bitwise XOR.

    Args:
        rgb: uint8 array of shape (H, W, 3) representing 24-bit RGB image.
        n: Total number of shares (2 <= n <= 6).

    Returns:
        List of n uint8 arrays of shape (H, W, 3).
    """
    if n < 2 or n > 6:
        raise ValueError(f"Color XOR mode requires n between 2 and 6, got {n}")

    H, W, C = rgb.shape
    total_bytes = H * W * C
    shares: List[np.ndarray] = []
    accum = rgb.copy().astype(np.uint8)

    for _ in range(n - 1):
        random_bytes = secrets.token_bytes(total_bytes)
        share_i = np.frombuffer(random_bytes, dtype=np.uint8).reshape(H, W, C)
        shares.append(share_i)
        accum ^= share_i

    shares.append(accum)
    return shares


def reconstruct_color_xor(shares: List[np.ndarray]) -> np.ndarray:
    """Reconstruct RGB image from XOR shares by bitwise XOR.

    Args:
        shares: List of uint8 arrays of identical shape (H, W, 3).

    Returns:
        Exact combined uint8 array of shape (H, W, 3).
    """
    if not shares:
        raise ValueError("Cannot reconstruct from empty shares list.")
    if len(shares) == 1:
        return shares[0].copy()
    return np.bitwise_xor.reduce(shares)

"""Overlay mode (Naor & Shamir 1994) share generation and reconstruction."""
from typing import List
import numpy as np
from vc.config import OVERLAY_PATTERNS, OVERLAY_COMPLEMENT
from vc import rng


def generate_overlay_shares(S: np.ndarray) -> List[np.ndarray]:
    """Generate two 2-out-of-2 visual cryptography shares for secret S.

    Args:
        S: uint8 array of shape (H, W) where 1=black, 0=white.

    Returns:
        List of two uint8 arrays of shape (2H, 2W) where 1=black, 0=white.
    """
    H, W = S.shape
    idx1 = rng.random_indices_below_6(H * W).reshape(H, W)
    idx2 = np.where(S == 1, OVERLAY_COMPLEMENT[idx1], idx1)

    # OVERLAY_PATTERNS has shape (6, 2, 2)
    blocks1 = OVERLAY_PATTERNS[idx1]  # shape (H, W, 2, 2)
    blocks2 = OVERLAY_PATTERNS[idx2]  # shape (H, W, 2, 2)

    share1 = blocks1.transpose(0, 2, 1, 3).reshape(2 * H, 2 * W)
    share2 = blocks2.transpose(0, 2, 1, 3).reshape(2 * H, 2 * W)

    return [share1.astype(np.uint8), share2.astype(np.uint8)]


def reconstruct_overlay(shares: List[np.ndarray]) -> np.ndarray:
    """Reconstruct image from overlay shares by bitwise OR (stacking transparencies).

    Args:
        shares: List of uint8 arrays of identical shape (2H, 2W), where 1=black.

    Returns:
        Combined uint8 array of shape (2H, 2W).
    """
    if not shares:
        raise ValueError("Cannot reconstruct from empty shares list.")
    if len(shares) == 1:
        return shares[0].copy()
    return np.bitwise_or.reduce(shares)


def overlay_block_lightness(R: np.ndarray) -> np.ndarray:
    """Calculate lightness (fraction of white subpixels) for each 2x2 block.

    Args:
        R: uint8 array of shape (2H, 2W) where 1=black, 0=white.

    Returns:
        float array of shape (H, W) containing lightness in [0, 1].
    """
    H = R.shape[0] // 2
    W = R.shape[1] // 2
    blocks = R.reshape(H, 2, W, 2).transpose(0, 2, 1, 3)
    # 1=black, 0=white. Mean is black fraction; lightness is white fraction.
    return 1.0 - np.mean(blocks, axis=(2, 3))

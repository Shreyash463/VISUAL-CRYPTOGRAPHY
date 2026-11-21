"""Colour Overlay mode (P5, Hou 2003 style CMY visual cryptography).

Implements 2-out-of-2 visual cryptography for color images using CMY decomposition,
Floyd-Steinberg halftoning, and Naor-Shamir (2,2) subpixel expansion per channel.
Provides both raw physical stacking (per-channel min / multiply blend) and
display enhancement (2x2 coverage thresholding at 0.75 + light Gaussian smoothing).
"""
import secrets
from typing import List, Tuple
import numpy as np
from PIL import Image, ImageFilter

from vc.config import OVERLAY_PATTERNS, OVERLAY_COMPLEMENT
from vc import rng


def rgb_to_cmy_halftone(rgb: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Convert an RGB uint8 array (H, W, 3) to halftoned CMY ink bits.

    Returns:
        Tuple of (C_bits, M_bits, Y_bits), each uint8 array of shape (H, W),
        where 1 = ink present, 0 = no ink.
    """
    H, W, _ = rgb.shape
    # CMY ink amounts: 255 = maximum ink, 0 = no ink
    c_ink = (255 - rgb[:, :, 0]).astype(np.uint8)
    m_ink = (255 - rgb[:, :, 1]).astype(np.uint8)
    y_ink = (255 - rgb[:, :, 2]).astype(np.uint8)

    # Halftone each channel independently using Floyd-Steinberg error diffusion
    # In Pillow '1' mode, 255 (white) corresponds to high intensity (ink present)
    img_c = Image.fromarray(c_ink, mode="L").convert("1", dither=Image.Dither.FLOYDSTEINBERG)
    img_m = Image.fromarray(m_ink, mode="L").convert("1", dither=Image.Dither.FLOYDSTEINBERG)
    img_y = Image.fromarray(y_ink, mode="L").convert("1", dither=Image.Dither.FLOYDSTEINBERG)

    c_bits = (np.array(img_c.convert("L"), dtype=np.uint8) == 255).astype(np.uint8)
    m_bits = (np.array(img_m.convert("L"), dtype=np.uint8) == 255).astype(np.uint8)
    y_bits = (np.array(img_y.convert("L"), dtype=np.uint8) == 255).astype(np.uint8)

    return c_bits, m_bits, y_bits


def generate_color_overlay_shares(rgb: np.ndarray) -> List[np.ndarray]:
    """Generate two 2-out-of-2 visual cryptography shares for a color RGB image.

    Each pixel expands to 2x2 subpixels for C, M, and Y channels independently.
    In each channel, each share has exactly 2 inked subpixels per 2x2 block.

    Args:
        rgb: uint8 array of shape (H, W, 3).

    Returns:
        List of two uint8 arrays of shape (2H, 2W, 3) representing Share 1 and Share 2.
    """
    H, W, _ = rgb.shape
    c_bits, m_bits, y_bits = rgb_to_cmy_halftone(rgb)

    channels_bits = [c_bits, m_bits, y_bits]
    sub_ink_1 = []
    sub_ink_2 = []

    for bit_matrix in channels_bits:
        # Cryptographically secure random pattern index in {0..5} for each pixel
        idx1 = rng.random_indices_below_6(H * W).reshape(H, W)
        # If ink is present (1), share 2 receives complementary pattern; if 0, same pattern
        idx2 = np.where(bit_matrix == 1, OVERLAY_COMPLEMENT[idx1], idx1)

        # OVERLAY_PATTERNS shape is (6, 2, 2)
        b1 = OVERLAY_PATTERNS[idx1].transpose(0, 2, 1, 3).reshape(2 * H, 2 * W)
        b2 = OVERLAY_PATTERNS[idx2].transpose(0, 2, 1, 3).reshape(2 * H, 2 * W)

        sub_ink_1.append(b1)
        sub_ink_2.append(b2)

    # Subpixel RGB values: R = 255*(1 - C_ink), G = 255*(1 - M_ink), B = 255*(1 - Y_ink)
    r1 = 255 * (1 - sub_ink_1[0])
    g1 = 255 * (1 - sub_ink_1[1])
    b1 = 255 * (1 - sub_ink_1[2])
    share1 = np.stack([r1, g1, b1], axis=-1).astype(np.uint8)

    r2 = 255 * (1 - sub_ink_2[0])
    g2 = 255 * (1 - sub_ink_2[1])
    b2 = 255 * (1 - sub_ink_2[2])
    share2 = np.stack([r2, g2, b2], axis=-1).astype(np.uint8)

    return [share1, share2]


def reconstruct_color_overlay_raw(shares: List[np.ndarray]) -> np.ndarray:
    """Simulate physical transparency stacking via per-channel minimum (multiply blend).

    Args:
        shares: List of uint8 arrays of shape (2H, 2W, 3).

    Returns:
        Stacked uint8 array of shape (2H, 2W, 3).
    """
    if not shares:
        raise ValueError("Cannot reconstruct from empty shares list.")
    if len(shares) == 1:
        return shares[0].copy()
    return np.minimum.reduce(shares)


def reconstruct_color_overlay_enhanced(shares: List[np.ndarray], sigma: float = 0.8) -> np.ndarray:
    """Reconstruct color image with display enhancement.

    Averages each 2x2 block per channel into ink coverage:
    - 0.5 coverage = no ink (secret bit 0)
    - 1.0 coverage = full ink (secret bit 1)
    Thresholds at 0.75 to recover halftoned CMY bits at secret resolution,
    converts to RGB, and applies light Gaussian smoothing.

    Args:
        shares: List of uint8 arrays of shape (2H, 2W, 3).
        sigma: Gaussian smoothing radius (default 0.8).

    Returns:
        Enhanced reconstructed uint8 array of shape (H, W, 3).
    """
    raw_stack = reconstruct_color_overlay_raw(shares)
    H2, W2, _ = raw_stack.shape
    H, W = H2 // 2, W2 // 2

    # Invert RGB to ink amount: 0 -> 1, 255 -> 0
    # Since subpixels are pure 0 or 255, ink_amount is 1 if channel==0 else 0
    ink = (raw_stack == 0).astype(np.float32)

    # Average over 2x2 blocks for each channel
    # ink shape: (2H, 2W, 3) -> blocks shape: (H, 2, W, 2, 3) -> transpose to (H, W, 2, 2, 3)
    blocks = ink.reshape(H, 2, W, 2, 3).transpose(0, 2, 1, 3, 4)
    # block_coverage shape: (H, W, 3)
    block_coverage = np.mean(blocks, axis=(2, 3))

    # Threshold at 0.75: 0.5 becomes 0 (no ink), 1.0 becomes 1 (ink)
    recovered_ink = (block_coverage > 0.75).astype(np.uint8)

    # Convert back to RGB: R = 255 * (1 - C), G = 255 * (1 - M), B = 255 * (1 - Y)
    recovered_rgb = ((1 - recovered_ink) * 255).astype(np.uint8)

    # Light Gaussian blur for natural continuous tone appearance
    pil_img = Image.fromarray(recovered_rgb, mode="RGB")
    if sigma > 0:
        pil_img = pil_img.filter(ImageFilter.GaussianBlur(radius=sigma))

    return np.array(pil_img, dtype=np.uint8)

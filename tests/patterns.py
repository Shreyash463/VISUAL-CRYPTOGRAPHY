"""Deterministic 64x64 test patterns generated with NumPy only."""
from typing import Dict
import numpy as np


def generate_all_black() -> np.ndarray:
    return np.ones((64, 64), dtype=np.uint8)


def generate_all_white() -> np.ndarray:
    return np.zeros((64, 64), dtype=np.uint8)


def generate_checkerboard() -> np.ndarray:
    y, x = np.ogrid[:64, :64]
    return ((y // 8 + x // 8) % 2).astype(np.uint8)


def generate_horizontal_stripes() -> np.ndarray:
    y, _ = np.ogrid[:64, :64]
    return ((y // 4) % 2).astype(np.uint8)


def generate_filled_circle() -> np.ndarray:
    y, x = np.ogrid[:64, :64]
    dist_sq = (y - 31.5) ** 2 + (x - 31.5) ** 2
    return (dist_sq <= 24.0 ** 2).astype(np.uint8)


def generate_diagonal_gradient_halftoned() -> np.ndarray:
    y, x = np.ogrid[:64, :64]
    ramp = ((y + x) / 126.0) * 255.0
    bayer_4x4 = np.array([
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
    ], dtype=float)
    thresholds = np.tile((bayer_4x4 + 0.5) * (255.0 / 16.0), (16, 16))
    return (ramp < thresholds).astype(np.uint8)


def get_all_patterns() -> Dict[str, np.ndarray]:
    return {
        "all_black": generate_all_black(),
        "all_white": generate_all_white(),
        "checkerboard": generate_checkerboard(),
        "horizontal_stripes": generate_horizontal_stripes(),
        "filled_circle": generate_filled_circle(),
        "diagonal_gradient_halftoned": generate_diagonal_gradient_halftoned(),
    }

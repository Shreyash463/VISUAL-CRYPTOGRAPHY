"""Cryptographically secure pseudorandom number generators using Python's secrets module."""
import secrets
import numpy as np


def random_bits(count: int) -> np.ndarray:
    """Return an array of random uint8 bits (0 or 1) of length `count`."""
    if count <= 0:
        return np.empty(0, dtype=np.uint8)
    num_bytes = (count + 7) // 8
    b = secrets.token_bytes(num_bytes)
    unpacked = np.unpackbits(np.frombuffer(b, dtype=np.uint8))[:count]
    return unpacked.astype(np.uint8)


def random_indices_below_6(count: int) -> np.ndarray:
    """Return an array of integers in range [0, 5] of length `count` using rejection sampling."""
    if count <= 0:
        return np.empty(0, dtype=np.uint8)
    collected = []
    total = 0
    while total < count:
        remaining = count - total
        draw_len = int(remaining * 1.1) + 16
        b = secrets.token_bytes(draw_len)
        arr = np.frombuffer(b, dtype=np.uint8)
        valid = arr[arr < 252]
        mapped = valid % 6
        collected.append(mapped)
        total += len(mapped)
    return np.concatenate(collected)[:count].astype(np.uint8)

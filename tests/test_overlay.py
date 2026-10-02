"""Tests for 2-out-of-2 overlay visual cryptography scheme (M3/M4)."""
import pytest
import numpy as np
from vc.overlay import generate_overlay_shares, reconstruct_overlay, overlay_block_lightness
from vc.config import OVERLAY_PATTERNS
from tests.patterns import get_all_patterns

PATTERNS_DICT = get_all_patterns()

PATTERN_INT_MAP = {
    (1, 1, 0, 0): 0,
    (0, 0, 1, 1): 1,
    (1, 0, 1, 0): 2,
    (0, 1, 0, 1): 3,
    (1, 0, 0, 1): 4,
    (0, 1, 1, 0): 5,
}


@pytest.mark.parametrize("name,S", list(PATTERNS_DICT.items()))
def test_overlay_properties(name, S):
    H, W = S.shape
    shares = generate_overlay_shares(S)
    share1, share2 = shares

    # (1) shares have shape (2H, 2W)
    assert share1.shape == (2 * H, 2 * W)
    assert share2.shape == (2 * H, 2 * W)

    blocks1 = share1.reshape(H, 2, W, 2).transpose(0, 2, 1, 3)
    blocks2 = share2.reshape(H, 2, W, 2).transpose(0, 2, 1, 3)

    # (2) every 2x2 block of every share has exactly two black subpixels
    assert np.all(np.sum(blocks1, axis=(2, 3)) == 2)
    assert np.all(np.sum(blocks2, axis=(2, 3)) == 2)

    # (3) for secret-white pixels identical, for secret-black pixels exact complements
    if np.any(S == 0):
        assert np.all(blocks1[S == 0] == blocks2[S == 0])
    if np.any(S == 1):
        assert np.all(blocks1[S == 1] == (1 - blocks2[S == 1]))

    # (4) stacked result satisfies the SECTION 8 overlay rule exactly
    R = reconstruct_overlay(shares)
    L = overlay_block_lightness(R)
    if np.any(S == 1):
        assert np.all(np.isclose(L[S == 1], 0.0))
    if np.any(S == 0):
        assert np.all(np.isclose(L[S == 0], 0.5))

    # (5) each share's p_black_all is exactly 0.5 and equal in secret-black and secret-white regions
    for share, blocks in [(share1, blocks1), (share2, blocks2)]:
        assert np.mean(share == 1) == 0.5
        if np.any(S == 1):
            assert np.mean(blocks[S == 1] == 1) == 0.5
        if np.any(S == 0):
            assert np.mean(blocks[S == 0] == 1) == 0.5

    # (7) two runs on the same secret give different shares
    shares_run2 = generate_overlay_shares(S)
    assert not np.array_equal(share1, shares_run2[0])
    assert not np.array_equal(share2, shares_run2[1])


def test_overlay_pattern_frequencies_independence():
    """(6) for 128x128 all-black and all-white, share 1's pattern frequencies each within 10% of 2731."""
    for secret_val in (0, 1):
        S = np.full((128, 128), secret_val, dtype=np.uint8)
        shares = generate_overlay_shares(S)
        share1 = shares[0]
        H, W = S.shape
        blocks = share1.reshape(H, 2, W, 2).transpose(0, 2, 1, 3)

        flat_blocks = blocks.reshape(-1, 4)
        counts = [0] * 6
        for b in flat_blocks:
            idx = PATTERN_INT_MAP[tuple(b)]
            counts[idx] += 1

        for idx, count in enumerate(counts):
            dev = abs(count - 2731)
            assert dev <= 273.1, (
                f"Secret={secret_val} Pattern {idx} count {count} deviated by {dev} (> 10% of 2731)"
            )

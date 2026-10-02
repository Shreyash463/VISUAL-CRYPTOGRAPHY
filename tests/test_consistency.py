"""Tests for M3/M4 consistency: serialization roundtrip through PNG preserves reconstruction."""
import pytest
import numpy as np
from vc.overlay import generate_overlay_shares, reconstruct_overlay
from vc.xor import generate_xor_shares, reconstruct_xor
from vc.imageio import bits_to_png_bytes, png_bytes_to_bits
from tests.patterns import get_all_patterns

PATTERNS_DICT = get_all_patterns()


@pytest.mark.parametrize("name,S", list(PATTERNS_DICT.items()))
def test_overlay_consistency(name, S):
    # Overlay mode
    shares = generate_overlay_shares(S)
    rec_mem = reconstruct_overlay(shares)

    png_bytes_list = [bits_to_png_bytes(sh) for sh in shares]
    decoded_shares = [png_bytes_to_bits(b) for b in png_bytes_list]
    rec_from_bytes = reconstruct_overlay(decoded_shares)

    assert np.array_equal(rec_from_bytes, rec_mem)


@pytest.mark.parametrize("name,S", list(PATTERNS_DICT.items()))
def test_xor_consistency(name, S):
    # XOR mode (n=3)
    shares = generate_xor_shares(S, 3)
    rec_mem = reconstruct_xor(shares)

    png_bytes_list = [bits_to_png_bytes(sh) for sh in shares]
    decoded_shares = [png_bytes_to_bits(b) for b in png_bytes_list]
    rec_from_bytes = reconstruct_xor(decoded_shares)

    assert np.array_equal(rec_from_bytes, rec_mem)

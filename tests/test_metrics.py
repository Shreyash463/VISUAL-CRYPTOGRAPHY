"""Tests for FR-8 metrics calculation, contrast, leakage, and edge cases."""
import pytest
from vc.overlay import generate_overlay_shares, reconstruct_overlay
from vc.xor import generate_xor_shares, reconstruct_xor
from vc.metrics import compute_metrics
from tests.patterns import get_all_patterns

PATTERNS_DICT = get_all_patterns()
MIXED_PATTERNS = [
    p for name, p in PATTERNS_DICT.items() if name not in ("all_black", "all_white")
]


@pytest.mark.parametrize("S", MIXED_PATTERNS)
def test_overlay_metrics(S):
    shares = generate_overlay_shares(S)
    rec = reconstruct_overlay(shares)
    metrics = compute_metrics(S, shares, rec, "overlay", 2, 1.5, 3.0)

    assert metrics["pixel_expansion"] == 4.0
    assert metrics["subpixels_per_secret_pixel"] == 4
    assert metrics["contrast"]["theoretical"] == 0.5
    assert metrics["contrast"]["relative_difference"] == 0.5
    assert metrics["contrast"]["matches_theory"] is True
    assert metrics["leakage"]["all_passed"] is True
    assert metrics["reconstruction_check"]["passed"] is True


@pytest.mark.parametrize("n", [2, 3, 4, 5, 6])
@pytest.mark.parametrize("S", MIXED_PATTERNS)
def test_xor_metrics(n, S):
    shares = generate_xor_shares(S, n)
    rec = reconstruct_xor(shares)
    metrics = compute_metrics(S, shares, rec, "xor", n, 1.5, 3.0)

    assert metrics["pixel_expansion"] == 1.0
    assert metrics["subpixels_per_secret_pixel"] == 1
    assert metrics["contrast"]["theoretical"] == 1.0
    assert metrics["contrast"]["relative_difference"] == 1.0
    assert metrics["contrast"]["matches_theory"] is True
    assert metrics["leakage"]["all_passed"] is True
    assert metrics["reconstruction_check"]["passed"] is True


@pytest.mark.parametrize("pattern_name", ["all_black", "all_white"])
@pytest.mark.parametrize("mode", ["overlay", "xor"])
def test_monochrome_contrast_null(pattern_name, mode):
    S = PATTERNS_DICT[pattern_name]
    if mode == "overlay":
        shares = generate_overlay_shares(S)
        rec = reconstruct_overlay(shares)
        n = 2
    else:
        shares = generate_xor_shares(S, 2)
        rec = reconstruct_xor(shares)
        n = 2

    metrics = compute_metrics(S, shares, rec, mode, n, 1.0, 2.0)
    assert metrics["contrast"]["relative_difference"] is None
    assert metrics["contrast"]["matches_theory"] is None
    assert metrics["reconstruction_check"]["passed"] is True

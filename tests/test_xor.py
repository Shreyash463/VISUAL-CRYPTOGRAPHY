"""Tests for (n,n) XOR visual cryptography scheme (M3/M4)."""
import itertools
import pytest
import numpy as np
from vc.xor import generate_xor_shares, reconstruct_xor
from vc.metrics import compute_leakage_tolerance
from tests.patterns import get_all_patterns

PATTERNS_DICT = get_all_patterns()


@pytest.mark.parametrize("n", [2, 3, 4, 5, 6])
@pytest.mark.parametrize("pattern_name,S", list(PATTERNS_DICT.items()))
def test_xor_properties(n, pattern_name, S):
    shares = generate_xor_shares(S, n)

    # (1) share shape == secret shape (expansion 1)
    assert len(shares) == n
    for share in shares:
        assert share.shape == S.shape

    # (2) XOR of all shares equals S exactly
    full_reconstruction = reconstruct_xor(shares)
    assert np.array_equal(full_reconstruction, S)

    # (3) for every proper non-empty subset
    indices = list(range(n))
    for r in range(1, n):
        for subset_idx in itertools.combinations(indices, r):
            sub_shares = [shares[i] for i in subset_idx]
            sub_rec = reconstruct_xor(sub_shares)

            # Black proportion within D7 tolerance of 0.5
            p_black = float(np.mean(sub_rec == 1))
            tol = compute_leakage_tolerance(sub_rec.size)
            assert abs(p_black - 0.5) <= tol, (
                f"Subset {subset_idx} black proportion {p_black} exceeded tolerance {tol}"
            )

            # Differs from S in 0.35 to 0.65 on checkerboard and filled_circle
            if pattern_name in ("checkerboard", "filled_circle"):
                diff_fraction = float(np.mean(sub_rec != S))
                assert 0.35 <= diff_fraction <= 0.65, (
                    f"Pattern {pattern_name} subset {subset_idx} diff fraction {diff_fraction} "
                    f"outside [0.35, 0.65]"
                )

    # (4) each single share's black proportion within D7 tolerance
    for idx, share in enumerate(shares):
        p_black = float(np.mean(share == 1))
        tol = compute_leakage_tolerance(share.size)
        assert abs(p_black - 0.5) <= tol, (
            f"Share {idx} black proportion {p_black} exceeded tolerance {tol}"
        )

    # (5) two runs differ
    shares2 = generate_xor_shares(S, n)
    assert not all(np.array_equal(shares[i], shares2[i]) for i in range(n))

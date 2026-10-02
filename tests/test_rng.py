"""Tests for CSPRNG helpers in vc/rng.py and forbidden randomness scan."""
from pathlib import Path
import numpy as np
from vc.rng import random_bits, random_indices_below_6


def test_no_forbidden_randomness():
    """Verify no forbidden random imports or numpy random calls exist in vc/ or app.py."""
    project_root = Path(__file__).parent.parent
    py_files = list((project_root / "vc").glob("**/*.py")) + [project_root / "app.py"]
    forbidden = [
        "import " + "random",
        "from " + "random",
        "numpy." + "random",
        "np." + "random",
    ]
    for py_file in py_files:
        content = py_file.read_text(encoding="utf-8")
        for term in forbidden:
            assert term not in content, f"Forbidden randomness pattern '{term}' found in {py_file.name}"


def test_random_indices_below_6_distribution():
    """Test 600,000 draws from random_indices_below_6: each of 0..5 within 2% of 100,000."""
    draws = random_indices_below_6(600_000)
    assert len(draws) == 600_000
    counts = np.bincount(draws, minlength=6)
    for idx, c in enumerate(counts):
        diff = abs(c - 100_000)
        assert diff <= 2000, f"Bin {idx} count {c} deviated by {diff} (> 2000) from 100,000"


def test_random_bits_distribution():
    """Test 100,000 draws from random_bits: mean within 0.01 of 0.5."""
    bits = random_bits(100_000)
    assert len(bits) == 100_000
    mean = float(np.mean(bits))
    assert abs(mean - 0.5) <= 0.01, f"Mean {mean} deviated by > 0.01 from 0.5"

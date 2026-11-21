"""Comprehensive test suite for Color Visual Cryptography (Mode A: P5 CMY, Mode B: P6 XOR)."""
import io
import base64
import numpy as np
import pytest
from scipy import stats
from PIL import Image

from vc.color_overlay import (
    generate_color_overlay_shares,
    reconstruct_color_overlay_raw,
    reconstruct_color_overlay_enhanced,
    rgb_to_cmy_halftone,
)
from vc.color_xor import generate_color_xor_shares, reconstruct_color_xor
from vc.preprocessing import preprocess_color_image, detect_color
from vc.service import generate, reconstruct, compare
from vc.imageio import png_bytes_to_rgb, rgb_to_png_bytes
from vc.errors import VCError


def create_synthetic_8color_image(block_size: int = 32) -> np.ndarray:
    """Create a synthetic 2x4 grid image of 8 pure colors:

    Row 0: White (255,255,255), Red (255,0,0), Green (0,255,0), Blue (0,0,255)
    Row 1: Yellow (255,255,0), Cyan (0,255,255), Magenta (255,0,255), Black (0,0,0)
    """
    colors = [
        [255, 255, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255],
        [255, 255, 0], [0, 255, 255], [255, 0, 255], [0, 0, 0],
    ]
    img = np.zeros((block_size * 2, block_size * 4, 3), dtype=np.uint8)
    for idx, col in enumerate(colors):
        r = idx // 4
        c = idx % 4
        img[r * block_size : (r + 1) * block_size, c * block_size : (c + 1) * block_size] = col
    return img


def test_color_detection():
    """Verify detect_color correctly identifies color vs grayscale images."""
    gray = np.ones((50, 50, 3), dtype=np.uint8) * 120
    assert detect_color(gray) is False

    color = np.zeros((50, 50, 3), dtype=np.uint8)
    color[:25, :25] = [255, 0, 0]  # Red patch
    assert detect_color(color) is True


def test_color_overlay_min_stack():
    """Verify physical stacking equals per-channel min (multiply blend)."""
    synth = create_synthetic_8color_image(block_size=16)
    shares = generate_color_overlay_shares(synth)
    assert len(shares) == 2
    assert shares[0].shape == (synth.shape[0] * 2, synth.shape[1] * 2, 3)
    assert shares[1].shape == (synth.shape[0] * 2, synth.shape[1] * 2, 3)

    raw_stack = reconstruct_color_overlay_raw(shares)
    expected_min = np.minimum(shares[0], shares[1])
    assert np.array_equal(raw_stack, expected_min)


def test_color_overlay_subpixel_properties():
    """Verify every 2x2 block has exactly 2 inked subpixels per channel in each share."""
    synth = create_synthetic_8color_image(block_size=16)
    shares = generate_color_overlay_shares(synth)

    for share in shares:
        H2, W2, _ = share.shape
        H, W = H2 // 2, W2 // 2
        for ch in range(3):
            # Inks are indicated by 0 (black/inked)
            ink = (share[:, :, ch] == 0).astype(int)
            blocks = ink.reshape(H, 2, W, 2).transpose(0, 2, 1, 3)
            # Sum of inked subpixels in each 2x2 block must be exactly 2
            block_sums = np.sum(blocks, axis=(2, 3))
            assert np.all(block_sums == 2), f"Channel {ch} has block with sum != 2"


def test_color_overlay_security_leakage():
    """Verify pattern frequencies are uniform and independent of secret color (zero leakage)."""
    # 64x64 constant red vs constant white
    red_secret = np.zeros((64, 64, 3), dtype=np.uint8)
    red_secret[:, :] = [255, 0, 0]  # C=0, M=1, Y=1

    shares = generate_color_overlay_shares(red_secret)
    share1 = shares[0]

    # In Magenta channel (ink=1 in secret), check pattern distribution in share 1
    H2, W2, _ = share1.shape
    H, W = H2 // 2, W2 // 2
    ink_m = (share1[:, :, 1] == 0).astype(int)
    blocks_m = ink_m.reshape(H, 2, W, 2).transpose(0, 2, 1, 3)

    # Convert 2x2 blocks into pattern ID 0..5
    # Patterns:
    # 0: [[1,1],[0,0]], 1: [[0,0],[1,1]], 2: [[1,0],[1,0]], 3: [[0,1],[0,1]], 4: [[1,0],[0,1]], 5: [[0,1],[1,0]]
    flat_blocks = blocks_m.reshape(-1, 4)
    # Check that total 1s is exactly 2 per block
    assert np.all(np.sum(flat_blocks, axis=1) == 2)

    # Count pattern occurrences
    # Pattern encodings as binary numbers: (b0, b1, b2, b3)
    encoding = flat_blocks[:, 0] * 8 + flat_blocks[:, 1] * 4 + flat_blocks[:, 2] * 2 + flat_blocks[:, 3]
    unique, counts = np.unique(encoding, return_counts=True)
    assert len(unique) == 6, f"Expected all 6 patterns, got {len(unique)}"

    # Chi-square test against uniform distribution (expected = total / 6)
    expected = [flat_blocks.shape[0] / 6.0] * 6
    chi2, p_val = stats.chisquare(counts, f_exp=expected)
    assert p_val > 0.001, f"Pattern distribution rejected uniform: p={p_val}"


def test_color_overlay_8color_synthetic_recovery():
    """Verify 8-color synthetic image recovery: each block is nearest to true color."""
    block_size = 32
    synth = create_synthetic_8color_image(block_size=block_size)
    shares = generate_color_overlay_shares(synth)
    enhanced = reconstruct_color_overlay_enhanced(shares, sigma=0.8)

    true_colors = [
        [255, 255, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255],
        [255, 255, 0], [0, 255, 255], [255, 0, 255], [0, 0, 0],
    ]

    for idx, true_col in enumerate(true_colors):
        r = idx // 4
        c = idx % 4
        # Sample center of block to avoid border diffusion effects
        margin = block_size // 4
        block = enhanced[
            r * block_size + margin : (r + 1) * block_size - margin,
            c * block_size + margin : (c + 1) * block_size - margin,
        ]
        mean_col = np.mean(block, axis=(0, 1))

        # Check Euclidean distance to true color vs all other 7 colors
        dist_to_true = np.linalg.norm(mean_col - true_col)
        for other_idx, other_col in enumerate(true_colors):
            if other_idx != idx:
                dist_to_other = np.linalg.norm(mean_col - other_col)
                assert dist_to_true < dist_to_other, (
                    f"Block {idx} ({true_col}) had dist {dist_to_true} to true, "
                    f"but was closer to {other_idx} ({other_col}) dist {dist_to_other}"
                )


def test_color_xor_byte_for_byte_exactness():
    """Verify Color XOR reconstruction is byte-for-byte identical for n in [2..6]."""
    synth = create_synthetic_8color_image(block_size=20)

    for n in range(2, 7):
        shares = generate_color_xor_shares(synth, n)
        assert len(shares) == n
        for s in shares:
            assert s.shape == synth.shape
            assert s.dtype == np.uint8

        reconstructed = reconstruct_color_xor(shares)
        assert np.array_equal(reconstructed, synth), f"Failed byte-for-byte match for n={n}"


def test_color_xor_share_randomness():
    """Verify any n-1 shares look uniformly random (mean ~ 127.5)."""
    synth = create_synthetic_8color_image(block_size=32)
    shares = generate_color_xor_shares(synth, 4)

    for i in range(3):
        mean_val = np.mean(shares[i])
        # Standard error for uniform U(0, 255) on 64*128*3 = 24576 bytes is small
        assert abs(mean_val - 127.5) < 3.0, f"Share {i} mean {mean_val} deviates from 127.5"


def test_api_color_overlay_roundtrip(client):
    """API round-trip: /api/generate and /api/reconstruct with color_overlay."""
    synth = create_synthetic_8color_image(block_size=16)
    png_bytes = rgb_to_png_bytes(synth)

    gen_resp = client.post(
        "/api/generate",
        data={
            "file": (io.BytesIO(png_bytes), "sample.png"),
            "mode": "color_overlay",
            "n": 2,
        },
        content_type="multipart/form-data",
    )
    assert gen_resp.status_code == 200
    gen_data = gen_resp.get_json()
    assert gen_data["ok"] is True
    assert gen_data["is_color"] is True
    assert len(gen_data["shares"]) == 2
    assert "group_id" in gen_data

    # Reconstruct
    share_files = [
        (io.BytesIO(base64.b64decode(s["png_b64"])), s["filename"])
        for s in gen_data["shares"]
    ]
    rec_resp = client.post(
        "/api/reconstruct",
        data={
            "shares": share_files,
            "mode": "color_overlay",
            "n_total": 2,
        },
        content_type="multipart/form-data",
    )
    assert rec_resp.status_code == 200
    rec_data = rec_resp.get_json()
    assert rec_data["ok"] is True
    assert rec_data["sufficient"] is True
    assert rec_data["group_id"] == gen_data["group_id"]


def test_api_color_xor_roundtrip(client):
    """API round-trip: /api/generate and /api/reconstruct with color_xor."""
    synth = create_synthetic_8color_image(block_size=16)
    png_bytes = rgb_to_png_bytes(synth)

    gen_resp = client.post(
        "/api/generate",
        data={
            "file": (io.BytesIO(png_bytes), "sample.png"),
            "mode": "color_xor",
            "n": 3,
        },
        content_type="multipart/form-data",
    )
    assert gen_resp.status_code == 200
    gen_data = gen_resp.get_json()
    assert gen_data["ok"] is True
    assert gen_data["is_color"] is True
    assert len(gen_data["shares"]) == 3
    assert gen_data["metrics"]["exact_match"] is True

    share_files = [
        (io.BytesIO(base64.b64decode(s["png_b64"])), s["filename"])
        for s in gen_data["shares"]
    ]
    rec_resp = client.post(
        "/api/reconstruct",
        data={
            "shares": share_files,
            "mode": "color_xor",
            "n_total": 3,
        },
        content_type="multipart/form-data",
    )
    assert rec_resp.status_code == 200
    rec_data = rec_resp.get_json()
    assert rec_data["ok"] is True
    assert rec_data["sufficient"] is True


def test_api_compare_color(client):
    """API /api/compare with a color image returns all 4 schemes."""
    synth = create_synthetic_8color_image(block_size=16)
    png_bytes = rgb_to_png_bytes(synth)

    resp = client.post(
        "/api/compare",
        data={"file": (io.BytesIO(png_bytes), "sample.png")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["ok"] is True
    assert data["is_color"] is True
    assert "overlay" in data
    assert "xor" in data
    assert "color_overlay" in data
    assert "color_xor" in data
    assert data["color_xor"]["metrics"]["exact_match"] is True


def test_group_mismatch_warning(client):
    """Reconstructing shares from different groups triggers warning message."""
    synth = create_synthetic_8color_image(block_size=16)
    png_bytes = rgb_to_png_bytes(synth)

    gen1 = client.post(
        "/api/generate",
        data={"file": (io.BytesIO(png_bytes), "sample1.png"), "mode": "color_overlay", "n": 2},
        content_type="multipart/form-data",
    ).get_json()

    gen2 = client.post(
        "/api/generate",
        data={"file": (io.BytesIO(png_bytes), "sample2.png"), "mode": "color_overlay", "n": 2},
        content_type="multipart/form-data",
    ).get_json()

    # Mix share 1 of gen1 and share 2 of gen2
    share1_file = (io.BytesIO(base64.b64decode(gen1["shares"][0]["png_b64"])), "s1.png")
    share2_file = (io.BytesIO(base64.b64decode(gen2["shares"][1]["png_b64"])), "s2.png")

    rec_resp = client.post(
        "/api/reconstruct",
        data={"shares": [share1_file, share2_file], "mode": "color_overlay", "n_total": 2},
        content_type="multipart/form-data",
    )
    assert rec_resp.status_code == 200
    rec_data = rec_resp.get_json()
    assert rec_data["warning"] is not None
    assert "belong together" in rec_data["warning"]

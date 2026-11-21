"""FR-8 Metrics computation: contrast, pixel expansion, leakage, and reconstruction verification."""
from typing import List, Dict, Any, Union
import numpy as np
from vc.config import (
    RULE_OVERLAY_RECONSTRUCTION,
    RULE_XOR_RECONSTRUCTION,
    RULE_COLOR_OVERLAY_RECONSTRUCTION,
    RULE_COLOR_XOR_RECONSTRUCTION,
    LEAKAGE_TOLERANCE_RULE,
)


def compute_leakage_tolerance(m: int) -> float:
    """Compute D7 leakage tolerance threshold: max(0.02, 4 * 0.5 / sqrt(m))."""
    if m <= 0:
        return 0.02
    return max(0.02, 4.0 * 0.5 / np.sqrt(m))


def compute_color_metrics(
    original_rgb: np.ndarray,
    shares: List[np.ndarray],
    reconstruction_rgb: np.ndarray,
    mode: str,
    n: int,
    processing_ms: float,
    total_ms: float,
) -> Dict[str, Any]:
    """Compute metrics for color visual cryptography schemes (color_overlay, color_xor)."""
    H, W, _ = original_rgb.shape
    share_H, share_W = shares[0].shape[:2]

    pixel_expansion = float((share_H * share_W) / (H * W))
    subpixels_per_secret_pixel = 4 if mode == "color_overlay" else 1

    # Exact byte match check
    exact_match = bool(np.array_equal(reconstruction_rgb, original_rgb))

    # Mean squared error (MSE) & PSNR
    mse = float(np.mean((original_rgb.astype(float) - reconstruction_rgb.astype(float)) ** 2))
    if mse == 0:
        psnr = 999.0  # infinite / perfect
    else:
        psnr = float(10.0 * np.log10((255.0 ** 2) / mse))

    # Mean color distance (Euclidean in RGB)
    diff = original_rgb.astype(float) - reconstruction_rgb.astype(float)
    color_dist = float(np.mean(np.sqrt(np.sum(diff ** 2, axis=-1))))

    # Leakage check across shares
    shares_leakage = []
    for idx, share in enumerate(shares, start=1):
        if mode == "color_overlay":
            # In each channel, each 2x2 block must have exactly 2 inked subpixels (0) and 2 white (255)
            # Check ink fraction per channel: should be exactly 0.5
            passed_channels = []
            channel_fractions = []
            for c in range(3):
                ch_subpixels = share[:, :, c].flatten()
                m_all = ch_subpixels.size
                p_ink = float(np.mean(ch_subpixels == 0))
                channel_fractions.append(p_ink)
                dev = abs(p_ink - 0.5)
                passed_channels.append(dev <= compute_leakage_tolerance(m_all))

            p_ink_all = float(np.mean(channel_fractions))
            max_dev = float(max(abs(f - 0.5) for f in channel_fractions))
            passed = all(passed_channels)
            shares_leakage.append({
                "index": idx,
                "p_black_all": p_ink_all,
                "max_deviation": max_dev,
                "passed": passed,
            })
        else:
            # Color XOR: each share is uniformly random bytes in [0, 255]
            # Mean byte value should be ~127.5
            mean_val = float(np.mean(share))
            dev = abs(mean_val - 127.5) / 127.5
            passed = dev < 0.05
            shares_leakage.append({
                "index": idx,
                "p_black_all": mean_val / 255.0,
                "max_deviation": dev,
                "passed": passed,
            })

    leakage = {
        "tolerance_rule": LEAKAGE_TOLERANCE_RULE,
        "shares": shares_leakage,
        "all_passed": all(s["passed"] for s in shares_leakage),
    }

    if mode == "color_overlay":
        rule = RULE_COLOR_OVERLAY_RECONSTRUCTION
        rec_passed = psnr > 15.0 or color_dist < 60.0
    else:
        rule = RULE_COLOR_XOR_RECONSTRUCTION
        rec_passed = exact_match

    return {
        "mode": mode,
        "n": n,
        "is_color": True,
        "secret_size": {"width": int(W), "height": int(H)},
        "share_size": {"width": int(share_W), "height": int(share_H)},
        "subpixels_per_secret_pixel": subpixels_per_secret_pixel,
        "pixel_expansion": pixel_expansion,
        "mse": round(mse, 3),
        "psnr": round(psnr, 2) if psnr < 900 else "Infinity",
        "mean_color_error": round(color_dist, 3),
        "exact_match": exact_match,
        "leakage": leakage,
        "reconstruction_check": {
            "passed": rec_passed,
            "rule": rule,
        },
        "processing_ms": round(float(processing_ms), 3),
        "total_ms": round(float(total_ms), 3),
    }


def compute_metrics(
    S: np.ndarray,
    shares: List[np.ndarray],
    reconstruction: np.ndarray,
    mode: str,
    n: int,
    processing_ms: float,
    total_ms: float,
) -> Dict[str, Any]:
    """Compute contrast, pixel expansion, leakage, and reconstruction checks.

    Supports 'overlay', 'xor', 'color_overlay', 'color_xor'.
    """
    if mode in ("color_overlay", "color_xor"):
        return compute_color_metrics(
            original_rgb=S,
            shares=shares,
            reconstruction_rgb=reconstruction,
            mode=mode,
            n=n,
            processing_ms=processing_ms,
            total_ms=total_ms,
        )

    H, W = S.shape
    share_H, share_W = shares[0].shape

    pixel_expansion = float((share_H * share_W) / (H * W))
    subpixels_per_secret_pixel = 4 if mode == "overlay" else 1

    # 1. Compute light fraction L per secret pixel
    if mode == "overlay":
        blocks = reconstruction.reshape(H, 2, W, 2).transpose(0, 2, 1, 3)
        L = 1.0 - np.mean(blocks, axis=(2, 3))
    else:
        L = 1.0 - reconstruction.astype(float)

    # 2. Contrast
    secret_white = (S == 0)
    secret_black = (S == 1)
    has_white = bool(np.any(secret_white))
    has_black = bool(np.any(secret_black))
    theoretical = 0.5 if mode == "overlay" else 1.0

    light_white = float(np.mean(L[secret_white])) if has_white else None
    light_black = float(np.mean(L[secret_black])) if has_black else None

    if light_white is not None and light_black is not None:
        relative_difference = float(light_white - light_black)
        matches_theory = bool(abs(relative_difference - theoretical) <= 1e-9)
    else:
        relative_difference = None
        matches_theory = None

    contrast = {
        "light_white": light_white,
        "light_black": light_black,
        "relative_difference": relative_difference,
        "theoretical": theoretical,
        "matches_theory": matches_theory,
    }

    # 3. Leakage per share
    shares_leakage = []
    for idx, share in enumerate(shares, start=1):
        if mode == "overlay":
            s_blocks = share.reshape(H, 2, W, 2).transpose(0, 2, 1, 3)
            subpixels_all = share.flatten()
            m_all = subpixels_all.size
            p_black_all = float(np.mean(subpixels_all == 1))
            dev_all = abs(p_black_all - 0.5)
            passed_all = dev_all <= compute_leakage_tolerance(m_all)

            if has_black:
                subpixels_black = s_blocks[secret_black].flatten()
                m_black = subpixels_black.size
                p_black_in_secret_black = float(np.mean(subpixels_black == 1))
                dev_black = abs(p_black_in_secret_black - 0.5)
                passed_black = dev_black <= compute_leakage_tolerance(m_black)
            else:
                p_black_in_secret_black = None
                dev_black = None
                passed_black = True

            if has_white:
                subpixels_white = s_blocks[secret_white].flatten()
                m_white = subpixels_white.size
                p_black_in_secret_white = float(np.mean(subpixels_white == 1))
                dev_white = abs(p_black_in_secret_white - 0.5)
                passed_white = dev_white <= compute_leakage_tolerance(m_white)
            else:
                p_black_in_secret_white = None
                dev_white = None
                passed_white = True
        else:
            subpixels_all = share.flatten()
            m_all = subpixels_all.size
            p_black_all = float(np.mean(subpixels_all == 1))
            dev_all = abs(p_black_all - 0.5)
            passed_all = dev_all <= compute_leakage_tolerance(m_all)

            if has_black:
                subpixels_black = share[secret_black].flatten()
                m_black = subpixels_black.size
                p_black_in_secret_black = float(np.mean(subpixels_black == 1))
                dev_black = abs(p_black_in_secret_black - 0.5)
                passed_black = dev_black <= compute_leakage_tolerance(m_black)
            else:
                p_black_in_secret_black = None
                dev_black = None
                passed_black = True

            if has_white:
                subpixels_white = share[secret_white].flatten()
                m_white = subpixels_white.size
                p_black_in_secret_white = float(np.mean(subpixels_white == 1))
                dev_white = abs(p_black_in_secret_white - 0.5)
                passed_white = dev_white <= compute_leakage_tolerance(m_white)
            else:
                p_black_in_secret_white = None
                dev_white = None
                passed_white = True

        devs = [d for d in (dev_all, dev_black, dev_white) if d is not None]
        max_deviation = float(max(devs)) if devs else 0.0
        passed = bool(passed_all and passed_black and passed_white)

        shares_leakage.append({
            "index": idx,
            "p_black_all": p_black_all,
            "p_black_in_secret_black": p_black_in_secret_black,
            "p_black_in_secret_white": p_black_in_secret_white,
            "max_deviation": max_deviation,
            "passed": passed,
        })

    leakage = {
        "tolerance_rule": LEAKAGE_TOLERANCE_RULE,
        "shares": shares_leakage,
        "all_passed": all(s["passed"] for s in shares_leakage),
    }

    # 4. Reconstruction check
    if mode == "overlay":
        rule = RULE_OVERLAY_RECONSTRUCTION
        black_passed = True
        if has_black:
            black_passed = bool(np.all(np.isclose(L[secret_black], 0.0)))
        white_passed = True
        if has_white:
            white_passed = bool(np.all(np.isclose(L[secret_white], 0.5)))
        rec_passed = black_passed and white_passed
    else:
        rule = RULE_XOR_RECONSTRUCTION
        rec_passed = bool(np.array_equal(reconstruction, S))

    reconstruction_check = {
        "passed": rec_passed,
        "rule": rule,
    }

    return {
        "mode": mode,
        "n": n,
        "is_color": False,
        "secret_size": {"width": int(W), "height": int(H)},
        "share_size": {"width": int(share_W), "height": int(share_H)},
        "subpixels_per_secret_pixel": subpixels_per_secret_pixel,
        "pixel_expansion": pixel_expansion,
        "contrast": contrast,
        "leakage": leakage,
        "reconstruction_check": reconstruction_check,
        "processing_ms": round(float(processing_ms), 3),
        "total_ms": round(float(total_ms), 3),
    }

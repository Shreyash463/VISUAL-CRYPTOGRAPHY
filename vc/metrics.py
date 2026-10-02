"""FR-8 Metrics computation: contrast, pixel expansion, leakage, and reconstruction verification."""
from typing import List, Dict, Any
import numpy as np
from vc.config import (
    RULE_OVERLAY_RECONSTRUCTION,
    RULE_XOR_RECONSTRUCTION,
    LEAKAGE_TOLERANCE_RULE,
)


def compute_leakage_tolerance(m: int) -> float:
    """Compute D7 leakage tolerance threshold: max(0.02, 4 * 0.5 / sqrt(m))."""
    if m <= 0:
        return 0.02
    return max(0.02, 4.0 * 0.5 / np.sqrt(m))


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

    Args:
        S: Secret matrix of shape (H, W) where 1=black, 0=white.
        shares: List of share matrices.
        reconstruction: Reconstructed image matrix.
        mode: 'overlay' or 'xor'.
        n: Total number of shares.
        processing_ms: Duration in milliseconds for share generation.
        total_ms: Total duration in milliseconds for the request.
    """
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

"""Service orchestration for generate, reconstruct, and compare workflows."""
import time
from typing import List, Tuple, Dict, Any

from vc.config import (
    MSG_SUFFICIENT_SHARES,
    MSG_INSUFFICIENT_SHARES,
)
from vc.validation import validate_upload, validate_params, validate_shares
from vc.preprocessing import preprocess_image
from vc.overlay import generate_overlay_shares, reconstruct_overlay
from vc.xor import generate_xor_shares, reconstruct_xor
from vc.imageio import bits_to_b64
from vc.metrics import compute_metrics


def generate(
    file_bytes: bytes,
    filename: str,
    mode: str = "overlay",
    n: int = 2,
    preprocess: str = "halftone",
    threshold: int = 128,
) -> Dict[str, Any]:
    """Execute complete generation workflow: validate, preprocess, generate, reconstruct, measure."""
    t0 = time.perf_counter()

    validate_upload(filename, file_bytes)
    mode, n, preprocess, threshold = validate_params(mode, n, preprocess, threshold)

    S, preprocess_info = preprocess_image(file_bytes, preprocess, threshold)

    t_gen_start = time.perf_counter()
    if mode == "overlay":
        shares = generate_overlay_shares(S)
    else:
        shares = generate_xor_shares(S, n)
    processing_ms = (time.perf_counter() - t_gen_start) * 1000.0

    if mode == "overlay":
        reconstruction = reconstruct_overlay(shares)
    else:
        reconstruction = reconstruct_xor(shares)

    secret_png_b64 = bits_to_b64(S)
    shares_payload = [
        {
            "index": idx,
            "png_b64": bits_to_b64(share),
            "width": int(share.shape[1]),
            "height": int(share.shape[0]),
        }
        for idx, share in enumerate(shares, start=1)
    ]
    reconstruction_png_b64 = bits_to_b64(reconstruction)

    total_ms = (time.perf_counter() - t0) * 1000.0
    metrics = compute_metrics(S, shares, reconstruction, mode, n, processing_ms, total_ms)

    return {
        "ok": True,
        "mode": mode,
        "n": n,
        "preprocess": preprocess_info,
        "secret_png_b64": secret_png_b64,
        "shares": shares_payload,
        "reconstruction_png_b64": reconstruction_png_b64,
        "metrics": metrics,
    }


def reconstruct(
    share_files: List[Tuple[str, bytes]],
    mode: str,
    n_total: int = 2,
) -> Dict[str, Any]:
    """Execute reconstruction workflow from supplied share files."""
    shares_bits = validate_shares(share_files, mode, n_total)

    required = 2 if mode == "overlay" else int(n_total)
    supplied = len(shares_bits)
    sufficient = supplied >= required

    if sufficient:
        message = MSG_SUFFICIENT_SHARES
    else:
        message = MSG_INSUFFICIENT_SHARES.format(supplied=supplied, required=required)

    if mode == "overlay":
        reconstruction = reconstruct_overlay(shares_bits)
    else:
        reconstruction = reconstruct_xor(shares_bits)

    rec_b64 = bits_to_b64(reconstruction)

    return {
        "ok": True,
        "mode": mode,
        "required": required,
        "supplied": supplied,
        "sufficient": sufficient,
        "message": message,
        "reconstruction_png_b64": rec_b64,
        "width": int(reconstruction.shape[1]),
        "height": int(reconstruction.shape[0]),
    }


def compare(
    file_bytes: bytes,
    filename: str,
    preprocess: str = "halftone",
    threshold: int = 128,
) -> Dict[str, Any]:
    """Execute comparative workflow running both overlay (n=2) and XOR (n=2) on the same secret."""
    t0 = time.perf_counter()

    validate_upload(filename, file_bytes)
    _, _, preprocess, threshold = validate_params("overlay", 2, preprocess, threshold)

    S, preprocess_info = preprocess_image(file_bytes, preprocess, threshold)
    secret_png_b64 = bits_to_b64(S)

    # Overlay (n=2)
    t_ov_start = time.perf_counter()
    overlay_shares = generate_overlay_shares(S)
    ov_proc_ms = (time.perf_counter() - t_ov_start) * 1000.0
    ov_reconstruction = reconstruct_overlay(overlay_shares)
    ov_rec_b64 = bits_to_b64(ov_reconstruction)
    ov_shares_payload = [
        {
            "index": idx,
            "png_b64": bits_to_b64(sh),
            "width": int(sh.shape[1]),
            "height": int(sh.shape[0]),
        }
        for idx, sh in enumerate(overlay_shares, start=1)
    ]

    # XOR (n=2)
    t_xor_start = time.perf_counter()
    xor_shares = generate_xor_shares(S, 2)
    xor_proc_ms = (time.perf_counter() - t_xor_start) * 1000.0
    xor_reconstruction = reconstruct_xor(xor_shares)
    xor_rec_b64 = bits_to_b64(xor_reconstruction)
    xor_shares_payload = [
        {
            "index": idx,
            "png_b64": bits_to_b64(sh),
            "width": int(sh.shape[1]),
            "height": int(sh.shape[0]),
        }
        for idx, sh in enumerate(xor_shares, start=1)
    ]

    total_ms = (time.perf_counter() - t0) * 1000.0

    ov_metrics = compute_metrics(
        S, overlay_shares, ov_reconstruction, "overlay", 2, ov_proc_ms, total_ms
    )
    xor_metrics = compute_metrics(
        S, xor_shares, xor_reconstruction, "xor", 2, xor_proc_ms, total_ms
    )

    return {
        "ok": True,
        "preprocess": preprocess_info,
        "secret_png_b64": secret_png_b64,
        "overlay": {
            "shares": ov_shares_payload,
            "reconstruction_png_b64": ov_rec_b64,
            "metrics": ov_metrics,
        },
        "xor": {
            "shares": xor_shares_payload,
            "reconstruction_png_b64": xor_rec_b64,
            "metrics": xor_metrics,
        },
    }

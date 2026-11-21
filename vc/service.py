"""Service orchestration for generate, reconstruct, and compare workflows."""
import secrets
import time
from typing import List, Tuple, Dict, Any, Optional

from vc.config import (
    MSG_SUFFICIENT_SHARES,
    MSG_INSUFFICIENT_SHARES,
)
from vc.validation import validate_upload, validate_params, validate_shares
from vc.preprocessing import preprocess_image, preprocess_color_image, detect_color
from vc.overlay import generate_overlay_shares, reconstruct_overlay
from vc.xor import generate_xor_shares, reconstruct_xor
from vc.color_overlay import (
    generate_color_overlay_shares,
    reconstruct_color_overlay_raw,
    reconstruct_color_overlay_enhanced,
)
from vc.color_xor import generate_color_xor_shares, reconstruct_color_xor
from vc.imageio import bits_to_b64, rgb_to_b64
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
    group_id = secrets.token_hex(4)

    is_color_scheme = mode in ("color_overlay", "color_xor")
    raw_stack_b64: Optional[str] = None
    enhanced_b64: Optional[str] = None

    if is_color_scheme:
        max_side = 320 if mode == "color_overlay" else 512
        rgb_secret, preprocess_info = preprocess_color_image(file_bytes, max_side=max_side)
        secret_png_b64 = rgb_to_b64(rgb_secret)

        t_gen_start = time.perf_counter()
        if mode == "color_overlay":
            shares = generate_color_overlay_shares(rgb_secret)
        else:
            shares = generate_color_xor_shares(rgb_secret, n)
        processing_ms = (time.perf_counter() - t_gen_start) * 1000.0

        if mode == "color_overlay":
            raw_rec = reconstruct_color_overlay_raw(shares)
            enhanced_rec = reconstruct_color_overlay_enhanced(shares)
            reconstruction = enhanced_rec
            raw_stack_b64 = rgb_to_b64(raw_rec)
            enhanced_b64 = rgb_to_b64(enhanced_rec)
        else:
            reconstruction = reconstruct_color_xor(shares)

        shares_payload = []
        for idx, share in enumerate(shares, start=1):
            meta = {
                "vc_scheme": mode,
                "vc_version": "2.0",
                "vc_group": group_id,
                "vc_index": str(idx),
                "vc_n": str(n),
                "vc_w": str(share.shape[1]),
                "vc_h": str(share.shape[0]),
                "vc_type": "share",
            }
            share_filename = f"vc-{mode}-{group_id}-share{idx}-of-{n}.png"
            shares_payload.append({
                "index": idx,
                "filename": share_filename,
                "png_b64": rgb_to_b64(share, metadata=meta),
                "width": int(share.shape[1]),
                "height": int(share.shape[0]),
                "metadata": meta,
            })

        rec_meta = {"vc_scheme": mode, "vc_version": "2.0", "vc_group": group_id, "vc_type": "reconstruction"}
        reconstruction_png_b64 = rgb_to_b64(reconstruction, metadata=rec_meta)
        total_ms = (time.perf_counter() - t0) * 1000.0
        metrics = compute_metrics(rgb_secret, shares, reconstruction, mode, n, processing_ms, total_ms)

    else:
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
        shares_payload = []
        for idx, share in enumerate(shares, start=1):
            meta = {
                "vc_scheme": mode,
                "vc_version": "2.0",
                "vc_group": group_id,
                "vc_index": str(idx),
                "vc_n": str(n),
                "vc_w": str(share.shape[1]),
                "vc_h": str(share.shape[0]),
                "vc_type": "share",
            }
            share_filename = f"vc-{mode}-{group_id}-share{idx}-of-{n}.png"
            shares_payload.append({
                "index": idx,
                "filename": share_filename,
                "png_b64": bits_to_b64(share),
                "width": int(share.shape[1]),
                "height": int(share.shape[0]),
                "metadata": meta,
            })

        reconstruction_png_b64 = bits_to_b64(reconstruction)
        total_ms = (time.perf_counter() - t0) * 1000.0
        metrics = compute_metrics(S, shares, reconstruction, mode, n, processing_ms, total_ms)

    return {
        "ok": True,
        "mode": mode,
        "n": n,
        "group_id": group_id,
        "is_color": is_color_scheme,
        "preprocess": preprocess_info,
        "secret_png_b64": secret_png_b64,
        "shares": shares_payload,
        "reconstruction_png_b64": reconstruction_png_b64,
        "raw_stack_png_b64": raw_stack_b64,
        "enhanced_png_b64": enhanced_b64,
        "metrics": metrics,
    }


def reconstruct(
    share_files: List[Tuple[str, bytes]],
    mode: str,
    n_total: int = 2,
    display_option: str = "enhanced",
) -> Dict[str, Any]:
    """Execute reconstruction workflow from supplied share files."""
    shares_list, metadata_list, group_warning = validate_shares(share_files, mode, n_total)

    required = 2 if mode in ("overlay", "color_overlay") else int(n_total)
    supplied = len(shares_list)
    sufficient = supplied >= required

    if sufficient:
        message = MSG_SUFFICIENT_SHARES
    else:
        message = MSG_INSUFFICIENT_SHARES.format(supplied=supplied, required=required)

    raw_stack_b64: Optional[str] = None
    enhanced_b64: Optional[str] = None

    if mode == "color_overlay":
        raw_rec = reconstruct_color_overlay_raw(shares_list)
        raw_stack_b64 = rgb_to_b64(raw_rec)
        if sufficient:
            enhanced_rec = reconstruct_color_overlay_enhanced(shares_list)
            enhanced_b64 = rgb_to_b64(enhanced_rec)
            reconstruction_b64 = enhanced_b64 if display_option == "enhanced" else raw_stack_b64
            out_w, out_h = int(reconstruction.shape[1] if display_option != "enhanced" else enhanced_rec.shape[1]), int(reconstruction.shape[0] if display_option != "enhanced" else enhanced_rec.shape[0])
            width, height = (raw_rec.shape[1], raw_rec.shape[0]) if display_option == "raw" else (enhanced_rec.shape[1], enhanced_rec.shape[0])
        else:
            reconstruction_b64 = raw_stack_b64
            width, height = raw_rec.shape[1], raw_rec.shape[0]

    elif mode == "color_xor":
        rec = reconstruct_color_xor(shares_list)
        reconstruction_b64 = rgb_to_b64(rec)
        width, height = rec.shape[1], rec.shape[0]

    elif mode == "overlay":
        reconstruction = reconstruct_overlay(shares_list)
        reconstruction_b64 = bits_to_b64(reconstruction)
        width, height = reconstruction.shape[1], reconstruction.shape[0]

    else:  # xor
        reconstruction = reconstruct_xor(shares_list)
        reconstruction_b64 = bits_to_b64(reconstruction)
        width, height = reconstruction.shape[1], reconstruction.shape[0]

    detected_group = None
    for m in metadata_list:
        if m.get("vc_group"):
            detected_group = m.get("vc_group")
            break

    return {
        "ok": True,
        "mode": mode,
        "required": required,
        "supplied": supplied,
        "sufficient": sufficient,
        "message": message,
        "warning": group_warning,
        "group_id": detected_group,
        "reconstruction_png_b64": reconstruction_b64,
        "raw_stack_png_b64": raw_stack_b64,
        "enhanced_png_b64": enhanced_b64,
        "width": int(width),
        "height": int(height),
    }


def compare(
    file_bytes: bytes,
    filename: str,
    preprocess: str = "halftone",
    threshold: int = 128,
) -> Dict[str, Any]:
    """Execute comparative workflow running overlay (n=2), XOR (n=2), and color schemes."""
    t0 = time.perf_counter()

    validate_upload(filename, file_bytes)
    _, _, preprocess, threshold = validate_params("overlay", 2, preprocess, threshold)

    has_color = detect_color(file_bytes)
    S, preprocess_info = preprocess_image(file_bytes, preprocess, threshold)
    secret_png_b64 = bits_to_b64(S)

    # 1. B/W Overlay (n=2)
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

    # 2. B/W XOR (n=2)
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

    result: Dict[str, Any] = {
        "ok": True,
        "is_color": has_color,
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

    # If image has color, also run color_overlay and color_xor!
    if has_color:
        rgb_secret, color_info = preprocess_color_image(file_bytes, max_side=320)
        result["color_secret_png_b64"] = rgb_to_b64(rgb_secret)

        # Color Overlay (P5)
        t_cov_start = time.perf_counter()
        cov_shares = generate_color_overlay_shares(rgb_secret)
        cov_proc_ms = (time.perf_counter() - t_cov_start) * 1000.0
        cov_raw = reconstruct_color_overlay_raw(cov_shares)
        cov_enhanced = reconstruct_color_overlay_enhanced(cov_shares)
        cov_metrics = compute_metrics(
            rgb_secret, cov_shares, cov_enhanced, "color_overlay", 2, cov_proc_ms, total_ms
        )
        result["color_overlay"] = {
            "shares": [
                {"index": idx, "png_b64": rgb_to_b64(sh), "width": int(sh.shape[1]), "height": int(sh.shape[0])}
                for idx, sh in enumerate(cov_shares, start=1)
            ],
            "raw_stack_png_b64": rgb_to_b64(cov_raw),
            "reconstruction_png_b64": rgb_to_b64(cov_enhanced),
            "metrics": cov_metrics,
        }

        # Color XOR (P6)
        t_cxor_start = time.perf_counter()
        cxor_shares = generate_color_xor_shares(rgb_secret, 2)
        cxor_proc_ms = (time.perf_counter() - t_cxor_start) * 1000.0
        cxor_rec = reconstruct_color_xor(cxor_shares)
        cxor_metrics = compute_metrics(
            rgb_secret, cxor_shares, cxor_rec, "color_xor", 2, cxor_proc_ms, total_ms
        )
        result["color_xor"] = {
            "shares": [
                {"index": idx, "png_b64": rgb_to_b64(sh), "width": int(sh.shape[1]), "height": int(sh.shape[0])}
                for idx, sh in enumerate(cxor_shares, start=1)
            ],
            "reconstruction_png_b64": rgb_to_b64(cxor_rec),
            "metrics": cxor_metrics,
        }

    return result

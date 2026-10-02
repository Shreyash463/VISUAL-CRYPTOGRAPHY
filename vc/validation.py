"""Input validation module (M1) for uploads, parameters, and shares."""
import io
from typing import List, Tuple, Any
import numpy as np
from PIL import Image

from vc.config import (
    MAX_UPLOAD_BYTES,
    MAX_SHARE_BYTES,
    MAX_SHARE_SIDE_PX,
    MAX_IMAGE_PIXELS,
    MIN_IMAGE_SIDE_PX,
    ALLOWED_EXTENSIONS,
    ALLOWED_FORMATS,
    ALLOWED_MODES,
    XOR_MIN_N,
    XOR_MAX_N,
    ALLOWED_PREPROCESS,
    ERROR_MESSAGES,
)
from vc.errors import VCError


def validate_upload(filename: str | None, data: bytes | None) -> Image.Image:
    """Validate uploaded image file.

    Checks:
      - Not empty (NO_FILE, 400)
      - Extension in {png, jpg, jpeg, bmp} (BAD_EXTENSION, 400)
      - Size <= 5 MB (FILE_TOO_LARGE, 413)
      - Valid image format PNG/JPEG/BMP (NOT_AN_IMAGE, 415)
      - Dimensions >= 16 px per side (IMAGE_TOO_SMALL, 400)

    Returns:
        Verified and opened PIL Image.
    """
    if not filename or data is None or len(data) == 0:
        raise VCError("NO_FILE", ERROR_MESSAGES["NO_FILE"], 400)

    if "." not in filename:
        raise VCError("BAD_EXTENSION", ERROR_MESSAGES["BAD_EXTENSION"], 400)

    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise VCError("BAD_EXTENSION", ERROR_MESSAGES["BAD_EXTENSION"], 400)

    if len(data) > MAX_UPLOAD_BYTES:
        raise VCError("FILE_TOO_LARGE", ERROR_MESSAGES["FILE_TOO_LARGE"], 413)

    Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

    # Pillow verify check
    try:
        verify_img = Image.open(io.BytesIO(data))
        verify_img.verify()
    except Image.DecompressionBombError as e:
        raise VCError("NOT_AN_IMAGE", ERROR_MESSAGES["NOT_AN_IMAGE"], 415) from e
    except Exception as e:
        raise VCError("NOT_AN_IMAGE", ERROR_MESSAGES["NOT_AN_IMAGE"], 415) from e

    # Re-open after verify() to read image attributes
    try:
        img = Image.open(io.BytesIO(data))
        fmt = (img.format or "").upper()
    except Exception as e:
        raise VCError("NOT_AN_IMAGE", ERROR_MESSAGES["NOT_AN_IMAGE"], 415) from e

    if fmt not in ALLOWED_FORMATS:
        raise VCError("NOT_AN_IMAGE", ERROR_MESSAGES["NOT_AN_IMAGE"], 415)

    if img.width < MIN_IMAGE_SIDE_PX or img.height < MIN_IMAGE_SIDE_PX:
        raise VCError("IMAGE_TOO_SMALL", ERROR_MESSAGES["IMAGE_TOO_SMALL"], 400)

    return img


def validate_params(
    mode: Any,
    n: Any,
    preprocess: Any,
    threshold: Any,
) -> Tuple[str, int, str, int]:
    """Validate generation parameters.

    Checks:
      - mode in {'overlay', 'xor'} (BAD_MODE, 400)
      - overlay requires n == 2, xor requires 2 <= n <= 6 (BAD_N, 400)
      - preprocess in {'halftone', 'threshold'} (BAD_PREPROCESS, 400)
      - threshold integer in 0..255 (BAD_THRESHOLD, 400)

    Returns:
        Tuple of (mode, n, preprocess, threshold).
    """
    if not isinstance(mode, str) or mode not in ALLOWED_MODES:
        raise VCError("BAD_MODE", ERROR_MESSAGES["BAD_MODE"], 400)

    try:
        n_int = int(n)
    except (ValueError, TypeError):
        raise VCError("BAD_N", ERROR_MESSAGES["BAD_N"], 400)

    if mode == "overlay":
        if n_int != 2:
            raise VCError("BAD_N", ERROR_MESSAGES["BAD_N"], 400)
    elif mode == "xor":
        if n_int < XOR_MIN_N or n_int > XOR_MAX_N:
            raise VCError("BAD_N", ERROR_MESSAGES["BAD_N"], 400)

    if not isinstance(preprocess, str) or preprocess not in ALLOWED_PREPROCESS:
        raise VCError("BAD_PREPROCESS", ERROR_MESSAGES["BAD_PREPROCESS"], 400)

    try:
        t_int = int(threshold)
    except (ValueError, TypeError):
        raise VCError("BAD_THRESHOLD", ERROR_MESSAGES["BAD_THRESHOLD"], 400)

    if t_int < 0 or t_int > 255:
        raise VCError("BAD_THRESHOLD", ERROR_MESSAGES["BAD_THRESHOLD"], 400)

    return mode, n_int, preprocess, t_int


def validate_shares(
    shares_data: List[Tuple[str, bytes]],
    mode: str,
    n_total: Any,
) -> List[np.ndarray]:
    """Validate uploaded shares for reconstruction.

    Checks:
      - mode and n_total validity
      - zero shares (NO_SHARES, 400)
      - shares count <= n_total (TOO_MANY_SHARES, 400)
      - each share PNG only, <= 2 MB, longer side <= 1024
      - all shares have identical dimensions (SHARE_SIZE_MISMATCH, 400)
      - overlay shares have even dimensions (SHARE_ODD_SIZE, 400)
      - pixels are strictly binary 0/255 (SHARE_NOT_BINARY, 400)

    Returns:
        List of 2D uint8 bit arrays (1=black, 0=white).
    """
    if not isinstance(mode, str) or mode not in ALLOWED_MODES:
        raise VCError("BAD_MODE", ERROR_MESSAGES["BAD_MODE"], 400)

    try:
        n_tot = int(n_total)
    except (ValueError, TypeError):
        raise VCError("BAD_N", ERROR_MESSAGES["BAD_N"], 400)

    if mode == "overlay" and n_tot != 2:
        raise VCError("BAD_N", ERROR_MESSAGES["BAD_N"], 400)
    if mode == "xor" and not (XOR_MIN_N <= n_tot <= XOR_MAX_N):
        raise VCError("BAD_N", ERROR_MESSAGES["BAD_N"], 400)

    if not shares_data:
        raise VCError("NO_SHARES", ERROR_MESSAGES["NO_SHARES"], 400)

    if len(shares_data) > n_tot:
        raise VCError("TOO_MANY_SHARES", ERROR_MESSAGES["TOO_MANY_SHARES"], 400)

    decoded_bits_list: List[np.ndarray] = []
    expected_dim = None

    for filename, file_bytes in shares_data:
        if not file_bytes or len(file_bytes) == 0:
            raise VCError("NO_FILE", ERROR_MESSAGES["NO_FILE"], 400)

        if len(file_bytes) > MAX_SHARE_BYTES:
            raise VCError("FILE_TOO_LARGE", ERROR_MESSAGES["FILE_TOO_LARGE"], 413)

        if filename:
            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            if ext != "png":
                raise VCError("BAD_EXTENSION", ERROR_MESSAGES["BAD_EXTENSION"], 400)

        try:
            v_img = Image.open(io.BytesIO(file_bytes))
            v_img.verify()
        except Exception as e:
            raise VCError("NOT_AN_IMAGE", ERROR_MESSAGES["NOT_AN_IMAGE"], 415) from e

        try:
            img = Image.open(io.BytesIO(file_bytes))
            fmt = (img.format or "").upper()
        except Exception as e:
            raise VCError("NOT_AN_IMAGE", ERROR_MESSAGES["NOT_AN_IMAGE"], 415) from e

        if fmt != "PNG":
            raise VCError("NOT_AN_IMAGE", ERROR_MESSAGES["NOT_AN_IMAGE"], 415)

        if max(img.width, img.height) > MAX_SHARE_SIDE_PX:
            raise VCError(
                "FILE_TOO_LARGE",
                f"Share dimension exceeds maximum allowed size of {MAX_SHARE_SIDE_PX} pixels.",
                413,
            )

        cur_dim = (img.width, img.height)
        if expected_dim is None:
            expected_dim = cur_dim
        elif expected_dim != cur_dim:
            raise VCError("SHARE_SIZE_MISMATCH", ERROR_MESSAGES["SHARE_SIZE_MISMATCH"], 400)

        if mode == "overlay":
            if img.width % 2 != 0 or img.height % 2 != 0:
                raise VCError("SHARE_ODD_SIZE", ERROR_MESSAGES["SHARE_ODD_SIZE"], 400)

        img_l = img.convert("L")
        arr = np.array(img_l, dtype=np.uint8)
        unique_vals = set(np.unique(arr))
        if not unique_vals.issubset({0, 255}):
            raise VCError("SHARE_NOT_BINARY", ERROR_MESSAGES["SHARE_NOT_BINARY"], 400)

        bits = (arr == 0).astype(np.uint8)
        decoded_bits_list.append(bits)

    return decoded_bits_list

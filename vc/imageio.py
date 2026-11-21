"""Image input/output helpers converting between bit/color arrays, PNG bytes, and base64.

Supports reading and writing PNG tEXt chunks for metadata preservation
(scheme, group ID, share index, share count, dimensions).
"""
import base64
import io
from typing import Dict, Tuple, Any, Optional
import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo

from vc.config import ERROR_MESSAGES
from vc.errors import VCError


def bits_to_png_bytes(bits: np.ndarray, metadata: Optional[Dict[str, Any]] = None) -> bytes:
    """Convert a 2D uint8 array (1=black, 0=white) into PNG bytes (mode 'L')."""
    pixel = (255 - 255 * bits).astype(np.uint8)
    img = Image.fromarray(pixel, mode="L")
    buf = io.BytesIO()
    pnginfo = None
    if metadata:
        pnginfo = PngInfo()
        for k, v in metadata.items():
            pnginfo.add_text(str(k), str(v))
    img.save(buf, format="PNG", pnginfo=pnginfo)
    return buf.getvalue()


def rgb_to_png_bytes(rgb: np.ndarray, metadata: Optional[Dict[str, Any]] = None) -> bytes:
    """Convert a 3D uint8 array (H, W, 3) into PNG bytes (mode 'RGB')."""
    img = Image.fromarray(rgb, mode="RGB")
    buf = io.BytesIO()
    pnginfo = None
    if metadata:
        pnginfo = PngInfo()
        for k, v in metadata.items():
            pnginfo.add_text(str(k), str(v))
    img.save(buf, format="PNG", pnginfo=pnginfo)
    return buf.getvalue()


def png_bytes_to_bits(data: bytes) -> np.ndarray:
    """Convert PNG bytes into a 2D uint8 array (1=black, 0=white).

    Raises:
        VCError: If data is not an image or contains non-binary pixels.
    """
    try:
        with Image.open(io.BytesIO(data)) as img:
            img_l = img.convert("L")
            arr = np.array(img_l, dtype=np.uint8)
    except Exception as e:
        raise VCError("NOT_AN_IMAGE", ERROR_MESSAGES["NOT_AN_IMAGE"], 415) from e

    unique_vals = set(np.unique(arr))
    if not unique_vals.issubset({0, 255}):
        raise VCError("SHARE_NOT_BINARY", ERROR_MESSAGES["SHARE_NOT_BINARY"], 400)

    return (arr == 0).astype(np.uint8)


def png_bytes_to_rgb(data: bytes) -> Tuple[np.ndarray, Dict[str, str]]:
    """Convert PNG bytes into a 3D uint8 RGB array (H, W, 3) and extracted metadata dict."""
    try:
        with Image.open(io.BytesIO(data)) as img:
            meta = dict(img.info) if hasattr(img, "info") and img.info else {}
            # Filter to string metadata
            str_meta = {str(k): str(v) for k, v in meta.items() if isinstance(v, (str, int, float))}
            rgb_img = img.convert("RGB")
            arr = np.array(rgb_img, dtype=np.uint8)
            return arr, str_meta
    except Exception as e:
        raise VCError("NOT_AN_IMAGE", ERROR_MESSAGES["NOT_AN_IMAGE"], 415) from e


def png_bytes_to_b64(png_bytes: bytes) -> str:
    """Convert PNG bytes into a standard base64 string without data URI prefix."""
    return base64.b64encode(png_bytes).decode("ascii")


def b64_to_png_bytes(b64_str: str) -> bytes:
    """Convert a base64 string into PNG bytes."""
    return base64.b64decode(b64_str)


def bits_to_b64(bits: np.ndarray, metadata: Optional[Dict[str, Any]] = None) -> str:
    """Convert a 2D bit array directly into base64 PNG string."""
    return png_bytes_to_b64(bits_to_png_bytes(bits, metadata=metadata))


def rgb_to_b64(rgb: np.ndarray, metadata: Optional[Dict[str, Any]] = None) -> str:
    """Convert a 3D RGB array directly into base64 PNG string."""
    return png_bytes_to_b64(rgb_to_png_bytes(rgb, metadata=metadata))

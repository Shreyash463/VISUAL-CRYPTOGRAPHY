"""Image input/output helpers converting between bit arrays, PNG bytes, and base64."""
import base64
import io
import numpy as np
from PIL import Image
from vc.config import ERROR_MESSAGES
from vc.errors import VCError


def bits_to_png_bytes(bits: np.ndarray) -> bytes:
    """Convert a 2D uint8 array (1=black, 0=white) into PNG bytes (mode 'L')."""
    pixel = (255 - 255 * bits).astype(np.uint8)
    img = Image.fromarray(pixel, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
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


def png_bytes_to_b64(png_bytes: bytes) -> str:
    """Convert PNG bytes into a standard base64 string without data URI prefix."""
    return base64.b64encode(png_bytes).decode("ascii")


def b64_to_png_bytes(b64_str: str) -> bytes:
    """Convert a base64 string into PNG bytes."""
    return base64.b64decode(b64_str)


def bits_to_b64(bits: np.ndarray) -> str:
    """Convert a 2D bit array directly into base64 PNG string."""
    return png_bytes_to_b64(bits_to_png_bytes(bits))

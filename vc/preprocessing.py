"""Image preprocessing: format handling, alpha compositing, resizing, and binarization."""
import io
from typing import Dict, Any, Tuple
import numpy as np
from PIL import Image, ImageOps
from vc.config import MAX_WORKING_SIDE_PX, DEFAULT_COLOR_MAX_SIDE


def detect_color(image_input: bytes | Image.Image | np.ndarray) -> bool:
    """Detect if an image contains perceptible color.

    Checks if maximum inter-channel absolute difference > 15 for at least 1% of pixels.
    """
    if isinstance(image_input, bytes):
        img = Image.open(io.BytesIO(image_input))
    elif isinstance(image_input, np.ndarray):
        if image_input.ndim < 3 or image_input.shape[2] < 3:
            return False
        arr = image_input
        diff = np.maximum.reduce([
            np.abs(arr[:, :, 0].astype(int) - arr[:, :, 1].astype(int)),
            np.abs(arr[:, :, 1].astype(int) - arr[:, :, 2].astype(int)),
            np.abs(arr[:, :, 2].astype(int) - arr[:, :, 0].astype(int)),
        ])
        return bool(np.mean(diff > 15) > 0.01)
    else:
        img = image_input

    if img.mode in ("1", "L"):
        return False

    img_rgb = img.convert("RGB")
    arr = np.array(img_rgb, dtype=int)
    diff = np.maximum.reduce([
        np.abs(arr[:, :, 0] - arr[:, :, 1]),
        np.abs(arr[:, :, 1] - arr[:, :, 2]),
        np.abs(arr[:, :, 2] - arr[:, :, 0]),
    ])
    return bool(np.mean(diff > 15) > 0.01)


def preprocess_color_image(
    image_input: bytes | Image.Image,
    max_side: int = DEFAULT_COLOR_MAX_SIDE,
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """Preprocess an image for color visual cryptography into 8-bit RGB array.

    Steps:
      a) Apply ImageOps.exif_transpose.
      b) Composite alpha on pure white.
      c) Convert to RGB.
      d) Downscale if longer side exceeds max_side using LANCZOS.
    """
    if isinstance(image_input, bytes):
        img = Image.open(io.BytesIO(image_input))
    else:
        img = image_input

    img = ImageOps.exif_transpose(img)
    original_size = {"width": img.width, "height": img.height}

    if "A" in img.getbands() or (img.mode == "P" and "transparency" in img.info):
        img_rgba = img.convert("RGBA")
        bg = Image.new("RGBA", img_rgba.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img_rgba)

    img = img.convert("RGB")
    longer_side = max(img.width, img.height)
    if longer_side > max_side:
        scale = max_side / float(longer_side)
        new_w = max(1, round(img.width * scale))
        new_h = max(1, round(img.height * scale))
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    working_size = {"width": img.width, "height": img.height}
    rgb_arr = np.array(img, dtype=np.uint8)

    info = {
        "original_size": original_size,
        "working_size": working_size,
        "is_color": detect_color(rgb_arr),
        "max_side": max_side,
    }
    return rgb_arr, info


def preprocess_image(
    image_input: bytes | Image.Image,
    method: str = "halftone",
    threshold: int | None = 128,
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """Preprocess an image into binary secret matrix S (1=black, 0=white) and info dict.

    Steps:
      a) Apply ImageOps.exif_transpose.
      b) If image has alpha, composite on white background.
      c) Convert to 'L'. If longer side > 512 px, downscale with LANCZOS keeping aspect ratio.
      d) Binarize with Floyd-Steinberg dithering ('halftone') or fixed threshold ('threshold').
      e) Convert to S (pixel 0 -> 1, pixel 255 -> 0).
    """
    if isinstance(image_input, bytes):
        img = Image.open(io.BytesIO(image_input))
    else:
        img = image_input

    # Step a: Exif transpose
    img = ImageOps.exif_transpose(img)
    original_size = {"width": img.width, "height": img.height}

    # Step b: Alpha compositing
    if "A" in img.getbands() or (img.mode == "P" and "transparency" in img.info):
        img_rgba = img.convert("RGBA")
        bg = Image.new("RGBA", img_rgba.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img_rgba)

    # Step c: Convert to grayscale and resize if needed
    img = img.convert("L")
    longer_side = max(img.width, img.height)
    if longer_side > MAX_WORKING_SIDE_PX:
        scale = MAX_WORKING_SIDE_PX / float(longer_side)
        new_w = max(1, round(img.width * scale))
        new_h = max(1, round(img.height * scale))
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    working_size = {"width": img.width, "height": img.height}

    # Step d: Binarize
    if method == "halftone":
        img_bw = img.convert("1", dither=Image.Dither.FLOYDSTEINBERG)
        applied_threshold = None
    elif method == "threshold":
        t = 128 if threshold is None else threshold
        img_bw = img.point(lambda p: 255 if p >= t else 0).convert("1")
        applied_threshold = t
    else:
        # Default fallback
        img_bw = img.convert("1", dither=Image.Dither.FLOYDSTEINBERG)
        applied_threshold = None

    # Step e: Convert to S (pixel 0 -> 1, pixel 255 -> 0)
    arr = np.array(img_bw.convert("L"), dtype=np.uint8)
    S = (arr == 0).astype(np.uint8)

    info = {
        "original_size": original_size,
        "working_size": working_size,
        "method": method,
        "threshold": applied_threshold,
    }
    return S, info

"""Image preprocessing: format handling, alpha compositing, resizing, and binarization."""
import io
from typing import Dict, Any, Tuple
import numpy as np
from PIL import Image, ImageOps
from vc.config import MAX_WORKING_SIDE_PX


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

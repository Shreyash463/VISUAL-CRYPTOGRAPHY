"""Global configuration, limits, patterns, and messages."""
import numpy as np

# Upload and dimension limits
MAX_UPLOAD_BYTES = 5 * 1024 * 1024       # 5 MB
MAX_SHARE_BYTES = 2 * 1024 * 1024        # 2 MB
MAX_CONTENT_LENGTH = 16 * 1024 * 1024     # 16 MB
MIN_IMAGE_SIDE_PX = 16
MAX_WORKING_SIDE_PX = 512
MAX_SHARE_SIDE_PX = 1024
MAX_IMAGE_PIXELS = 25_000_000

# Accepted file extensions and formats
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp"}
ALLOWED_FORMATS = {"PNG", "JPEG", "BMP"}

# Allowed modes and parameters
ALLOWED_MODES = {"overlay", "xor"}
OVERLAY_N = 2
XOR_MIN_N = 2
XOR_MAX_N = 6
ALLOWED_PREPROCESS = {"halftone", "threshold"}
DEFAULT_THRESHOLD = 128

# Six 2x2 patterns for Naor-Shamir (1994) 2-out-of-2 overlay scheme
# Each pattern contains exactly two black subpixels (1s) and two white subpixels (0s).
OVERLAY_PATTERNS = np.array([
    [[1, 1], [0, 0]],  # Pattern 0
    [[0, 0], [1, 1]],  # Pattern 1
    [[1, 0], [1, 0]],  # Pattern 2
    [[0, 1], [0, 1]],  # Pattern 3
    [[1, 0], [0, 1]],  # Pattern 4
    [[0, 1], [1, 0]],  # Pattern 5
], dtype=np.uint8)

# Complement map: pattern i and OVERLAY_COMPLEMENT[i] are exact complements
OVERLAY_COMPLEMENT = np.array([1, 0, 3, 2, 5, 4], dtype=np.uint8)

# Reconstruction messages
MSG_SUFFICIENT_SHARES = "All required shares supplied. Shown: the combined result."
MSG_INSUFFICIENT_SHARES = "Fewer than the required shares ({supplied} of {required}). No recognisable secret is expected."

# Reconstruction rule descriptions
RULE_OVERLAY_RECONSTRUCTION = (
    "Every secret-black block is fully black (light fraction 0) and "
    "every secret-white block has exactly 2 black and 2 white subpixels (light fraction 0.5)."
)
RULE_XOR_RECONSTRUCTION = "Reconstructed image is bit-identical to the secret image."

# Tolerance rule description
LEAKAGE_TOLERANCE_RULE = "max(0.02, 4*0.5/sqrt(m))"

# User-friendly error messages
ERROR_MESSAGES = {
    "NO_FILE": "Please select a file to upload.",
    "BAD_EXTENSION": "Unsupported file format. Please upload a PNG, JPG, JPEG, or BMP image.",
    "FILE_TOO_LARGE": "The uploaded file is too large. Please upload a file smaller than 5 MB (or 2 MB per share).",
    "NOT_AN_IMAGE": "The uploaded file is not a valid or readable image. Please provide a valid PNG, JPG, or BMP file.",
    "IMAGE_TOO_SMALL": "The image is too small. Please provide an image with at least 16 pixels per side.",
    "BAD_MODE": "Invalid mode selected. Please choose either 'overlay' or 'xor'.",
    "BAD_N": "Invalid number of shares. Overlay mode requires n=2, and XOR mode requires n between 2 and 6.",
    "BAD_PREPROCESS": "Invalid preprocessing method. Please choose either 'halftone' or 'threshold'.",
    "BAD_THRESHOLD": "Invalid threshold value. Please choose an integer between 0 and 255.",
    "NO_SHARES": "No shares were provided. Please upload at least one share PNG file.",
    "TOO_MANY_SHARES": "Too many shares provided. The number of shares cannot exceed the total expected shares.",
    "SHARE_SIZE_MISMATCH": "All uploaded shares must have the exact same dimensions. Please upload matching shares.",
    "SHARE_ODD_SIZE": "Overlay shares must have even width and height. Please provide valid overlay share images.",
    "SHARE_NOT_BINARY": "Shares must contain only pure black and white pixels. Please provide valid binary share PNGs.",
    "INTERNAL": "An internal error occurred while processing the image. Please try again.",
    "NOT_FOUND": "The requested endpoint was not found.",
    "METHOD_NOT_ALLOWED": "The HTTP method used is not allowed for this endpoint.",
}

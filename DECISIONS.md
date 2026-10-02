# Decisions Log

## Section 3 Fixed Decisions

| ID | Topic | Decision |
|---|---|---|
| D1 | Stack | Python 3.11+, Flask 3.x, Pillow, NumPy, pytest. No database. No front-end build step. No external CDN. |
| D2 | Statelessness | Nothing is stored on the server (no files, no database, no session). Shares travel to the browser as base64 PNG and come back when the user reconstructs. M6 is not built. Satisfies NFR-3. |
| D3 | Accepted Input | PNG, JPG/JPEG, BMP. Max upload 5 MB. Min 16 px per side. Working size: if longer side > 512 px, downscale with LANCZOS keeping aspect ratio. |
| D4 | Preprocessing | Default = grey-scale then Floyd-Steinberg halftone ("halftone"). Alternative = fixed threshold ("threshold", default 128; pixel value >= threshold becomes white). |
| D5 | Modes | Overlay with n fixed at 2; XOR with n from 2 to 6. Nothing else (no k-of-n, no XOR (2,n), no colour). |
| D6 | Share Format | PNG, 8-bit greyscale, only values 0 (black) and 255 (white), lossless. Internally 1 = black, 0 = white. |
| D7 | Leakage Tolerance | A region passes if \|p_black - 0.5\| <= max(0.02, 4 * 0.5 / sqrt(m)), where m = number of subpixels in the region. |
| D8 | O1 Test Set | 6 generated patterns (Section 11). Pass criterion: exact block rule in Section 8. |
| D9 | Time Target | None enforced; processing time is measured and reported (NFR-5). |
| D10 | Reconstruction Limits | Each share PNG max 2 MB; at most n shares per request; share longer side max 1024 px. |

## Extra Implementation Decisions

- **E1**: Repository root placement: Files are placed directly in the workspace directory `VISUAL CRYPTOGRAPHY/`, matching `visual-cryptography/` in Section 4.
- **E2**: Share dimension limit: If any reconstruction share exceeds 1024 px on its longer side, validation returns `FILE_TOO_LARGE` (HTTP 413).
- **E3**: Routing error handling: Unknown `/api` routes return HTTP 404 with code `NOT_FOUND`, and unsupported methods return HTTP 405 with code `METHOD_NOT_ALLOWED`.
- **E4**: Alpha channel compositing: Images with alpha or palette transparency are composited over a pure white RGBA background before grayscale conversion.
- **E5**: Privacy test directory filtering: `tests/test_privacy.py` ignores Python bytecode caches (`__pycache__`, `.pyc`) and `.pytest_cache` when asserting filesystem immutability.
- **E6**: Insufficient share combination: In `reconstruct`, when fewer than required shares are supplied, overlay mode returns the single share and XOR mode returns the partial bitwise XOR of supplied shares.
- **E7**: CSPRNG rejection batching: `vc/rng.py` samples random bytes in vectorized batches and rejects values >= 252 to ensure uniform distribution over [0, 5] without modulo bias.
- **E8**: Test environment pathing: Added `pytest.ini` and `tests/conftest.py` ensuring the repository root is placed on `sys.path` for direct `pytest -q` invocation.
- **E9**: Content-Security-Policy compliance: Enforced strict CSP headers; eliminated all inline scripts, inline styles, and inline event handlers, building all UI dynamically via ES modules and DOM methods.
- **E10**: Stacking demo interaction: Modeled transparency stacking using `mix-blend-mode: multiply` on an overlaid image offset initially at (+37 px, +23 px), controllable by pointer dragging and keyboard arrow keys.
- **E11**: Dynamic image pixelation: Evaluated natural versus displayed image dimensions in JavaScript to toggle `image-rendering: pixelated` only when images are magnified.
- **E12**: Zero external asset dependencies: Fully self-contained local interface using system UI fonts and SVG/CSS UI elements without external CDNs or remote resources.
- **E13**: Resilient logo slot: Attached programmatic `error` event handler in JavaScript to display the designated SSPU placeholder box gracefully whenever `sspu-logo.png` is missing.

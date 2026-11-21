# Changelog: VeilShare Visual Cryptography v2 (Semester Integrated Project · Final Review)

All notable changes to the Visual Cryptography project for the SSPU Final Review are documented in this file.

---

## [2.1.0] - 2026-11-21: VeilShare v2.1 · Production Stability & Chrome E2E Suite

### Fixed
- **JavaScript TypeError on Split**:
  - Fixed `fReconstruction.frame.classList.add("reveal-animated")` in `generate.js:883` where the frame wrapper object returned by `viewer.js:createImageFrame` was accessed directly as a DOM element instead of through its `.frame` property.
  - Appended `fSecret.frame` and `fReconstruction.frame` to overview DOM containers, resolving share rendering interruptions.
  - Guarded `metrics.js` against missing `metrics.contrast` in colour schemes, rendering dedicated "Colour Fidelity & Reconstruction" cards for P5 and P6.
- **Scheme Selection Badges & Radio Synchronization**:
  - Resolved CSS specificity bug where `.badge { display: inline-flex }` overrode HTML `[hidden]`, causing all 4 scheme cards to display "Selected" badges simultaneously.
  - Added scoped rules `.radio-card .badge { display: none !important }` and `.radio-card.selected .badge { display: inline-flex !important }` in `components.css`.
  - Unified state synchronization across radio inputs, card clicks, aria-checked attributes, and badges.
- **Dynamic Access Structure Share Count ($n$)**:
  - Restored interactive selector `#xor-n-select` for XOR access structures ($n \in [2..6]$).
  - Explicitly toggle overlay fixed 2-share explanation vs XOR multi-share dropdown depending on active scheme.
- **PNG Metadata Reading Across All File Sizes**:
  - Replaced 64KB buffer slice with full `file.arrayBuffer()` in `parsePngMetadata` (`reconstruct.js`) so that `tEXt` chunks located near the end of larger PNG files are reliably read.
- **Defensive Error Handling & UI Recovery**:
  - Replaced raw JavaScript TypeError alerts with user-friendly toast error messages.
  - Reset loading/skeleton states back to empty state on API or rendering errors, preventing stuck UI states.
  - Registered global `window.addEventListener("error", ...)` and `unhandledrejection` handlers in `main.js`.
- **Cache-Busting & Asset Freshness**:
  - Bumped static asset versions to `?v=2.1.0` in all HTML templates (`templates/index.html`, `templates/app.html`, `templates/landing.html`).
  - Added `Cache-Control: public, max-age=0, must-revalidate` rule in `vercel.json` for `/static/(.*)`.
- **Branding & Presentation Alignment**:
  - Replaced subtitle "Progress Review II · Design & Implementation Review" with "Final Review" across all headers, templates, test suites, and docs.
  - Removed outdated date "10 October 2026" from all footers, templates, and scripts.
- **API Navigation Resilience**:
  - Added root `/api` and `/api/` handler in `app.py` returning helpful JSON endpoint catalog or redirecting browsers to `/` rather than serving an unhandled 404.

### Added
- **Automated Real-Browser Playwright E2E Suite (`scripts/run_e2e_tests.py` / `npm run e2e`)**:
  - Comprehensive 11-test suite driving real Google Chrome (`channel="chrome"`).
  - Validates colour JPG with P5 Colour Overlay, colour PNG with P6 Colour XOR ($n=3$), XOR scalability ($n=2, 4$), B/W schemes, large photo (>1200px), Demo Mode, mobile responsiveness (390px), and group mismatch warnings.

---

## [2.0.0] - 2026-11-21: VeilShare v2 · Colour Visual Cryptography & Design System

### Added
- **Mode A: Colour Overlay 2-out-of-2 (P5, Hou 2003)**:
  - Subtractive colour primary decomposition: Converts 24-bit RGB images to Cyan ($C = 255 - R$), Magenta ($M = 255 - G$), and Yellow ($Y = 255 - B$) ink density arrays.
  - Floyd-Steinberg 2D spatial error diffusion halftoning per ink channel into binary dot planes.
  - 2×2 Naor-Shamir subpixel expansion generating two shares with 4 subpixels per original pixel.
  - Subtractive physical stacking simulation: implemented as per-channel minimum (`np.minimum(share1, share2)`), mirroring light passing through stacked physical transparencies.
  - Dual-mode reconstruction:
    - **Raw Stacking**: Physical minimum reproduction with $2\times$ pixel expansion and authentic physical overlay contrast.
    - **Enhanced Display**: 2×2 block ink coverage evaluation, thresholded at $0.75$ combined with Gaussian spatial smoothing ($\sigma = 0.8$), recovering the original vivid colour gamut.
- **Mode B: Colour XOR n-of-n (P6, Wang et al. 2005)**:
  - Cryptographically secure 24-bit RGB bitwise XOR secret sharing across $n \in [2..6]$ shares.
  - Generates $n-1$ uniform random byte shares and computes the $n$-th share as $S_n = I \oplus S_1 \oplus \dots \oplus S_{n-1}$.
  - Lossless, byte-for-byte exact digital reconstruction with $0\times$ pixel expansion (1:1 spatial fidelity).
- **Automatic Colour Detection & Scheme Suggestion**:
  - Client- and server-side colour detection scanning pixel RGB variance ($|R - G| > 10$ or $|R - B| > 10$ or $|G - B| > 10$).
  - Automatic prompt recommending colour schemes with user override ("Keep colour" vs "Force black & white").
- **Lossless PNG tEXt Metadata Embedding & Client-Side Verification**:
  - Embedded standard PNG `tEXt` chunks: `vc_scheme`, `vc_version`, `vc_group`, `vc_index`, `vc_n`, `vc_w`, `vc_h`.
  - Client-side binary PNG parser extracts chunk data instantly on drag-and-drop.
  - Collision-free structured naming: `vc-<scheme>-<group>-share<index>-of-<n>.png`.
  - Group mismatch detector: Warns users when attempting to reconstruct shares belonging to different generation runs.
- **Interactive Studio & Visual Stacking Simulator**:
  - Live transparency superposition demo with `mix-blend-mode: multiply` and magnetic snap to $(0,0)$.
  - Dual drop zones for Share A and Share B, with dynamic multi-zone expansion for XOR ($n > 2$).
  - ZIP package downloader (`createZipBlob` in pure JS) bundling all shares, reconstruction, and run manifest.
  - 4-way benchmark matrix in Compare tab evaluating Contrast, Expansion, Security, Exact Match, PSNR, and Mean Colour Error.
- **Visual Cryptography Landing Page**:
  - Animated 2×2-subpixel noise hero canvas with padlock silhouette reveal on mouse movement and slider scrub.
  - 4-step scroll storytelling explaining the optics of visual cryptography.
  - P1..P10 research paper library with direct links, citations, and summaries.
  - Institutional branding with official Symbiosis Skills and Professional University (SSPU) emblem.
- **Self-Hosted Typography & Strict CSP**:
  - Pre-packaged `@fontsource` Space Grotesk, Inter, and JetBrains Mono `.woff2` font files with zero external runtime CDN dependencies.
  - Strict Content-Security-Policy compliant: Zero inline `<script>`, zero inline `<style>`, zero `style=""`, zero inline event handlers, and zero `eval()`.

### Fixed
- **Vercel Routing & Serverless Architecture**:
  - Resolved `404 NOT_FOUND` edge errors by configuring route capture group forwarding in `vercel.json` and WSGI `PATH_INFO` normalizer in `app.py`.
  - Mirroring of static assets to `public/static/` for Vercel Edge CDN sub-millisecond serving.
- **Windows 11 Execution Safety**:
  - Eliminated invocation of unsigned `.exe` launchers in `Scripts/` (such as `pip.exe` or `pytest.exe`) that trigger Windows Smart App Control blocks.
  - Enforced Python module executions: `python -m pip`, `python -m pytest`, `python -m flask`.

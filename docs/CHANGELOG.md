# Changelog: VeilShare Visual Cryptography Studio (SSPU Final Review)

All notable changes to the Visual Cryptography project for the SSPU Final Review are documented in this file.

---

## [3.1.0] - 2026-11-21: VeilShare v3.1 · Multi-Share Dynamic Reconstruct, Logo Restoration & Final Polish

### Added & Enhanced
- **Dynamic Multi-Share Reconstruct ($n \in [2..6]$)**:
  - Dynamic slot architecture automatically scaling from 2 up to 6 slots based on PNG `vc_n` metadata or manual selection.
  - Multi-file master drop zone accepting multiple PNG shares simultaneously with automatic slot assignment via `vc_index`.
  - Duplicate share detection ignoring duplicate uploads with a friendly notification toast.
  - Group mismatch and dimension mismatch warning banners.
  - One-click `"Use shares from this session"` loading all $n$ shares into their respective slots.
  - Disabled primary `"Reveal Secret"` button until all $n$ shares are present, displaying helper message naming missing indexes (e.g., `"Need 2 more shares: 2, 4"`).
  - Optional `"Security demo: reveal with missing shares"` action demonstrating Shannon perfect secrecy / Naor-Shamir threshold by showing random noise with the required caption:
    > *"Incomplete set: this is random noise, exactly as the security property promises."*
    and badge `"Security Demonstration · Incomplete Set"`. Never mislabelled as "Revealed" or "Decrypted".
  - Pixel-exact unblurred XOR reveal display (`imageRendering: "pixelated"`), byte-exact and 1:1 identical to downloaded files.
- **SSPU Official Emblem Restoration**:
  - Restored genuine high-resolution red emblem with Sanskrit motto ("वसुधैव कुटुम्बकम्") from `public/static/img/sspu-logo.png`.
  - Encased in a white rounded badge (`bg-white p-1 rounded-xl shadow-xs`) ensuring maximum contrast and clarity in both dark noise and light pastel themes.
  - Verified `naturalWidth > 0` across Navbar, Hero, About, and institutional Footer.
- **Team Names Standardization**:
  - Exactly 5 first names in alphabetical/formal order: **Shreyash**, **Ayushi**, **Niharika**, **Yash**, **Kunal**.
  - Completely purged all legacy surnames, roles, PRNs, and placeholder names ("Team Member", Dixit, Sharma, Kulkarni, Joshi, Patel) across codebase and documentation.
- **Cinematic Noise Curtain Intro**:
  - 1.8–2.2s cinematic noise field resolving into white SSPU emblem badge + "VeilShare" wordmark, followed by a curtain split revealing the hero.
  - Gated to once per browser session via `sessionStorage`.
  - Instantly skippable via click, Esc, or any key; supports `prefers-reduced-motion` (200ms fade) and `?intro=0` query parameter for E2E testing.
- **Compact Viewport Optimization**:
  - Compact share grid (`max-h-[520px] overflow-y-auto`) and compact cards for $n \ge 4$ shares at 1366×768, keeping sticky bottom action bar always accessible.
- **Comprehensive Verification**:
  - 6/6 Vitest unit tests covering $n=2..6$ XOR, Shannon perfect secrecy on subsets, CMY overlay, and metrics.
  - 12/12 Playwright Chrome real-browser E2E tests validating logo rendering, team names, cinematic intro, multi-share reconstruct, security demo, and accessibility.

---

## [3.0.0] - 2026-11-21: VeilShare v3 · On-Device Cryptographic Engine & HAYAT-Grade Design System

### Added
- **100% On-Device Web Worker Cryptographic Engine**:
  - Migrated entire cryptographic pipeline from Python/Flask backend to client-side TypeScript running in a dedicated Web Worker (`worker.ts`).
  - **Zero Cloud Transmission**: User secret images never leave the browser client, eliminating serverless cold starts, API timeouts, and privacy leaks.
  - Implemented `fillCryptoRandomValues` in `src/engine/cryptoRandom.ts` to chunk entropy requests into 64 KB slices, preventing browser `QuotaExceededError` crashes on large images.
  - Implemented lossless PNG encoder and metadata parser with `tEXt` chunk injection and Adler32/CRC32 verification (`pngChunk.ts`).
  - Supported 4 cryptographic modes:
    1. **Mode A (P5, Hou 2003)**: CMY subtractive primary decomposition, Floyd-Steinberg halftoning, 2×2 subpixel expansion, optical subtractive superposition, and 2×2 block enhanced continuous colour recovery.
    2. **Mode B (P6, Wang et al. 2005)**: 24-bit RGB bitwise XOR secret sharing across $n \in [2..6]$ shares with 100% byte-exact mathematical reconstruction.
    3. **Mode C (P1, Naor-Shamir 1994)**: Baseline binary 2×2 subpixel visual cryptography.
    4. **Mode D (P6)**: Binary XOR secret sharing.
- **HAYAT-Grade Animated Frontend & Design System**:
  - React 18 + Vite + TypeScript single-page application with HashRouter (`/#/`) ensuring edge CDN compatibility.
  - Interactive hero landing page with animated noise canvas, scrub alignment slider, and 4-step storytelling illustrating the physics of optical secret sharing.
  - 3-step wizard workflow (Upload → Scheme Selection → Results) fitting standard 1366×768 screens without excessive scrolling.
  - Sticky bottom action bars with keyboard support (`Enter` advances steps, `Escape` executes secure memory wipe).
  - Prominent side-by-side noise share cards with individual `[Download Share PNG]` buttons, full-size inspection modal, and ZIP archive download.
  - Reconstruct Studio with intelligent drag-and-drop validation (reconstruction file detection, duplicate share detection, dimension mismatch, and group mismatch warnings).
  - Live Optical Superposition simulator with magnetic snap alignment (`(0, 0)`), draggable layer, and opacity controls.
  - Real-time network telemetry auditor showing `Data Sent: 0`.
  - Official Symbiosis Skills and Professional University (SSPU) emblem ("वसुधैव कुटुम्बकम्") and academic branding.
- **Automated Verification Suites**:
  - 6 Vitest unit tests (`npm test`): Validating PNG encoding, CMY halftoning, subpixel expansion, enhanced color recovery, byte-exact XOR for $n=2..5$, and demo generation.
  - 8 Playwright E2E real-browser tests (`npm run test:e2e`): Driving Google Chrome against local and production deployments, covering landing navigation, generation, downloads, full-colour reconstruction, XOR fidelity, session handoff, live superposition, Escape wipe, mobile responsiveness (390×844), and Axe-core accessibility (0 critical violations).

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

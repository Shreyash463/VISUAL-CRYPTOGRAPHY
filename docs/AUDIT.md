# VeilShare Visual Cryptography v2 - System Audit

**Date:** 2026-11-21  
**Project:** Symbiosis Skills & Professional University (SSPU), Pune  
**Course:** Semester Integrated Project - Visual Cryptography  
**Deployment Target:** Vercel (`https://visual-cryptography-rouge.vercel.app`)  
**Rollback Tag:** `pre-ui-v2`  
**Active Working Branch:** `ui-v2-colour`

---

## 1. Architectural Baseline

### 1.1 Backend Framework & Dependencies
- **Runtime:** Python 3.11+ / Python 3.13 (Windows local) & Python 3.12 (Vercel Serverless Function).
- **Web Framework:** Flask 3.0.x with custom security headers (`Content-Security-Policy`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`).
- **Core Libraries:**
  - `Pillow >= 10.3`: Image loading, conversion, color space conversions, PNG encoding/decoding.
  - `numpy >= 1.26`: Bitwise operations, subpixel matrix transformations, XOR mathematics, vectorized RNG.
  - `gunicorn >= 21.2.0`: WSGI production server for Linux/cloud containers.
  - `pytest >= 8.0`: Test runner (116 tests passing).
- **Execution Architecture:**
  - Hybrid: The backend currently handles image validation, halftoning, share generation, reconstruction, and contrast/leakage metric computation via REST API endpoints (`/api/generate`, `/api/reconstruct`, `/api/compare`).
  - The client provides rich interactions: interactive live stacking simulation (`mix-blend-mode: multiply`), 1:1 pixel inspector, reveal comparison slider, and viewing copy rendering using HTML5 Canvas.

### 1.2 API Route Inventory
| Route | Method | Purpose | Input | Output |
|:---|:---:|:---|:---|:---|
| `/` | GET | Main web application | None | HTML (`templates/index.html`) |
| `/api/health` | GET | Service liveness probe | None | `{"ok": true, "status": "ok"}` |
| `/api/generate` | POST | Generates noise shares | `file`, `mode`, `n`, `preprocess`, `threshold` | JSON: `shares`, `secret_png_b64`, `reconstruction_png_b64`, `metrics` |
| `/api/reconstruct`| POST | Recombines uploaded shares | `shares` (multi-file), `mode`, `n_total` | JSON: `reconstruction_png_b64`, `sufficient`, `message` |
| `/api/compare` | POST | Dual-mode benchmark | `file`, `preprocess`, `threshold` | JSON: side-by-side Overlay vs XOR results & metrics |

### 1.3 Static Assets & CDN Serving
- Root `static/` contains CSS design tokens, layouts, components, and ES modules.
- Root `public/static/` mirrors `static/` for Vercel Edge CDN zero-latency static file delivery.
- `public/sspu-logo.png` & `static/img/sspu-logo.png`: Real official SSPU logo placed and verified.

### 1.4 Existing Cryptographic Schemes (Preserved)
1. **Overlay 2-out-of-2 (P1 - Naor & Shamir 1994):**
   - 2x2 subpixel expansion (4 subpixels per secret pixel).
   - Relative difference $\alpha = 1/2$. Physical superposition (Boolean OR / optical opacity).
2. **XOR (n,n) (P6 - Wang et al. 2005):**
   - No pixel expansion (1x1).
   - Exact mathematical reconstruction via bitwise XOR. $n \in [2, 6]$.

---

## 2. Identified Enhancement Targets for v2

1. **Colour Feature (Prime Goal):**
   - Add **Mode A**: Colour Overlay 2-out-of-2 (P5, Hou-style CMY). Converts RGB $\to$ CMY, Floyd-Steinberg error diffusion per channel, independent 2x2 Naor-Shamir matrices, composite subpixels, physical multiply-stack simulation, and display enhancement.
   - Add **Mode B**: Colour XOR n-of-n (P6 extension). Exact 8-bit channel-wise XOR, zero pixel expansion, perfect byte-for-byte reconstruction.
   - Auto-detection of color in uploaded images with "Colour detected" badges and automatic scheme selection.
   - Embed PNG metadata (`vc_scheme`, `vc_group`, `vc_index`, `vc_n`, `vc_w`, `vc_h`) and structured filenames for auto-reconstruction matching.
2. **Two-Route Experience:**
   - `/`: Award-winning, animated landing page with real canvas noise reveal, interactive storytelling, scheme comparison, paper bibliography (P1..P10), and use cases.
   - `/app`: The fully featured cryptographic tool with Stepper workflow, Demo Mode (procedural color test), drag-and-drop, alignment snap, and ZIP export.
3. **Typography & Styling ("Our Way"):**
   - Self-hosted fonts via `@fontsource` packages: Space Grotesk (headings), Inter (body), JetBrains Mono (metrics/data).
   - Premium themes: Dark "Noise" (#0A0E1A, #141B30, #EAF0FF, #E5323F) and Light "Pastel" (#FBF8FF, lavender/mint/peach, #2E2A4A, #D65F86).
4. **Windows & Vercel Constraints:**
   - All Python commands strictly use module syntax (`python -m ...`).
   - Clean Vercel rewrites supporting `/` and `/app` routes.

# Visual Cryptography — Core Engine and Interactive Web Platform

A secret image is turned into several noise-like shares and becomes visible only when the right shares are combined. Decoding in the baseline Naor–Shamir (1994) scheme is performed by laying printed transparencies over each other, requiring no key knowledge and no cryptographic computation. The system provides both a 2-out-of-2 overlay stacking mode with measured contrast loss and pixel expansion, and an (n,n) XOR secret sharing mode (Wang et al. 2005) with no pixel expansion and exact mathematical reconstruction.

Developed for **Symbiosis Skills & Professional University, Pune** (Semester Integrated Project; Progress Review II, 10 October 2026).

---

## Setup & Run Commands

### macOS / Linux
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py                        # open http://127.0.0.1:5000
pytest -q
python -m vc.bench
```

### Windows
```cmd
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py                        # open http://127.0.0.1:5000
pytest -q
python -m vc.bench
```

---

## Feature Traceability Matrix

| Requirement ID | Description | Implementation Location |
|:---|:---|:---|
| **FR-1** | Accept uploaded secret image | `vc/validation.py`, `app.py`, `static/js/generate.js` |
| **FR-2** | Validate format, dimensions, size; return clear user guidance | `vc/validation.py`, `vc/config.py` |
| **FR-3** | Preprocess image to binary matrix (halftone / threshold) | `vc/preprocessing.py` |
| **FR-4** | Support 2-of-2 overlay and selectable XOR modes | `vc/overlay.py`, `vc/xor.py`, `app.py` |
| **FR-5** | Display generated shares and download each separately as PNG | `static/js/generate.js`, `static/js/ui.js` |
| **FR-6** | Reconstruct and display secret from user-uploaded shares | `vc/service.py`, `static/js/reconstruct.js` |
| **FR-7** | Prevent secret revelation from fewer than required shares | `vc/service.py`, `tests/test_xor.py`, `static/js/generate.js` |
| **FR-8** | Measure and report contrast, pixel expansion, leakage per run | `vc/metrics.py`, `static/js/ui.js` |
| **NFR-1** | Sub-threshold shares reveal zero secret information | D7 tolerance checks in `vc/metrics.py`, `tests/test_xor.py` |
| **NFR-2** | Cryptographically secure randomness | `vc/rng.py` (strictly using Python `secrets` module) |
| **NFR-3** | Stateless privacy: zero server persistence of secrets or shares | Memory-only handling in `vc/service.py`, verified in `tests/test_privacy.py` |
| **NFR-4** | High usability, accessibility, keyboard navigation | `templates/index.html`, `static/css/`, `static/js/` |
| **NFR-5** | Execution time proportional to size and share count | Timed in `vc/service.py`, benchmarked in `vc/bench.py` |
| **NFR-6** | Exact reconstruction for XOR; recognisable secret for Overlay | Verified in `vc/metrics.py`, `tests/test_metrics.py` |
| **C-1** | Contrast loss and pixel expansion measured, not hidden | Reported openly in metrics panels and `static/js/compare.js` |
| **C-2** | No Cover model (inapplicable for k,n > 2) | Documented in `static/js/about.js` and architectural limits |
| **C-3** | XOR restricted to (n,n) without pixel expansion | Implemented in `vc/xor.py` for n=2..6 |
| **C-4** | Colour sharing excluded pending security verification (P10) | Preprocessing binarization in `vc/preprocessing.py` |
| **C-5** | Shares must maintain identical dimensions for alignment | Enforced in `vc/validation.py` and demonstrated in `static/js/stacking.js` |

---

## Not Included in this Build

- **k-out-of-n Overlay Sharing (FR-9):** The baseline Naor–Shamir 2-out-of-2 scheme is implemented; general k-out-of-n with arbitrary access structures is omitted.
- **XOR (2,n) Scheme:** Only (n,n) XOR secret sharing is implemented.
- **Colour Sharing:** Excluded following security literature review showing statistical vulnerability in multi-colour schemes (P5/P10).
- **Share Storage and Delivery (M6):** Explicitly excluded to guarantee strict server statelessness and privacy (NFR-3).

---

## Placeholders to Fill

1. **Official SSPU Logo:**
   Drop the university logo image at `static/img/sspu-logo.png`. Until provided, an accessible designated placeholder box is displayed.
2. **Team Details:**
   Open `static/team.json` and replace the empty string values with your Team Name and 4 Member Names:
   ```json
   {
     "team_name": "Team CryptV",
     "members": ["Student 1", "Student 2", "Student 3", "Student 4"]
   }
   ```

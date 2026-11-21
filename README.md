# VeilShare: Visual Cryptography Studio (v3.1)
**Symbiosis Skills & Professional University (SSPU) · Kiwale, Pune**  
**School of Computer Science & Engineering · Semester Integrated Project · Final Review**  
**Live Production URL:** [https://visual-cryptography-rouge.vercel.app](https://visual-cryptography-rouge.vercel.app)

---

## 1. Overview
VeilShare is an award-grade, information-theoretically secure Visual Cryptography web studio that decomposes sensitive images into randomized, statistically indistinguishable noise shares. Neither share leaks a single bit of information on its own. The underlying secret emerges only when shares are superimposed.

In **VeilShare v3.1**, the entire cryptographic pipeline runs **100% On-Device** inside a dedicated client-side Web Worker. Sensitive images never touch any server or cloud database, eliminating serverless cold starts, execution timeouts, and data-leak risks.

### Project Team (SSPU B.Tech CS & IT · Final Review):
- **Shreyash**
- **Ayushi**
- **Niharika**
- **Yash**
- **Kunal**

### Supported Cryptographic Modes:
1. **Mode A: Colour Overlay 2-out-of-2 (P5, Hou 2003)**:
   - Decomposes 24-bit RGB images into subtractive Cyan, Magenta, and Yellow (CMY) dot densities.
   - Converts each channel via Floyd-Steinberg error diffusion halftoning into binary dot matrices.
   - Expands each dot into a $2\times 2$ Naor-Shamir subpixel matrix ($m=4$).
   - Physical stacking simulated via per-channel minimum (`Math.min(s1, s2)`).
   - Display Enhancement mode averages $2\times 2$ blocks, thresholds ink coverage at 0.75, and applies spatial Gaussian smoothing ($\sigma=0.8$) to recover the full original colour gamut.
2. **Mode B: Colour XOR n-of-n (P6, Wang et al. 2005)**:
   - True 24-bit RGB bitwise XOR secret sharing across $n \in [2..6]$ shares.
   - Lossless, byte-for-byte exact digital reconstruction with $0\times$ pixel expansion (1:1 spatial fidelity).
3. **Black & White Baseline Schemes**:
   - **Overlay 2-out-of-2 (P1, Naor-Shamir 1994)**: Physical transparency superposition.
   - **XOR n-of-n (P6, Wang et al. 2005)**: Binary bitwise XOR sharing.

---

## 2. Architecture & Windows 11 Safe Execution
VeilShare is built with React 18, TypeScript, and Vite. Cryptographic randomness uses `crypto.getRandomValues`, chunked into 64 KB slices via `fillCryptoRandomValues` to prevent browser `QuotaExceededError` crashes on large images.

### Quick Start & Local Commands:
```powershell
# Install dependencies
npm install

# Start development server
npm run dev

# Run Vitest unit & property test suite (6 tests)
npm test

# Run Playwright real-browser E2E suite in Google Chrome (12 tests)
npm run test:e2e

# Build production bundle
npm run build
```

---

## 3. Security Guarantees & Privacy Telemetry
- **Zero Cloud Transmission**:
  Images and shares are processed in-memory inside the client's Web Worker. Zero bytes of image data are sent to any server.
- **Dynamic Multi-Share Reconstruct**:
  Supports $n \in [2..6]$ shares with automatic slot mapping via PNG `vc_index` and `vc_n` metadata.
- **Shannon Perfect Secrecy Demonstration**:
  Reveal button is disabled until all $n$ shares are present. An interactive "Security demo: reveal with missing shares" button demonstrates that combining fewer than $n$ shares yields pure uncorrelated noise.
- **Real-Time Network Telemetry Auditor**:
  A live monitor in the navigation bar intercepts `fetch`, `XMLHttpRequest`, and `navigator.sendBeacon` to verify that `Data Sent: 0`.
- **Session Wipe**:
  Pressing the `Escape` key or clicking `Wipe` instantly revokes all volatile Object URLs, resets component states, and terminates the Web Worker.
- **Group Mismatch Protection**:
  All shares embed standard lossless PNG `tEXt` chunks (`vc_scheme`, `vc_version`, `vc_group`, `vc_index`, `vc_n`). The browser client reads these metadata chunks on drag-and-drop to alert users if shares from different generation runs are mixed.

---

## 4. Research Literature Foundations (P1–P10)
- **P1**: Naor & Shamir (1994), *Visual Cryptography*, EUROCRYPT '94.
- **P2**: Naor & Shamir (1996), *Visual Cryptography II: Improving the Contrast*, IACR '96.
- **P3**: Ateniese, Blundo, De Santis, Stinson (1996), *General Access Structures*, ECCC '96.
- **P4**: Blundo, De Santis, Stinson (1996), *On the Contrast in Visual Cryptography Schemes*, IACR '96.
- **P5**: Hou (2003), *Visual Cryptography for Color Images*, Pattern Recognition.
- **P6**: Wang, Zhang, Ma, Huang (2005), *Secret Color Images Sharing Schemes Based on XOR Operation*, IACR '05.
- **P7**: Ross & Othman (2011), *Visual Cryptography for Biometric Privacy*, IEEE Computer Society.
- **P8**: Rura, Issac, Haldar (2017), *Online Voting System with Steganography & Visual Cryptography*, CIT.
- **P9**: Mursi, Salama, Mansour (2014), *Visual Cryptography Schemes: A Comprehensive Survey*, ERMT.
- **P10**: Leung, Ng, Wong (2008), *On the Security of a VC Scheme for Color Images*, IACR '08.

---

## 5. Verification & Test Results
- **Vitest Unit Suite**: 6 tests passed (100% coverage of PNG chunks, CMY halftoning, 2×2 codebook, byte-exact XOR roundtrips, incomplete set entropy).
- **Playwright E2E Suite (Google Chrome)**: 12 real-browser end-to-end tests passed (Landing navigation, generation, downloads, full-colour reconstruction, XOR roundtrip, session handoff, live superposition simulator, Escape wipe, mobile responsiveness, Axe-core accessibility, SSPU logo loading, 5-member team validation, cinematic intro, and multi-share reconstruct with security demo).

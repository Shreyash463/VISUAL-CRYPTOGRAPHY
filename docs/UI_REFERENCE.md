# UI Reference Study: HAYAT Interaction DNA for VeilShare v3

**Source Reference:** [HAYAT (Male Reproductive Health Front Door)](https://github.com/Shreyash463/HAYAT---Male-Reproductive-Health-Front-Door) / [Live Site](https://hayat-frontend-ten.vercel.app)  
**Target:** VeilShare v3 (On-Device Cryptography Studio + Motion-Driven Editorial UI)

---

## 1. Interaction DNA Extracted

### A. Wizard Step Transitions & Sticky Action Bar
- **HAYAT Mechanism:** Fluid `AnimatePresence` step progression where panels slide horizontally/vertically with subtle opacity changes. The primary action bar is pinned to the bottom of the viewport so users never scroll to proceed.
- **VeilShare v3 Adoption:** 3-step Generate wizard (Upload → Scheme → Results Stage). Each step strictly fits 1366×768 with zero page-level scrollbars; sticky bottom bar holds `[Back]`, `[Next]`, and morphing `[Generate]` button with Enter-key hotkey.

### B. Route Transitions & Micro-Feedback
- **HAYAT Mechanism:** Hash-based client routing (`react-router-dom` with HashRouter), active navigation pill layout animations (`layoutId="activeTab"`), tactile button press scales (`whileTap={{ scale: 0.98 }}`), and magnetic attraction on key interactive items.
- **VeilShare v3 Adoption:** Hash routing (`/#/`, `/#/studio/generate`, `/#/studio/reconstruct`, `/#/studio/compare`, `/#/studio/about`). The studio shell features an animated tab pill, card selection rings, and interactive sliders.

### C. Live Reactive Panels & Real-Time Stacking
- **HAYAT Mechanism:** Dynamic real-time calculation with immediate visual feedback (gauges, interactive risk ladders, and factor adjustments).
- **VeilShare v3 Adoption:** Live transparency superposition demo with pointer/keyboard draggable overlay, magnetic snap at `(0, 0)`, and instant subtractive multiply blending.

### D. Privacy Architecture & Live Network Audit
- **HAYAT Mechanism:** Client-side risk engine with zero patient data transmission and transparent audit logging.
- **VeilShare v3 Adoption:** Zero server roundtrips for cryptographic operations. Interceptors wrap `window.fetch`, `XMLHttpRequest`, and `navigator.sendBeacon` to power a live header chip: `"Network requests carrying your data: 0"`.

### E. Session Wipe & Memory Hygiene (`Esc`)
- **HAYAT Mechanism:** Quick Hide (`Esc`) immediately cloaks the interface with a harmless disguised screen.
- **VeilShare v3 Adoption:** Pressing `Esc` triggers an animated full-screen noise dissolution, revoking all Blob object URLs, wiping memory buffers, and resetting the studio.

### F. Motion Timing & Tokens
- **Curve:** `cubic-bezier(0.22, 1, 0.36, 1)`
- **Durations:** Fast `160ms`, Base `320ms`, Slow `600ms`
- **Stagger:** `40ms` to `60ms` per child element.
- **Accessibility:** Strict `prefers-reduced-motion` compliance falling back to pure opacity fades.

---

## 2. Visual Differentiation: VeilShare "Noise and Reveal" Identity
VeilShare avoids HAYAT's warm health-care palette, adopting a high-contrast cryptographic editorial theme:
- **Dark "Noise" Mode (Default):**
  - Background: `#0A0E1A` (Deep Technical Obsidian)
  - Card/Panel: `#141B30` (Navy Ink Slate)
  - Borders: `#2B3558` (Subtle Blueprint Steel)
  - Typography: `#EAF0FF` (Bright Signal), `#8F9BB8` (Muted Metallic)
  - Accent: `#E5323F` (Cryptographic Crimson / Laser Red)
- **Light "Pastel" Mode:**
  - Background: `#FBF8FF`
  - Cards: Harmonious soft tonal planes (`#F1E9FF`, `#E4F6EE`, `#FFEBDD`, `#E3F1FB`)
  - Text: `#2E2A4A`
  - Accent: `#D65F86`
- **Self-Hosted Typography:** Space Grotesk (Editorial Headers), Inter (Crisp System UI), JetBrains Mono (Technical Metrics & Math).

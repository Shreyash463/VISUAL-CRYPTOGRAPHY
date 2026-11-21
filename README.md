# VeilShare: Visual Cryptography Studio (v2)
**Symbiosis Skills & Professional University (SSPU) · Kiwale, Pune**  
**School of Computer Science & Engineering · Semester Integrated Project · Final Review**  
**Live Production URL:** [https://visual-cryptography-rouge.vercel.app](https://visual-cryptography-rouge.vercel.app)

---

## 1. Overview
VeilShare is a modern, information-theoretically secure Visual Cryptography web studio that decomposes sensitive images into randomized, statistically indistinguishable noise shares. Neither share leaks a single bit of information on its own. The underlying secret only emerges when shares are superimposed.

### Supported Cryptographic Modes:
1. **Mode A: Colour Overlay 2-out-of-2 (P5, Hou 2003)**:
   - Decomposes 24-bit RGB images into subtractive Cyan, Magenta, and Yellow (CMY) dot densities.
   - Converts each channel via Floyd-Steinberg error diffusion halftoning into binary dot matrices.
   - Expands each dot into a $2\times 2$ Naor-Shamir subpixel matrix ($m=4$).
   - Physical stacking simulated via per-channel minimum (`np.minimum(share1, share2)`).
   - Display Enhancement mode averages $2\times 2$ blocks, thresholds ink coverage at 0.75, and applies spatial Gaussian smoothing ($\sigma=0.8$) to recover the full original colour gamut.
2. **Mode B: Colour XOR n-of-n (P6, Wang et al. 2005)**:
   - True 24-bit RGB bitwise XOR secret sharing across $n \in [2..6]$ shares.
   - Lossless, byte-for-byte exact digital reconstruction with $0\times$ pixel expansion (1:1 spatial fidelity).
3. **Black & White Baseline Schemes**:
   - **Overlay 2-out-of-2 (P1, Naor-Shamir 1994)**: Physical transparency superposition.
   - **XOR n-of-n (P6, Wang et al. 2005)**: Binary bitwise XOR sharing.

---

## 2. Windows 11 Execution Safety (Smart App Control Safe)
To avoid Windows Smart App Control and Defender blocking unsigned `.exe` launchers generated in Python `Scripts/` folders, always execute tools in module form:
```powershell
# Create virtual environment
python -m venv .venv

# Install dependencies (strictly pure binary wheels)
python -m pip install --disable-pip-version-check --only-binary=:all: -r requirements.txt

# Run application server
python app.py

# Run test suite
python -m pytest -v
```

---

## 3. Architecture & Security Guarantees
- **Strict Content-Security-Policy (CSP)**:
  `default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`
  - Zero inline `<script>`, zero inline `<style>`, zero `style=""`, zero inline event handlers (`on...`), zero `eval()`.
  - Zero external CDN dependencies; all fonts (Space Grotesk, Inter, JetBrains Mono) are locally hosted `.woff2`.
- **Stateless Serverless Execution**:
  No uploaded images or generated shares are ever written to server disk or database; base64 payloads are processed transiently in-memory and immediately garbage collected.
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
- **P7**: Ross & Othman (2011), *Visual Cryptography for Biometric Privacy*, IEEE.
- **P8**: Rura, Issac, Haldar (2017), *Online Voting System with Steganography & Visual Cryptography*, CIT.
- **P9**: Mursi, Salama, Mansour (2014), *Visual Cryptography Schemes: A Comprehensive Survey*, ERMT.
- **P10**: Leung, Ng, Wong (2008), *On the Security of a Visual Cryptography Scheme for Color Images*, IACR '08.

---

## 5. Review Documentation
- **Audit Findings**: [`docs/AUDIT.md`](docs/AUDIT.md)
- **Changelog**: [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- **Viva Voce Examiner Q&A Guide**: [`docs/VIVA_CHEATSHEET.md`](docs/VIVA_CHEATSHEET.md)
- **Decisions Log**: [`DECISIONS.md`](DECISIONS.md)

---
&copy; 2026 VeilShare · Symbiosis Skills & Professional University (SSPU) · Kiwale, Pune

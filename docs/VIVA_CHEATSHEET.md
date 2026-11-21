# VeilShare Visual Cryptography · Viva Voce Cheatsheet & Examiner Q&A
**Symbiosis Skills & Professional University (SSPU) · Kiwale, Pune**  
**School of Computer Science & Engineering · Semester Integrated Project · Final Review**

---

### Q1: What is Visual Cryptography, and why does Naor-Shamir (1994) state that decoding requires zero computation?
**Answer:**  
Visual Cryptography (introduced by Moni Naor and Adi Shamir at EUROCRYPT 1994, Paper P1) is an information-theoretically secure threshold secret sharing scheme where a cryptographic secret image is encoded into $n$ noise-like transparency sheets (shares).  
In traditional cryptography, decryption requires mathematical computations (modular arithmetic, matrix inversions, or hash evaluations) on a CPU. In visual cryptography, decoding is performed purely optically by physically superimposing the printed transparency sheets:  
1. Light acts as a physical multiplier: transparent subpixels transmit incident light, while black inked subpixels absorb it (Boolean OR / subtractive minimum).  
2. The human visual system (HVS) integrates spatial photon densities across subpixels to distinguish dark blocks (hamming weight 4) from grey blocks (hamming weight 2).  
Thus, the receiver performs **zero algorithmic computation** and requires no decryption keys.

---

### Q2: Why must Colour Visual Cryptography use subtractive CMY ink decomposition instead of additive RGB?
**Answer:**  
Computer screens produce colour via **additive colour mixing** (combining Red, Green, and Blue light to form White: $R + G + B = \text{White}$).  
However, physical transparency stacking and printed inks operate via **subtractive colour filtering** (Paper P5, Young-Chang Hou 2003):  
- Inks absorb specific wavelengths of transmitted light:
  - **Cyan ($C = 255 - R$)** absorbs Red light and transmits Green + Blue.
  - **Magenta ($M = 255 - G$)** absorbs Green light and transmits Red + Blue.
  - **Yellow ($Y = 255 - B$)** absorbs Blue light and transmits Red + Green.
When two printed transparency films are physically placed on top of one another, each layer subtracts light. Stacking is governed by physical transmission:
$$\text{Transmitted Light Channel} = \min(\text{Share}_1, \text{Share}_2)$$
If one attempted to overlay RGB directly, stacking would erroneously cause colours to brighten rather than absorb light. Therefore, images must be decomposed into the CMY subtractive primary space.

---

### Q3: How does Floyd-Steinberg halftoning work, and why is it necessary before 2×2 subpixel expansion?
**Answer:**  
Visual cryptography matrices operate on **binary values** (ink present vs ink absent). A continuous-tone 8-bit image contains 256 intensity levels per channel $[0..255]$. To convert continuous-tone grayscale or CMY channels into binary dot matrices without severe posterization or contrast loss, **Floyd-Steinberg spatial error diffusion** is employed.  
As pixels are scanned in row-major order:
1. The continuous pixel value $P(x, y)$ is compared against threshold 128 to yield binary dot $B(x, y) \in \{0, 255\}$.
2. The quantization error $e = P(x, y) - B(x, y)$ is distributed to unvisited neighboring pixels using spatial diffusion weights:
   - $(x+1, y) \leftarrow \frac{7}{16} e$
   - $(x-1, y+1) \leftarrow \frac{3}{16} e$
   - $(x, y+1) \leftarrow \frac{5}{16} e$
   - $(x+1, y+1) \leftarrow \frac{1}{16} e$  
This preserves the average spatial optical density across regions so the human visual system perceives smooth continuous tones.

---

### Q4: Explain the 2×2 Naor-Shamir subpixel codebook and derive the contrast formula $\alpha$.
**Answer:**  
In the baseline 2-out-of-2 scheme (P1), each secret pixel is replaced by a $2\times 2$ block of 4 subpixels (pixel expansion factor $m = 4$).  
There are 6 canonical column permutations containing exactly 2 black subpixels and 2 white subpixels:
$$C_0 = \begin{bmatrix} 1 & 1 & 0 & 0 \\ 0 & 0 & 1 & 1 \end{bmatrix}, \quad C_1 = \begin{bmatrix} 1 & 0 & 1 & 0 \\ 0 & 1 & 0 & 1 \end{bmatrix}, \quad C_2 = \begin{bmatrix} 1 & 0 & 0 & 1 \\ 0 & 1 & 1 & 0 \end{bmatrix}$$
- **To encode a White pixel ($s = 0$):** Both Share 1 and Share 2 receive the **identical** $2\times 2$ pattern. The stacked block has Hamming weight $H(\text{White}) = 2$ black subpixels (50% transmission).
- **To encode a Black pixel ($s = 1$):** Share 2 receives the **complementary** pattern of Share 1. The stacked block has Hamming weight $H(\text{Black}) = 4$ black subpixels (0% transmission / 100% black).  
**Contrast ($\alpha$):**  
$$\alpha = \frac{H(\text{Black}) - H(\text{White})}{m} = \frac{4 - 2}{4} = \frac{1}{2} = 50\%$$
Because $H(\text{Black}) > H(\text{White})$, the human visual system readily perceives the contrast difference and resolves the secret.

---

### Q5: What is the formal information-theoretic security proof for a single share?
**Answer:**  
According to Shannon's Information Theory, a secret sharing scheme provides **perfect secrecy** if the mutual information between the secret $S$ and any unqualified set of shares $K$ is zero:
$$I(S; K) = 0 \iff H(S \mid K) = H(S)$$
For any given pixel, the choice of which of the 6 valid $2\times 2$ subpixel permutations is assigned to Share 1 is selected uniformly at random from a cryptographically secure pseudo-random number generator (CSPRNG):
$$P(\text{pattern} = P_i) = \frac{1}{6}, \quad \forall i \in \{0, 1, 2, 3, 4, 5\}$$
Regardless of whether the secret pixel was Black or White, the marginal probability distribution of subpixel patterns in Share 1 is identical:
$$P(\text{Share}_1 = P_i \mid S = 0) = \frac{1}{6} = P(\text{Share}_1 = P_i \mid S = 1)$$
Consequently, observing Share 1 alone provides zero statistical information about $S$. In our unit test suite (`tests/test_color_schemes.py` and `tests/test_privacy.py`), chi-square statistical tests verify that subpixel ink distributions show zero correlation with the underlying secret.

---

### Q6: How does Mode B (Colour XOR, Wang et al. 2005) differ from Mode A (Colour Overlay, Hou 2003)?
**Answer:**  
| Feature | Mode A: Colour Overlay (P5, Hou 2003) | Mode B: Colour XOR (P6, Wang et al. 2005) |
|---|---|---|
| **Reconstruction Method** | Physical transparency stacking ($\min$ / multiply) | Digital bitwise XOR logic ($\bigoplus$) |
| **Pixel Expansion ($m$)** | $m = 4$ ($2\times 2$ subpixels, doubled dimensions) | $m = 1$ ($0\times$ expansion, 1:1 original size) |
| **Colour Space** | Subtractive CMY halftoned dot planes | 24-bit RGB continuous tone channels |
| **Fidelity / PSNR** | Halftoned visual approximation ($\text{PSNR} \approx 20\text{--}30\text{ dB}$) | Lossless exact match ($\text{PSNR} = \infty$, byte-for-byte identical) |
| **Physical Stacking Feasibility** | **Yes** (operates on overhead transparencies) | **No** (Boolean XOR cannot be realized purely by light absorption) |
| **Threshold Access Structure** | Strictly $(2, 2)$ | Flexible $(n, n)$ with $n \in [2..6]$ |

---

### Q7: Why can XOR secret sharing NOT be reconstructed using physical transparency sheets?
**Answer:**  
Physical light absorption is inherently a **subtractive minimum (or Boolean OR)** operation, not a Boolean XOR operation:
- If a subpixel is transparent ($0$) in Layer 1 and black ($1$) in Layer 2: light is blocked $\implies$ Black ($1$).
- If a subpixel is black ($1$) in Layer 1 and black ($1$) in Layer 2: light is blocked $\implies$ Black ($1$).
Thus, physical overlay computes $1 \text{ OR } 1 = 1$.  
In contrast, Boolean XOR requires:
$$1 \oplus 1 = 0 \quad (\text{Black } \oplus \text{ Black} = \text{White})$$
Two opaque black regions stacked on top of each other cannot optically produce transparent white light. Therefore, XOR secret sharing requires digital computation for reconstruction.

---

### Q8: What is the purpose of the Display Enhancement mode in Colour Overlay reconstruction?
**Answer:**  
Raw physical overlay reconstruction produces an image with:
1. $2\times 2$ pixel expansion ($4\times$ area).
2. Halftone graininess and reduced luminance because even white areas transmit only 50% of incident light ($H=2$).  
Our **Display Enhancement** algorithm (Mode A) mathematically models what the human eye perceives at a distance:
1. It partitions the stacked CMY image into non-overlapping $2\times 2$ subpixel blocks.
2. For each channel (C, M, Y), it computes the ink coverage fraction:
   $$\text{Coverage} = \frac{\text{sum of ink pixels in } 2\times 2 \text{ block}}{4}$$
3. It applies a contrast threshold at $0.75$:
   - $\text{Coverage} \ge 0.75 \implies \text{Ink Present} (255)$
   - $\text{Coverage} < 0.75 \implies \text{Ink Absent} (0)$
4. It converts the recovered CMY channels back to RGB:
   $$R = 255 - C, \quad G = 255 - M, \quad B = 255 - Y$$
5. It applies a subtle Gaussian spatial filter ($\sigma = 0.8$) to smooth dot boundaries.  
This delivers a clean, vibrant original-size preview while preserving the raw exact subpixel reconstruction for inspection.

---

### Q9: How does the application detect and handle Group Mismatches between shares?
**Answer:**  
When multiple visual cryptography runs are conducted, downloaded shares can easily be confused (e.g. attempting to stack Share 1 from Run A with Share 2 from Run B). Uncorrelated shares stacked together produce pure, unrecoverable statistical noise.  
To prevent this failure mode:
1. **Metadata Embedding:** When generating shares, lossless PNG `tEXt` chunks are injected into the file structure:
   - `vc_scheme`: e.g. `color_overlay`
   - `vc_version`: `2.0`
   - `vc_group`: cryptographic run token, e.g. `c7f91a`
   - `vc_index`: share sequence (e.g. `1` of `2`)
   - `vc_n`: total shares required
2. **Client-Side Pre-Flight Check:** On the Reconstruct tab, JavaScript parses the binary PNG header chunks directly in the browser via `DataView`. If $\text{group}_A \ne \text{group}_B$, a high-visibility warning banner is immediately rendered:
   > *"Group Warning: These shares do not belong to the same generation run. Stacking them will result in uncorrelated noise."*
3. **Server Validation:** The backend validation layer (`vc/validation.py`) cross-verifies chunk metadata and returns a structured warning flag in the API response.

---

### Q10: How do the literature papers P1 through P10 map to this project's architecture?
**Answer:**  
1. **P1 (Naor & Shamir 1994):** Fundamental baseline 2-out-of-2 visual cryptography, $2\times 2$ subpixel expansion, and optical decoding.
2. **P2 (Naor & Shamir 1996):** Mathematical analysis of contrast bounds $\alpha$ and subpixel minimization.
3. **P3 (Ateniese et al. 1996):** General access structures $(k, n)$ defining qualified versus forbidden share sets.
4. **P4 (Blundo et al. 1996):** Proof of optimal contrast bounds in visual secret sharing schemes.
5. **P5 (Hou 2003):** The cornerstone for **Mode A**: CMY subtractive primary decomposition, Floyd-Steinberg halftoning, and color visual secret sharing.
6. **P6 (Wang et al. 2005):** The foundation for **Mode B**: 24-bit bitwise XOR secret sharing with $0\times$ pixel expansion and lossless recovery.
7. **P7 (Ross & Othman 2011):** Real-world application of visual cryptography to **biometric template privacy** (decentralized biometric authentication).
8. **P8 (Rura et al. 2017):** Application to **electronic voting systems** ensuring tamper-evident voter ballot auditability.
9. **P9 (Mursi et al. 2014):** Comprehensive taxonomy comparing traditional, extended, halftone, and progressive visual cryptography.
10. **P10 (Leung et al. 2008):** Formal information-theoretic cryptanalysis and security bounds for color visual secret sharing schemes.

---

### Q11: Why did VeilShare v3 transition to an entirely On-Device Web Worker architecture?
**Answer:**  
In conventional web architectures, user images are transmitted over HTTPS to a cloud server running Python or Node for processing. For cryptographic privacy and biometric security (P7, P8), this introduces critical vulnerabilities:
1. **Zero Cloud Transmission:** By executing all cryptographic algorithms directly in the user's browser using a dedicated Web Worker and the Web Crypto API (`crypto.getRandomValues`), sensitive images **never leave the client machine**. Even if the hosting infrastructure is compromised, zero secret bytes exist on any server.
2. **Deterministic Availability:** The application runs entirely on static assets served by Vercel's global edge network (`dist/index.html`). There are no cold starts, container startup latencies, or serverless execution timeout limits (e.g. Vercel 10s execution caps).
3. **Real-Time Network Telemetry Auditor:** The application intercepts `fetch`, `XMLHttpRequest`, and `navigator.sendBeacon` to display a live network monitor in the header showing `"Data Sent: 0"`, proving mathematically that zero bytes of image data escape to the network.

---

### Q12: How does VeilShare safely handle entropy quotas and memory limits in the Web Crypto API?
**Answer:**  
The W3C Web Crypto specification mandates a strict quota: calling `crypto.getRandomValues(buffer)` with a buffer larger than **65,536 bytes (64 KB)** throws a fatal `QuotaExceededError`.  
For high-resolution image secret sharing (e.g., $640\times 640\times 4 = 1,638,400$ bytes), passing the full buffer directly would crash the client.  
VeilShare implements an entropy allocation chunker (`fillCryptoRandomValues` in `src/engine/cryptoRandom.ts`):
```ts
export function fillCryptoRandomValues(buffer: Uint8Array): Uint8Array {
  const CHUNK_SIZE = 65536;
  for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
    const end = Math.min(offset + CHUNK_SIZE, buffer.length);
    crypto.getRandomValues(buffer.subarray(offset, end));
  }
  return buffer;
}
```
This guarantees cryptographically uniform entropy across arbitrary array sizes while adhering strictly to browser platform boundaries.


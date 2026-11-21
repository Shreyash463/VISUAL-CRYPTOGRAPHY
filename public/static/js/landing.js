/**
 * Landing page interactive engine:
 * 1. Animated 2x2-subpixel noise hero canvas with mouse/slider padlock reveal.
 * 2. Superposition Transparency Simulator with mix-blend-mode: multiply & magnetic snap.
 * 3. Dynamic research papers (P1–P10) rendering.
 * 4. Theme management (Dark "Noise" / Light "Pastel").
 */

// Papers P1 to P10 data
const PAPERS = [
  { id: "P1", title: "Visual Cryptography", authors: "Moni Naor & Adi Shamir", venue: "EUROCRYPT 1994", url: "https://doi.org/10.1007/BFb0053419", desc: "Foundational visual cryptography scheme using 2x2 subpixel expansions and physical transparency superposition." },
  { id: "P2", title: "Visual Cryptography II: Improving the Contrast", authors: "Moni Naor & Adi Shamir", venue: "IACR 1996", url: "https://eprint.iacr.org/1996/007", desc: "Techniques for optimal contrast and pixel expansion in k-out-of-n secret sharing." },
  { id: "P3", title: "Visual Cryptography for General Access Structures", authors: "G. Ateniese, C. Blundo, A. De Santis, D. R. Stinson", "venue": "ECCC 1996", url: "https://eccc.weizmann.ac.il/report/1996/012", desc: "Generalized mathematical models for qualified and forbidden sets of shares." },
  { id: "P4", title: "On the Contrast in Visual Cryptography Schemes", authors: "C. Blundo, A. De Santis, D. R. Stinson", venue: "IACR 1996", url: "https://eprint.iacr.org/1996/013", desc: "Theoretical bounds and characterization of contrast in visual secret sharing schemes." },
  { id: "P5", title: "Visual Cryptography for Color Images", authors: "Young-Chang Hou", venue: "Pattern Recognition 2003", url: "https://ir.lib.ncu.edu.tw/handle/987654321/31614", desc: "Decomposition into CMY subtractive primaries with Floyd-Steinberg halftoning and Naor-Shamir subpixel sharing." },
  { id: "P6", title: "Secret Color Images Sharing Schemes Based on XOR Operation", authors: "D. Wang, L. Zhang, N. Ma, X. Huang", venue: "IACR 2005", url: "https://eprint.iacr.org/2005/372", desc: "Bitwise XOR-based secret sharing eliminating pixel expansion and enabling lossless digital reconstruction." },
  { id: "P7", title: "Visual Cryptography for Biometric Privacy", authors: "Arun Ross & Abeer Othman", venue: "IEEE Computer Society 2011", url: "https://www.infona.pl/resource/bwmeta1.element.ieee-art-000005658142", desc: "Decentralized storage of biometric face and fingerprint templates across distinct trusted databases." },
  { id: "P8", title: "Online Voting System with Steganography & Visual Cryptography", authors: "L. Rura, B. Issac, M. K. Haldar", venue: "CIT. Journal of Computing and Information Technology 2017", url: "https://hrcak.srce.hr/en/179239", desc: "Verifiable ballot secret sharing preventing insider election tampering." },
  { id: "P9", title: "Visual Cryptography Schemes: A Comprehensive Survey", authors: "O. Mursi, A. Salama, H. Mansour", venue: "ERMT 2014", url: "http://www.ermt.net/docs/papers/Volume_3/11_November2014/V3N11-141.pdf", desc: "Comparative taxonomy of traditional, extended, halftone, and progressive visual cryptography." },
  { id: "P10", title: "On the Security of a Visual Cryptography Scheme for Color Images", authors: "C. Leung, W. Ng, D. Wong", venue: "IACR 2008", url: "https://eprint.iacr.org/2008/223", desc: "Security and information-theoretic leakage bounds on color visual cryptography constructions." }
];

// Six Naor-Shamir (1994) 2x2 patterns (row-major: p0, p1, p2, p3)
const PATTERNS = [
  [1, 1, 0, 0], // Pat 0
  [0, 0, 1, 1], // Pat 1 (comp of 0)
  [1, 0, 1, 0], // Pat 2
  [0, 1, 0, 1], // Pat 3 (comp of 2)
  [1, 0, 0, 1], // Pat 4
  [0, 1, 1, 0], // Pat 5 (comp of 4)
];
const COMPLEMENTS = [1, 0, 3, 2, 5, 4];

// Small pseudo-random seeded generator
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// -------------------------------------------------------------
// 1. Hero Canvas: Real Visual Cryptography Padlock Simulation
// -------------------------------------------------------------
function initHeroCanvas() {
  const canvas = document.getElementById("hero-canvas");
  const slider = document.getElementById("hero-slider");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Padlock secret bitmap (40 x 40 grid)
  const GW = 40;
  const GH = 40;
  const secret = new Uint8Array(GW * GH); // 1 = black (padlock), 0 = white

  // Draw padlock into secret
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      let isPadlock = false;
      // Body: rect from x:12..28, y:18..36
      if (x >= 12 && x <= 28 && y >= 18 && y <= 35) {
        isPadlock = true;
        // Keyhole
        if (x >= 19 && x <= 21 && y >= 22 && y <= 26) isPadlock = false;
        if (x === 20 && y >= 26 && y <= 30) isPadlock = false;
      }
      // Shackle: arch from x:15..25, y:8..18
      const dx = x - 20;
      const dy = y - 16;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (y <= 18 && dist >= 5.5 && dist <= 8.5) {
        isPadlock = true;
      }
      secret[y * GW + x] = isPadlock ? 1 : 0;
    }
  }

  // Pre-generate Share 1 and Share 2 subpixel bitmaps
  // Each secret pixel expands to 2x2 subpixels
  const SW = GW * 2;
  const SH = GH * 2;
  const share1 = new Uint8Array(SW * SH);
  const share2 = new Uint8Array(SW * SH);

  const rng = mulberry32(1337);
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const isBlack = secret[y * GW + x] === 1;
      const pIdx = Math.floor(rng() * 6);
      const p1 = PATTERNS[pIdx];
      const p2 = isBlack ? PATTERNS[COMPLEMENTS[pIdx]] : PATTERNS[pIdx];

      const sy = y * 2;
      const sx = x * 2;

      share1[sy * SW + sx] = p1[0];
      share1[sy * SW + (sx + 1)] = p1[1];
      share1[(sy + 1) * SW + sx] = p1[2];
      share1[(sy + 1) * SW + (sx + 1)] = p1[3];

      share2[sy * SW + sx] = p2[0];
      share2[sy * SW + (sx + 1)] = p2[1];
      share2[(sy + 1) * SW + sx] = p2[2];
      share2[(sy + 1) * SW + (sx + 1)] = p2[3];
    }
  }

  let width = 0;
  let height = 0;
  let offsetX = 40; // current offset in subpixels

  function resize() {
    width = canvas.parentElement.clientWidth;
    height = canvas.parentElement.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    render();
  }

  window.addEventListener("resize", resize);

  function render() {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);

    // Calculate subpixel scale to fill center
    const scale = Math.max(2, Math.floor(Math.min(width / SW, height / SH) * 1.2));
    const renderW = SW * scale;
    const renderH = SH * scale;
    const startX = Math.floor((width - renderW) / 2);
    const startY = Math.floor((height - renderH) / 2);

    // Off-screen canvas for superposition
    const offCanvas = document.createElement("canvas");
    offCanvas.width = SW;
    offCanvas.height = SH;
    const offCtx = offCanvas.getContext("2d");
    const imgData = offCtx.createImageData(SW, SH);
    const data = imgData.data;

    const shiftX = Math.round(offsetX);

    for (let y = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++) {
        const s1 = share1[y * SW + x];
        // Sample share 2 with horizontal shift
        const x2 = x + shiftX;
        let s2 = 0;
        if (x2 >= 0 && x2 < SW) {
          s2 = share2[y * SW + x2];
        } else {
          // Wrap or random
          s2 = (x2 + y) % 2;
        }

        // Physical stacking: 1 (ink) OR 1 (ink) = 1 (black)
        const stacked = (s1 === 1 || s2 === 1) ? 0 : 255;
        const idx = (y * SW + x) * 4;
        data[idx] = stacked;     // R
        data[idx + 1] = stacked; // G
        data[idx + 2] = stacked; // B
        data[idx + 3] = 255;     // A
      }
    }

    offCtx.putImageData(imgData, 0, 0);

    // Draw magnified
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offCanvas, startX, startY, renderW, renderH);
  }

  if (slider) {
    slider.addEventListener("input", (e) => {
      // 0 = 40px offset (noise), 100 = 0px offset (revealed)
      const val = parseFloat(e.target.value);
      offsetX = (1.0 - val / 100.0) * 36;
      render();
    });
  }

  // Mouse move over hero section gently shifts alignment
  const heroSec = document.getElementById("hero");
  if (heroSec) {
    heroSec.addEventListener("mousemove", (e) => {
      if (document.activeElement === slider) return;
      const rect = heroSec.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width; // 0..1
      // If mouse near center, snap to 0!
      const distFromCenter = Math.abs(normX - 0.5);
      if (distFromCenter < 0.04) {
        offsetX = 0;
        if (slider) slider.value = 100;
      } else {
        offsetX = (normX - 0.5) * 50;
        if (slider) slider.value = Math.max(0, Math.min(100, (1 - Math.abs(offsetX) / 25) * 100));
      }
      render();
    });
  }

  resize();
}

// -------------------------------------------------------------
// 2. Superposition Transparency Simulator (Mini Demo)
// -------------------------------------------------------------
function initMiniDemo() {
  const canvasA = document.getElementById("demo-share-a");
  const canvasB = document.getElementById("demo-share-b");
  const slider = document.getElementById("demo-slider");
  const statusText = document.getElementById("status-text");
  const indicator = document.querySelector(".status-indicator");
  const snapBtn = document.getElementById("demo-snap-btn");
  const jitterBtn = document.getElementById("demo-jitter-btn");

  if (!canvasA || !canvasB || !slider) return;

  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");

  // Generate colorful demonstration secret (SSPU monogram / star)
  const W = 150;
  const H = 150;
  const offA = document.createElement("canvas");
  const offB = document.createElement("canvas");
  offA.width = W * 2;
  offA.height = H * 2;
  offB.width = W * 2;
  offB.height = H * 2;

  const cA = offA.getContext("2d");
  const cB = offB.getContext("2d");
  const idA = cA.createImageData(W * 2, H * 2);
  const idB = cB.createImageData(W * 2, H * 2);

  const rng = mulberry32(42);

  // Generate shares for a colorful circular emblem
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - W / 2;
      const dy = y - H / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Secret emblem in CMY channels
      let cInk = (dist > 35 && dist < 65) ? 1 : 0;
      let mInk = (Math.abs(dx) < 18 || Math.abs(dy) < 18) && dist < 60 ? 1 : 0;
      let yInk = (dist < 40) ? 1 : 0;

      // 3 channels
      const inks = [cInk, mInk, yInk];
      const pIdxs = [
        Math.floor(rng() * 6),
        Math.floor(rng() * 6),
        Math.floor(rng() * 6),
      ];

      for (let ch = 0; ch < 3; ch++) {
        const p1 = PATTERNS[pIdxs[ch]];
        const p2 = inks[ch] === 1 ? PATTERNS[COMPLEMENTS[pIdxs[ch]]] : PATTERNS[pIdxs[ch]];

        for (let sub = 0; sub < 4; sub++) {
          const sx = x * 2 + (sub % 2);
          const sy = y * 2 + Math.floor(sub / 2);
          const idx = (sy * (W * 2) + sx) * 4;

          // In RGB: ink = 1 means channel value = 0 (subtractive primary)
          idA.data[idx + ch] = p1[sub] === 1 ? 0 : 255;
          idB.data[idx + ch] = p2[sub] === 1 ? 0 : 255;
          idA.data[idx + 3] = 255;
          idB.data[idx + 3] = 255;
        }
      }
    }
  }

  cA.putImageData(idA, 0, 0);
  cB.putImageData(idB, 0, 0);

  ctxA.imageSmoothingEnabled = false;
  ctxB.imageSmoothingEnabled = false;
  ctxA.drawImage(offA, 0, 0, 300, 300);
  ctxB.drawImage(offB, 0, 0, 300, 300);

  function updateOffset(offset) {
    // Apply transform to Share B with magnetic snap near 0
    let effectiveOffset = offset;
    const isSnapped = Math.abs(offset) <= 3;

    if (isSnapped) {
      effectiveOffset = 0;
      canvasB.style.transform = `translateX(0px)`;
      if (statusText) statusText.textContent = "Offset: 0px — Aligned! Secret Revealed";
      if (indicator) indicator.classList.add("aligned");
    } else {
      canvasB.style.transform = `translateX(${effectiveOffset}px)`;
      if (statusText) statusText.textContent = `Offset: ${effectiveOffset}px (Uncorrelated Noise)`;
      if (indicator) indicator.classList.remove("aligned");
    }
  }

  slider.addEventListener("input", (e) => {
    updateOffset(parseInt(e.target.value, 10));
  });

  if (snapBtn) {
    snapBtn.addEventListener("click", () => {
      slider.value = 0;
      updateOffset(0);
    });
  }

let jitterSeed = 987654321;
function pseudoRandom() {
  jitterSeed = (jitterSeed * 1664525 + 1013904223) % 4294967296;
  return jitterSeed / 4294967296;
}

  if (jitterBtn) {
    jitterBtn.addEventListener("click", () => {
      const randOffset = Math.floor(pseudoRandom() * 80) - 40;
      slider.value = randOffset;
      updateOffset(randOffset);
    });
  }

  updateOffset(parseInt(slider.value, 10));
}

// -------------------------------------------------------------
// 3. Render Research Papers (P1 - P10)
// -------------------------------------------------------------
function renderPapers() {
  const grid = document.getElementById("papers-grid");
  if (!grid) return;

  grid.textContent = "";

  PAPERS.forEach((p) => {
    const card = document.createElement("div");
    card.className = "paper-card";

    const top = document.createElement("div");
    top.className = "paper-card-top";

    const idTag = document.createElement("span");
    idTag.className = "paper-id-tag";
    idTag.textContent = p.id;
    top.appendChild(idTag);

    const venue = document.createElement("span");
    venue.className = "paper-venue";
    venue.textContent = p.venue;
    top.appendChild(venue);

    const title = document.createElement("h4");
    title.className = "paper-title";
    title.textContent = p.title;

    const authors = document.createElement("p");
    authors.className = "paper-authors";
    authors.textContent = p.authors;

    const desc = document.createElement("p");
    desc.className = "paper-desc";
    desc.textContent = p.desc;

    const link = document.createElement("a");
    link.className = "paper-link";
    link.href = p.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Read Paper / DOI \u2197";

    card.appendChild(top);
    card.appendChild(title);
    card.appendChild(authors);
    card.appendChild(desc);
    card.appendChild(link);

    grid.appendChild(card);
  });
}

// -------------------------------------------------------------
// 4. Theme Toggle (Dark "Noise" / Light "Pastel")
// -------------------------------------------------------------
function initTheme() {
  const toggleBtn = document.getElementById("theme-toggle");
  const root = document.documentElement;

  function getTheme() {
    try {
      const saved = localStorage.getItem("vc-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch (e) {}
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("vc-theme", theme);
    } catch (e) {}
  }

  applyTheme(getTheme());

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const current = root.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }
}

// Initialization on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initHeroCanvas();
  initMiniDemo();
  renderPapers();
});

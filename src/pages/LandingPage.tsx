import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Lock,
  Eye,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { PROJECT_CONFIG } from "../config/project";
import { PATTERNS_2X2 } from "../engine/colorOverlay";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const heroCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sliderOffset, setSliderOffset] = useState<number>(18); // Default slight offset
  const [activeStoryStep, setActiveStoryStep] = useState<number>(1);

  // Animated 2x2 noise canvas with padlock reveal on mouse scrub
  useEffect(() => {
    const canvas = heroCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 320;
    const height = 320;
    canvas.width = width;
    canvas.height = height;

    // Generate deterministic 2x2 noise layers for the padlock
    const share1 = new Uint8Array(width * height);
    const share2 = new Uint8Array(width * height);

    // Create padlock mask
    const cx = width / 2;
    const cy = height / 2;
    const isSecretPixel = (x: number, y: number): boolean => {
      const origX = Math.floor(x / 2);
      const origY = Math.floor(y / 2);
      const ocx = cx / 2;
      const ocy = cy / 2;
      const dx = origX - ocx;
      const dy = origY - ocy;

      // Lock body: rectangle
      if (Math.abs(dx) < 28 && dy >= -8 && dy <= 32) return true;
      // Lock shackle: arch
      const dist = Math.sqrt(dx * dx + (dy + 12) * (dy + 12));
      if (dist >= 16 && dist <= 28 && dy <= -8) return true;
      return false;
    };

    // Populate shares
    for (let y = 0; y < height / 2; y++) {
      for (let x = 0; x < width / 2; x++) {
        const secret = isSecretPixel(x * 2, y * 2);
        // Random pattern
        const patIdx = (x * 17 + y * 31) % 6;
        const compIdx = [1, 0, 3, 2, 5, 4][patIdx];

        const p1 = PATTERNS_2X2[patIdx];
        const p2 = secret ? PATTERNS_2X2[compIdx] : p1;

        const subOffsets = [[0, 0], [1, 0], [0, 1], [1, 1]];
        for (let s = 0; s < 4; s++) {
          const sx = x * 2 + subOffsets[s][0];
          const sy = y * 2 + subOffsets[s][1];
          share1[sy * width + sx] = p1[s];
          share2[sy * width + sx] = p2[s];
        }
      }
    }

    // Render loop with slider offset
    const render = () => {
      const imgData = ctx.createImageData(width, height);
      const data = imgData.data;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const s1 = share1[y * width + x];
          // Sample share2 with horizontal offset
          const s2X = x + sliderOffset;
          const s2 = s2X >= 0 && s2X < width ? share2[y * width + s2X] : 0;

          // Subtractive overlay: minimum brightness
          // In ink notation: 1 = black ink, 0 = white
          const isBlack = s1 === 1 || s2 === 1;
          const val = isBlack ? 15 : 230;

          const idx = (y * width + x) * 4;
          data[idx] = val === 15 ? 229 : 234;     // Slight tint
          data[idx + 1] = val === 15 ? 50 : 240;
          data[idx + 2] = val === 15 ? 63 : 255;
          data[idx + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);
    };

    render();
  }, [sliderOffset]);

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[var(--accent)]/10 blur-[140px] pointer-events-none" />

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Left Column: Heading & CTAs */}
        <div className="flex-1 max-w-2xl text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>On-Device Cryptography Studio · Zero Server Roundtrips</span>
          </div>

          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.08] text-[var(--text)]">
            Two noises. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-rose-400">
              One secret.
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-[var(--muted)] leading-relaxed">
            Deconstruct sensitive photographs into information-theoretically secure noise shares.
            Stack physical transparencies to reveal secrets optically — no algorithms, no keys, and zero digital computation required.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4">
            <Link
              to="/studio/generate"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-lg hover:shadow-xl hover:scale-102 active:scale-98"
            >
              <span>Open Studio</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={() => {
                setSliderOffset(0);
                const el = document.getElementById("demo-slider-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4 text-amber-400" />
              <span>Try Live Overlay Demo</span>
            </button>
          </div>

          {/* Security Guarantee Strip */}
          <div className="mt-8 pt-6 border-t border-[var(--border)]/60 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs font-mono text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> 100% On-Device Engine
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> Zero Cloud Transmission
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> P1 & P5 Compliant
            </span>
          </div>
        </div>

        {/* Right Column: Animated Noise & Reveal Hero Canvas */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative p-3 rounded-3xl bg-[var(--panel)] border border-[var(--border)] shadow-2xl">
            <div className="relative w-[320px] h-[320px] rounded-2xl overflow-hidden bg-black/60 shadow-inner flex items-center justify-center">
              <canvas
                ref={heroCanvasRef}
                className="w-full h-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />

              {sliderOffset === 0 && (
                <div className="absolute inset-0 bg-transparent flex items-center justify-center pointer-events-none">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[var(--accent)] text-white shadow-lg animate-bounce">
                    Aligned! Padlock Revealed
                  </span>
                </div>
              )}
            </div>

            {/* Interactive scrub slider directly under hero */}
            <div className="mt-4 px-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-[var(--muted)] mb-1.5">
                <span>Offset: {sliderOffset}px (Drag to align)</span>
                <button
                  type="button"
                  onClick={() => setSliderOffset(sliderOffset === 0 ? 18 : 0)}
                  className="text-[var(--accent)] hover:underline cursor-pointer"
                >
                  {sliderOffset === 0 ? "Misalign" : "Snap to 0px"}
                </button>
              </div>
              <input
                id="demo-alignment-slider"
                type="range"
                min="-30"
                max="30"
                value={sliderOffset}
                onChange={(e) => setSliderOffset(parseInt(e.target.value, 10))}
                className="w-full accent-[var(--accent)] cursor-pointer"
                aria-label="Interactive visual cryptography alignment slider"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4-Step Visual Cryptography Storytelling */}
      <section id="demo-slider-section" className="py-20 border-t border-[var(--border)] bg-[var(--panel-alt)]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[var(--text)]">
              The Physics of Visual Secret Sharing
            </h2>
            <p className="mt-3 text-sm text-[var(--muted)]">
              How human vision decodes mathematics without electronic computation.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: 1,
                title: "1. The Secret Image",
                desc: "An arbitrary 24-bit RGB continuous tone image is loaded into memory entirely on-device.",
              },
              {
                step: 2,
                title: "2. CMY Halftoning",
                desc: "Floyd-Steinberg 2D error diffusion quantizes continuous color into subtractive Cyan, Magenta, and Yellow ink planes.",
              },
              {
                step: 3,
                title: "3. 2×2 Subpixel Matrices",
                desc: "Each pixel expands into 4 subpixels. 6 complementary pattern configurations guarantee zero mutual information per share.",
              },
              {
                step: 4,
                title: "4. Optical Superposition",
                desc: "Stacking the transparencies subtracts light. Inked subpixels block transmission, revealing the secret image naturally.",
              },
            ].map((st) => (
              <div
                key={st.step}
                className="p-6 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xs flex flex-col justify-between"
              >
                <div>
                  <span className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] font-mono font-bold flex items-center justify-center text-xs mb-4">
                    0{st.step}
                  </span>
                  <h3 className="font-display font-bold text-base text-[var(--text)]">{st.title}</h3>
                  <p className="mt-2 text-xs text-[var(--muted)] leading-relaxed">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Four Core Cryptographic Schemes */}
      <section className="py-20 border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display font-bold text-3xl text-[var(--text)]">Cryptographic Engine Schemes</h2>
            <p className="text-sm text-[var(--muted)] mt-2">
              Choose between physical optical superposition and digital lossless XOR secret sharing.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                name: "Colour Overlay 2-of-2",
                paper: "P5 · Hou 2003",
                expansion: "2× expansion",
                recon: "Physical Stacking",
                color: "CMY Subtractive",
              },
              {
                name: "Colour XOR (n, n) Exact",
                paper: "P6 · Wang et al. 2005",
                expansion: "0× expansion (1:1)",
                recon: "Lossless Byte-Exact",
                color: "24-bit Truecolor RGB",
              },
              {
                name: "B/W Overlay 2-of-2",
                paper: "P1 · Naor-Shamir 1994",
                expansion: "2× expansion (4 subpixels)",
                recon: "Transparency Overlay",
                color: "1-bit Binary",
              },
              {
                name: "B/W XOR (n, n)",
                paper: "P6 · Wang et al.",
                expansion: "0× expansion",
                recon: "Exact Parity XOR",
                color: "1-bit Binary",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-sm flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-mono text-[var(--accent)]">{item.paper}</span>
                  <h3 className="font-display font-bold text-base text-[var(--text)] mt-1">{item.name}</h3>

                  <div className="mt-4 space-y-1.5 text-xs font-mono text-[var(--muted)] border-t border-[var(--border)]/60 pt-3">
                    <div>Expansion: <span className="text-[var(--text)]">{item.expansion}</span></div>
                    <div>Decoding: <span className="text-[var(--text)]">{item.recon}</span></div>
                    <div>Gamut: <span className="text-[var(--text)]">{item.color}</span></div>
                  </div>
                </div>

                <Link
                  to="/studio/generate"
                  className="mt-6 inline-flex items-center justify-between text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  <span>Launch in Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Institutional Footer */}
      <footer className="py-12 border-t border-[var(--border)] bg-[var(--panel)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="flex items-center gap-4">
            <img src="/sspu-logo.png" alt="SSPU Logo" className="h-12 w-auto object-contain" />
            <div>
              <p className="font-display font-bold text-sm text-[var(--text)]">{PROJECT_CONFIG.institution}</p>
              <p className="text-xs font-mono text-[var(--accent)]">{PROJECT_CONFIG.motto}</p>
            </div>
          </div>

          <div className="text-xs font-mono text-[var(--muted)]">
            VeilShare · Visual Cryptography Studio | SSPU Final Review
          </div>
        </div>
      </footer>
    </div>
  );
};

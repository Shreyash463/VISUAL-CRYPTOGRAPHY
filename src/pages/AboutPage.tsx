import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ExternalLink, GraduationCap, Users, BookOpen, AlertCircle, ShieldCheck } from "lucide-react";
import { PROJECT_CONFIG } from "../config/project";

export const AboutPage: React.FC = () => {
  const [openAccordion, setOpenAccordion] = useState<string | null>("how_it_works");

  const toggleAccordion = (id: string) => {
    setOpenAccordion((cur) => (cur === id ? null : id));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="font-display font-bold text-3xl text-[var(--text)]">About VeilShare</h1>
        <p className="text-sm text-[var(--muted)] mt-1.5 font-mono">
          {PROJECT_CONFIG.projectName} · {PROJECT_CONFIG.subtitle}
        </p>
      </div>

      {/* Accordions */}
      <div className="space-y-4 mb-12">
        {/* Accordion 1: How It Works */}
        <div className="rounded-2xl bg-[var(--panel)] border border-[var(--border)] overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => toggleAccordion("how_it_works")}
            className="w-full px-6 py-4 flex items-center justify-between text-left font-display font-bold text-sm text-[var(--text)] hover:bg-[var(--panel-alt)]/40 transition-colors cursor-pointer"
          >
            <span>1. What is Visual Cryptography & How Does It Work?</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openAccordion === "how_it_works" ? "rotate-180 text-[var(--accent)]" : "text-[var(--muted)]"}`} />
          </button>
          <AnimatePresence>
            {openAccordion === "how_it_works" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-5 pt-1 text-xs text-[var(--muted)] leading-relaxed space-y-2 border-t border-[var(--border)]/40">
                  <p>
                    Visual Cryptography (introduced by Moni Naor & Adi Shamir at EUROCRYPT 1994) is an information-theoretically secure secret sharing paradigm where an image is split into noise-like shares.
                  </p>
                  <p>
                    In physical overlay schemes (P1, P5), the secret is decoded purely by human optical perception when transparent printouts of the shares are stacked together. No decryption algorithm, no cryptographic keys, and zero digital computation are required to read the secret.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Accordion 2: The Four Cryptographic Schemes */}
        <div className="rounded-2xl bg-[var(--panel)] border border-[var(--border)] overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => toggleAccordion("schemes")}
            className="w-full px-6 py-4 flex items-center justify-between text-left font-display font-bold text-sm text-[var(--text)] hover:bg-[var(--panel-alt)]/40 transition-colors cursor-pointer"
          >
            <span>2. The Four Cryptographic Schemes in VeilShare Studio</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openAccordion === "schemes" ? "rotate-180 text-[var(--accent)]" : "text-[var(--muted)]"}`} />
          </button>
          <AnimatePresence>
            {openAccordion === "schemes" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-5 pt-1 text-xs text-[var(--muted)] leading-relaxed space-y-3 border-t border-[var(--border)]/40">
                  <div>
                    <strong className="text-[var(--text)]">Mode A: Colour Overlay 2-out-of-2 (P5, Hou 2003)</strong>
                    <p>Decomposes full 24-bit RGB into Cyan, Magenta, and Yellow ink densities. Each channel undergoes Floyd-Steinberg 2D spatial error diffusion, followed by 2×2 subpixel expansion. Stacking simulates subtractive light absorption.</p>
                  </div>
                  <div>
                    <strong className="text-[var(--text)]">Mode B: Colour XOR (n, n) Exact (P6, Wang et al. 2005)</strong>
                    <p>Performs cryptographically secure 24-bit RGB bitwise XOR secret sharing across n shares. Digital reconstruction yields 100% byte-for-byte exact fidelity with zero pixel expansion.</p>
                  </div>
                  <div>
                    <strong className="text-[var(--text)]">Mode C: B/W Overlay 2-out-of-2 (P1, Naor-Shamir 1994)</strong>
                    <p>Classical baseline: white pixels expand to 2 white and 2 black subpixels (50% grey stack); black pixels expand to complementary subpixels (100% black stack).</p>
                  </div>
                  <div>
                    <strong className="text-[var(--text)]">Mode D: B/W XOR (n, n) (P6)</strong>
                    <p>1-bit binary XOR secret sharing eliminating subpixel expansion for digital applications.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Accordion 3: Inherent Limitations & Physics */}
        <div className="rounded-2xl bg-[var(--panel)] border border-[var(--border)] overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => toggleAccordion("limitations")}
            className="w-full px-6 py-4 flex items-center justify-between text-left font-display font-bold text-sm text-[var(--text)] hover:bg-[var(--panel-alt)]/40 transition-colors cursor-pointer"
          >
            <span>3. Scientific Trade-offs & Limitations</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openAccordion === "limitations" ? "rotate-180 text-[var(--accent)]" : "text-[var(--muted)]"}`} />
          </button>
          <AnimatePresence>
            {openAccordion === "limitations" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-5 pt-1 text-xs text-[var(--muted)] leading-relaxed space-y-2 border-t border-[var(--border)]/40">
                  <p>
                    <strong className="text-[var(--text)]">Contrast Loss:</strong> In physical overlay modes, transparent regions of the secret become 50% grey because each subpixel block contains 2 inked subpixels. This is a mathematical theorem of visual cryptography (Blundo et al., 1996).
                  </p>
                  <p>
                    <strong className="text-[var(--text)]">2× Spatial Expansion:</strong> Overlay schemes require 4 subpixels (2×2) per original pixel, expanding the share dimensions by 2× in width and height.
                  </p>
                  <p>
                    <strong className="text-[var(--text)]">Lossless PNG Integrity:</strong> Shares must never be re-compressed as lossy JPEG or resized, because altering individual subpixels destroys the strict subpixel alignment required for optical or XOR reconstruction.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* P1..P10 Research Papers Library */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="font-display font-bold text-lg text-[var(--text)]">Research Papers (P1 – P10)</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {PROJECT_CONFIG.papers.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--border)] flex flex-col justify-between hover:border-[var(--border-strong)] transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-[var(--accent)]">{p.id}</span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--muted)] hover:text-[var(--text)] inline-flex items-center gap-1"
                  >
                    <span>Read Paper</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <h3 className="font-display font-bold text-xs text-[var(--text)] leading-snug">{p.title}</h3>
                <span className="text-[11px] text-[var(--muted)] font-mono block mt-0.5">{p.authors} · {p.venue}</span>
                <p className="text-[11px] text-[var(--muted)] mt-2 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Institutional Branding Block (SSPU Emblem & Motto) */}
      <div className="p-6 rounded-2xl bg-[var(--panel)] border border-[var(--border)] mb-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
        <img
          src="/sspu-logo.png"
          alt="SSPU Logo"
          className="h-16 w-auto object-contain shrink-0"
        />
        <div className="flex-1">
          <h3 className="font-display font-bold text-base text-[var(--text)]">
            {PROJECT_CONFIG.institution}
          </h3>
          <p className="text-xs font-mono text-[var(--accent)] mt-0.5">{PROJECT_CONFIG.motto}</p>
          <p className="text-xs text-[var(--muted)] mt-1.5">
            Bachelor of Technology · Computer Science & Information Technology · {PROJECT_CONFIG.reviewStage}
          </p>
        </div>
      </div>

      {/* Team Block from src/config/project.ts */}
      <div className="p-6 rounded-2xl bg-[var(--panel)] border border-[var(--border)]">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="font-display font-bold text-base text-[var(--text)]">Project Team</h2>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {PROJECT_CONFIG.team.members.map((m) => (
            <div key={m.prn} className="p-3.5 rounded-xl bg-[var(--panel-alt)] border border-[var(--border)]">
              <span className="font-bold text-xs text-[var(--text)] block">{m.name}</span>
              <span className="text-[11px] text-[var(--muted)] block mt-0.5">{m.role}</span>
              <span className="text-[10px] font-mono text-[var(--accent)] block mt-1">{m.prn}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--border)] text-xs text-[var(--muted)] font-mono">
          Faculty Mentorship: <strong className="text-[var(--text)]">{PROJECT_CONFIG.team.mentor}</strong>
        </div>
      </div>
    </div>
  );
};

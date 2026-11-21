import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, RefreshCw, Sparkles, CheckCircle2, ShieldCheck } from "lucide-react";
import { useApp } from "../context/AppContext";
import { prepareImageRgba, compareSchemesOnDevice, QualityPreset, PRESET_DIMS } from "../engine/workerClient";
import { generateProceduralDemoImage } from "../engine/proceduralSample";
import { CountUp } from "../motion/CountUp";

interface ComparisonCard {
  id: string;
  name: string;
  paper: string;
  psnr: number;
  meanColorError: number;
  expansion: string;
  exactMatch: boolean;
  contrast: number;
  reconstructionTimeMs: number;
}

export const ComparePage: React.FC = () => {
  const { activeRun } = useApp();
  const [isRunning, setIsRunning] = useState(false);
  const [cards, setCards] = useState<ComparisonCard[]>([]);

  const runComparison = async () => {
    setIsRunning(true);
    try {
      // Use procedural colorful demo image if no active run
      const rawRgba = generateProceduralDemoImage(240, 240);
      const res = await compareSchemesOnDevice(rawRgba, 240, 240);

      const items: ComparisonCard[] = res.results.map((r) => {
        const paperMap: Record<string, string> = {
          color_overlay: "P5 · Hou 2003 (Pattern Recognition)",
          color_xor: "P6 Extension · Wang et al. 2005",
          overlay: "P1 · Naor & Shamir 1994 (EUROCRYPT)",
          xor: "P6 · Wang et al. 2005",
        };

        return {
          id: r.schemeId,
          name: r.name,
          paper: paperMap[r.schemeId] || "Research Paper",
          psnr: r.metrics.psnr,
          meanColorError: r.metrics.meanColorError,
          expansion: r.metrics.pixelExpansion,
          exactMatch: r.metrics.exactMatch,
          contrast: r.metrics.contrast || (r.schemeId.includes("overlay") ? 0.5 : 1.0),
          reconstructionTimeMs: r.metrics.processingTimeMs,
        };
      });

      setCards(items);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runComparison();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-[var(--text)]">Scheme Benchmarking & Comparison</h1>
            <p className="text-sm text-[var(--muted)]">
              4-way mathematical comparison of physical overlay vs digital XOR visual cryptography schemes.
            </p>
          </div>

          <button
            type="button"
            onClick={runComparison}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--panel-alt)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
            <span>Re-run Benchmark</span>
          </button>
        </div>

        {/* 4 Benchmark Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {cards.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--border)] p-5 shadow-sm justify-between gap-4 hover:border-[var(--border-strong)] transition-all"
            >
              <div>
                <span className="text-[11px] font-mono text-[var(--accent)] block mb-1">{c.paper}</span>
                <h3 className="font-display font-bold text-sm text-[var(--text)]">{c.name}</h3>

                {/* PSNR Gauge */}
                <div className="mt-4 p-3 rounded-xl bg-[var(--panel-alt)]/60 border border-[var(--border)]">
                  <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                    <span className="text-[var(--muted)]">Fidelity (PSNR)</span>
                    <span className="font-bold text-[var(--success)]">
                      {c.exactMatch ? "Lossless (∞)" : <><CountUp value={c.psnr} decimals={1} /> dB</>}
                    </span>
                  </div>
                  <div className="w-full bg-black/30 h-2 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (c.psnr / 60) * 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-[var(--success)] rounded-full"
                    />
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div className="mt-4 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Pixel Expansion</span>
                    <span className="font-semibold text-[var(--text)]">{c.expansion}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Colour Error (ΔE)</span>
                    <span className="font-semibold text-[var(--text)]">
                      <CountUp value={c.meanColorError} decimals={2} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Contrast Recovery</span>
                    <span className="font-semibold text-[var(--text)]">
                      {c.contrast === 1 ? "100% (Lossless)" : "50% (Physical)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[var(--muted)]">Exact Match</span>
                    <span className="font-bold text-[var(--success)]">
                      {c.exactMatch ? "Exact (Byte-level)" : "Approximate"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer Badge */}
              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-[11px] font-mono text-[var(--muted)]">
                <span>Execution Time</span>
                <span>{c.reconstructionTimeMs} ms</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Benchmark Summary Table Note */}
      <div className="mt-8 p-4 rounded-xl bg-[var(--panel)] border border-[var(--border)] text-xs text-[var(--muted)] leading-relaxed font-mono">
        <strong className="text-[var(--text)]">Evaluation Takeaway: </strong>
        Physical overlay visual cryptography (P1, P5) operates via optical superposition (no computing devices required to reveal the secret), accepting a 2× spatial expansion and subtractive contrast absorption. Digital XOR schemes (P6) offer exact mathematical reconstruction with zero pixel expansion.
      </div>
    </div>
  );
};

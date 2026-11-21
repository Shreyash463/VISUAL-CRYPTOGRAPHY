import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Layers,
  Shuffle,
  Download,
  Eye,
  CheckCircle2,
  Sliders,
  FolderArchive,
  RefreshCw,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  prepareImageRgba,
  detectImageIsColor,
  generateSharesOnDevice,
  QualityPreset,
  PRESET_DIMS,
} from "../engine/workerClient";
import { generateProceduralDemoImage } from "../engine/proceduralSample";
import { encodeRgbaToPng } from "../engine/pngChunk";
import { ImageFrame } from "../components/ImageFrame";
import { StackingSimulator } from "../components/StackingSimulator";
import { zipSync } from "fflate";

export const GeneratePage: React.FC = () => {
  const navigate = useNavigate();
  const { isWiping, setActiveRun, trackBlobUrl } = useApp();

  // Wizard state: 1 (Upload), 2 (Scheme), 3 (Results)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Input image state
  const [inputBlob, setInputBlob] = useState<Blob | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [isColorDetected, setIsColorDetected] = useState<boolean>(true);
  const [colorModeOverride, setColorModeOverride] = useState<"auto" | "force_bw">("auto");
  const [inputDims, setInputDims] = useState<{ width: number; height: number } | null>(null);

  // Reset local state when session is wiped via Esc or Wipe button
  useEffect(() => {
    if (isWiping) {
      setInputBlob(null);
      setInputUrl(null);
      setInputDims(null);
      setShareUrls([]);
      setRawStackUrl(null);
      setEnhancedRevealUrl(null);
      setLatestResult(null);
      setStep(1);
    }
  }, [isWiping]);

  // Step 2: Scheme and configuration
  const [scheme, setScheme] = useState<"color_overlay" | "color_xor" | "overlay" | "xor">("color_overlay");
  const [nShares, setNShares] = useState<number>(2);
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>("high");

  // Step 3: Engine execution & Results
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("Initializing...");
  const [progressPercent, setProgressPercent] = useState(0);

  const [activeResultTab, setActiveResultTab] = useState<"shares" | "reveal" | "overlay" | "metrics">("shares");
  const [revealMode, setRevealMode] = useState<"enhanced" | "raw">("enhanced");

  // Output URLs
  const [shareUrls, setShareUrls] = useState<Array<{ index: number; url: string; filename: string; width: number; height: number; bytes: Uint8Array }>>([]);
  const [rawStackUrl, setRawStackUrl] = useState<string | null>(null);
  const [enhancedRevealUrl, setEnhancedRevealUrl] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // When color is detected and user has not forced B/W, default to colour scheme
  useEffect(() => {
    if (colorModeOverride === "force_bw") {
      setScheme("overlay");
    } else if (isColorDetected) {
      setScheme("color_overlay");
    }
  }, [isColorDetected, colorModeOverride]);

  // Load an image into Step 1
  const processLoadedImage = async (blob: Blob) => {
    const previewUrl = URL.createObjectURL(blob);
    setInputBlob(blob);
    setInputUrl(trackBlobUrl(previewUrl));

    // Inspect color
    try {
      const { rgba, width, height } = await prepareImageRgba(blob, PRESET_DIMS[qualityPreset]);
      const isColor = detectImageIsColor(rgba);
      setIsColorDetected(isColor);
      setInputDims({ width, height });
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processLoadedImage(e.target.files[0]);
    }
  };

  const handleUseDemo = () => {
    const rawRgba = generateProceduralDemoImage(320, 320);
    const pngBytes = encodeRgbaToPng(320, 320, rawRgba, { vc_kind: "demo" });
    const blob = new Blob([pngBytes.buffer as ArrayBuffer], { type: "image/png" });
    processLoadedImage(blob);
  };

  // Execute on-device generation
  const handleGenerate = async () => {
    if (!inputBlob) return;
    setIsProcessing(true);
    setProgressPercent(10);
    setProgressMsg("Preparing image on device...");

    try {
      const { rgba, width, height } = await prepareImageRgba(inputBlob, PRESET_DIMS[qualityPreset]);

      const result = await generateSharesOnDevice(
        rgba,
        width,
        height,
        scheme,
        nShares,
        qualityPreset,
        128,
        undefined,
        (percent, message) => {
          setProgressPercent(percent);
          setProgressMsg(message);
        }
      );

      // Create Object URLs for shares
      const items = result.shares.map((s) => {
        const blob = new Blob([s.pngBytes.buffer as ArrayBuffer], { type: "image/png" });
        return {
          index: s.index,
          url: trackBlobUrl(URL.createObjectURL(blob)),
          filename: s.filename,
          width: s.width,
          height: s.height,
          bytes: s.pngBytes,
        };
      });
      setShareUrls(items);

      // Create URLs for reconstructions
      const rawBlob = new Blob([result.reconstruction.rawPngBytes.buffer as ArrayBuffer], { type: "image/png" });
      setRawStackUrl(trackBlobUrl(URL.createObjectURL(rawBlob)));

      if (result.reconstruction.enhancedPngBytes) {
        const enhBlob = new Blob([result.reconstruction.enhancedPngBytes.buffer as ArrayBuffer], { type: "image/png" });
        setEnhancedRevealUrl(trackBlobUrl(URL.createObjectURL(enhBlob)));
      } else {
        setEnhancedRevealUrl(null);
      }

      setLatestResult(result);
      setActiveRun(result);
      setStep(3);
    } catch (err) {
      console.error(err);
      alert("Generation failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsProcessing(false);
    }
  };

  // ZIP Download action using fflate
  const handleDownloadZip = () => {
    if (!latestResult) return;
    const filesToZip: Record<string, Uint8Array> = {};

    // Add all shares
    latestResult.shares.forEach((s: any) => {
      filesToZip[s.filename] = s.pngBytes;
    });

    // Add reconstruction
    filesToZip[latestResult.reconstruction.filename] =
      latestResult.reconstruction.enhancedPngBytes || latestResult.reconstruction.rawPngBytes;

    // Add manifest
    const manifest = {
      project: "VeilShare Visual Cryptography Studio",
      review: "SSPU Final Review",
      scheme,
      n: nShares,
      groupId: latestResult.groupId,
      metrics: latestResult.metrics,
      timestamp: new Date().toISOString(),
    };
    filesToZip["manifest.json"] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

    const zipped = zipSync(filesToZip);
    const blob = new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veilshare-${scheme}-${latestResult.groupId}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Step Header Indicator */}
      <div className="mb-6 flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text)]">Generate Visual Shares</h1>
          <p className="text-sm text-[var(--muted)]">
            Step {step} of 3 · {step === 1 ? "Upload Secret Image" : step === 2 ? "Select Cryptographic Scheme" : "Noise Shares & Stacking"}
          </p>
        </div>

        {/* Wizard Step Pills */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                step === s
                  ? "bg-[var(--accent)] text-white shadow-md scale-105"
                  : step > s
                  ? "bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]"
                  : "bg-[var(--panel-alt)] text-[var(--muted)] border border-[var(--border)]"
              }`}
            >
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Main Wizard Stages (All fit 1366x768 without scrolling) */}
      <div className="flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* STEP 1: UPLOAD */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-2 gap-6 items-center"
            >
              {/* Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    processLoadedImage(e.dataTransfer.files[0]);
                  }
                }}
                className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-2xl p-8 bg-[var(--panel)]/60 hover:bg-[var(--panel-alt)] transition-all cursor-pointer min-h-[300px] text-center group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="gen-file-input"
                />
                <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <h2 className="font-display font-bold text-base text-[var(--text)]">
                  Drop secret image here, or browse
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1.5 max-w-xs">
                  PNG, JPG, WebP, or BMP. Executed 100% on-device in Web Worker.
                </p>

                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseDemo();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--panel-alt)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Use Colorful Demo Image</span>
                  </button>
                </div>
              </div>

              {/* Preview & Detection Badge */}
              <div className="flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--border)] p-6 min-h-[300px] justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-[var(--text)] mb-3">
                    Secret Image Preview
                  </h3>
                  {inputUrl ? (
                    <div className="relative rounded-xl overflow-hidden bg-black/40 border border-[var(--border)] flex items-center justify-center p-2 max-h-[200px]">
                      <img src={inputUrl} alt="Secret Preview" className="max-h-[180px] w-auto object-contain rounded" />
                    </div>
                  ) : (
                    <div className="h-[180px] rounded-xl border border-dashed border-[var(--border)] flex flex-col items-center justify-center text-[var(--muted)] text-xs text-center p-4">
                      <span>No image selected yet. Upload an image or click "Use Colorful Demo Image".</span>
                    </div>
                  )}
                </div>

                {inputUrl && (
                  <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30">
                        {isColorDetected ? "Colour Detected" : "Greyscale Image"}
                      </span>
                      {inputDims && (
                        <span className="text-xs font-mono text-[var(--muted)]">
                          {inputDims.width} × {inputDims.height} px
                        </span>
                      )}
                    </div>

                    {/* Keep Colour vs Force B/W Switch */}
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setColorModeOverride("auto")}
                        className={`px-2 py-1 rounded font-semibold transition-colors ${
                          colorModeOverride === "auto" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
                        }`}
                      >
                        Keep Colour
                      </button>
                      <button
                        type="button"
                        onClick={() => setColorModeOverride("force_bw")}
                        className={`px-2 py-1 rounded font-semibold transition-colors ${
                          colorModeOverride === "force_bw" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
                        }`}
                      >
                        Force B/W
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 2: SCHEME SELECTION */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              {/* 4 Scheme Cards: Exactly ONE Selected */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    id: "color_overlay" as const,
                    name: "Colour Overlay 2-of-2",
                    paper: "P5 · Hou 2003",
                    desc: "CMY subtractive error diffusion with 2×2 subpixel expansion. Stacking physical transparencies subtracts light.",
                    isColor: true,
                    isOverlay: true,
                  },
                  {
                    id: "color_xor" as const,
                    name: "Colour XOR (n, n) Exact",
                    paper: "P6 · Wang et al. 2005",
                    desc: "24-bit RGB bitwise XOR secret sharing across n shares. 0× pixel expansion, lossless mathematical reconstruction.",
                    isColor: true,
                    isOverlay: false,
                  },
                  {
                    id: "overlay" as const,
                    name: "B/W Overlay 2-of-2",
                    paper: "P1 · Naor & Shamir 1994",
                    desc: "Classical binary 2×2 visual cryptography. Stacked transparencies visually reveal the secret without computation.",
                    isColor: false,
                    isOverlay: true,
                  },
                  {
                    id: "xor" as const,
                    name: "B/W XOR (n, n)",
                    paper: "P6 · Wang et al.",
                    desc: "1-bit binary XOR secret sharing with zero pixel expansion and 100% mathematical fidelity.",
                    isColor: false,
                    isOverlay: false,
                  },
                ].map((sc) => {
                  const isSelected = scheme === sc.id;
                  return (
                    <div
                      key={sc.id}
                      onClick={() => setScheme(sc.id)}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") setScheme(sc.id);
                      }}
                      className={`relative flex flex-col p-5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[var(--panel)] border-[var(--accent)] ring-2 ring-[var(--accent)]/30 shadow-lg"
                          : "bg-[var(--panel)]/50 border-[var(--border)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-display font-bold text-sm text-[var(--text)]">{sc.name}</span>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--accent)] text-white">
                            Selected
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-[var(--accent)] mb-2">{sc.paper}</span>
                      <p className="text-xs text-[var(--muted)] leading-relaxed flex-1">{sc.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Step 2 Additional Configuration: Shares (n) & Preset */}
              <div className="grid sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)]">
                {/* Total Shares n */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1.5">
                    Access Structure Share Count (n)
                  </label>
                  {scheme === "color_overlay" || scheme === "overlay" ? (
                    <div className="text-xs font-mono text-[var(--muted)] p-2.5 rounded-lg bg-[var(--panel-alt)] border border-[var(--border)]">
                      Fixed at 2 shares (Physical transparency superposition access structure)
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={nShares}
                        onChange={(e) => setNShares(parseInt(e.target.value, 10))}
                        id="xor-n-select"
                        className="w-full text-xs font-mono p-2 rounded-lg bg-[var(--panel-alt)] border border-[var(--border)] text-[var(--text)] focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        {[2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            {n} shares (Requires all {n} shares to reconstruct)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Quality Preset */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1.5">
                    Quality Resolution Preset
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["standard", "high", "ultra"] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQualityPreset(q)}
                        className={`p-2 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer border ${
                          qualityPreset === q
                            ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                            : "bg-[var(--panel-alt)] text-[var(--muted)] border-[var(--border)]"
                        }`}
                      >
                        {q} ({PRESET_DIMS[q]}px)
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: RESULTS STAGE (Problem 1 Fix: 2 LARGE SHARES SHOWN BIG WITH DOWNLOAD BUTTONS) */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              {/* Inner Tab Pill: Shares (Noise) | Reveal | Live Overlay | Metrics */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveResultTab("shares")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeResultTab === "shares" ? "bg-[var(--accent)] text-white shadow-xs" : "bg-[var(--panel-alt)] text-[var(--muted)]"
                    }`}
                  >
                    Visual Shares ({shareUrls.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveResultTab("reveal")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeResultTab === "reveal" ? "bg-[var(--accent)] text-white shadow-xs" : "bg-[var(--panel-alt)] text-[var(--muted)]"
                    }`}
                  >
                    Reconstruction Reveal
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveResultTab("overlay")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeResultTab === "overlay" ? "bg-[var(--accent)] text-white shadow-xs" : "bg-[var(--panel-alt)] text-[var(--muted)]"
                    }`}
                  >
                    Live Superposition
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveResultTab("metrics")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeResultTab === "metrics" ? "bg-[var(--accent)] text-white shadow-xs" : "bg-[var(--panel-alt)] text-[var(--muted)]"
                    }`}
                  >
                    Fidelity Metrics
                  </button>
                </div>

                {/* Top Action Bar: Regenerate, ZIP, Send to Reconstruct */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    title="Regenerate with new randomness"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--panel-alt)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Regenerate</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--panel-alt)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] transition-colors cursor-pointer"
                  >
                    <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
                    <span>Download All (ZIP)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/studio/reconstruct")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-soft)] border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Send to Reconstruct</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tab 1: SHARES (Shown Big with Individual Download Buttons) */}
              {activeResultTab === "shares" && (
                <div className={`grid gap-5 ${shareUrls.length === 2 ? "sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
                  {shareUrls.map((s) => (
                    <ImageFrame
                      key={s.index}
                      title={`Noise Share ${s.index} of ${shareUrls.length}`}
                      subtitle="Uncorrelated noise · zero secret information"
                      badge={`Share ${s.index}`}
                      imgUrl={s.url}
                      filename={s.filename}
                      width={s.width}
                      height={s.height}
                      pngBytes={s.bytes}
                      downloadLabel="Download Share PNG"
                    />
                  ))}
                </div>
              )}

              {/* Tab 2: REVEAL (Problem 2 Fix: Full-Colour Resolution) */}
              {activeResultTab === "reveal" && (
                <div className="grid md:grid-cols-2 gap-5 items-center">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-bold text-base text-[var(--text)]">Reconstructed Secret</h3>
                      {scheme === "color_overlay" && (
                        <div className="flex items-center gap-1 text-xs">
                          <button
                            type="button"
                            onClick={() => setRevealMode("enhanced")}
                            className={`px-2.5 py-1 rounded font-semibold ${
                              revealMode === "enhanced" ? "bg-[var(--accent)] text-white" : "bg-[var(--panel-alt)] text-[var(--muted)]"
                            }`}
                          >
                            Colour Recovery
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevealMode("raw")}
                            className={`px-2.5 py-1 rounded font-semibold ${
                              revealMode === "raw" ? "bg-[var(--accent)] text-white" : "bg-[var(--panel-alt)] text-[var(--muted)]"
                            }`}
                          >
                            Raw Stack
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-[var(--muted)] leading-relaxed">
                      {scheme === "color_overlay"
                        ? "Subtractive transparency overlay simulation. Raw Stack demonstrates physical light absorption; Colour Recovery extracts continuous full-colour RGB gamut."
                        : "Bitwise mathematical XOR reconstruction. 100% byte-for-byte exact fidelity with zero pixel expansion."}
                    </p>

                    {latestResult && (
                      <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--border)] text-xs font-mono space-y-1">
                        <div>Scheme: <span className="text-[var(--accent)]">{scheme}</span></div>
                        <div>Fidelity: <span className="text-[var(--success)]">{latestResult.metrics.exactMatch ? "Lossless 100% Exact" : `PSNR ${latestResult.metrics.psnr} dB`}</span></div>
                        <div>Resolution: <span className="text-[var(--text)]">{latestResult.reconstruction.width} × {latestResult.reconstruction.height} px</span></div>
                      </div>
                    )}
                  </div>

                  <ImageFrame
                    title="Reconstructed Secret"
                    subtitle="Result of stacking all visual shares"
                    badge="Reveal"
                    imgUrl={revealMode === "enhanced" && enhancedRevealUrl ? enhancedRevealUrl : rawStackUrl || ""}
                    filename={latestResult?.reconstruction?.filename || "veilshare-reveal.png"}
                    width={latestResult?.reconstruction?.width || 0}
                    height={latestResult?.reconstruction?.height || 0}
                    downloadLabel="Download Reveal PNG"
                  />
                </div>
              )}

              {/* Tab 3: LIVE OVERLAY (Problem 5 Fix: Zero black boxes, smooth multiply drag) */}
              {activeResultTab === "overlay" && shareUrls.length >= 2 && (
                <StackingSimulator
                  share1Url={shareUrls[0].url}
                  share2Url={shareUrls[1].url}
                  width={shareUrls[0].width}
                  height={shareUrls[0].height}
                />
              )}

              {/* Tab 4: METRICS */}
              {activeResultTab === "metrics" && latestResult && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)]">
                    <span className="text-xs text-[var(--muted)] font-mono">Reconstruction PSNR</span>
                    <div className="text-2xl font-bold font-mono text-[var(--success)] mt-2">
                      {latestResult.metrics.psnr} dB
                    </div>
                    <span className="text-[11px] text-[var(--muted)] mt-1 block">Peak signal-to-noise ratio</span>
                  </div>

                  <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)]">
                    <span className="text-xs text-[var(--muted)] font-mono">Mean Color Error (ΔE)</span>
                    <div className="text-2xl font-bold font-mono text-[var(--text)] mt-2">
                      {latestResult.metrics.meanColorError}
                    </div>
                    <span className="text-[11px] text-[var(--muted)] mt-1 block">Average pixel channel divergence</span>
                  </div>

                  <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)]">
                    <span className="text-xs text-[var(--muted)] font-mono">Pixel Expansion</span>
                    <div className="text-2xl font-bold font-mono text-[var(--accent)] mt-2">
                      {latestResult.metrics.pixelExpansion}
                    </div>
                    <span className="text-[11px] text-[var(--muted)] mt-1 block">Subpixel expansion factor</span>
                  </div>

                  <div className="p-5 rounded-2xl bg-[var(--panel)] border border-[var(--border)]">
                    <span className="text-xs text-[var(--muted)] font-mono">Exact Match</span>
                    <div className="text-2xl font-bold font-mono text-[var(--success)] mt-2">
                      {latestResult.metrics.exactMatch ? "YES (100%)" : "NO (Approximate)"}
                    </div>
                    <span className="text-[11px] text-[var(--muted)] mt-1 block">Bitwise mathematical equality</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky Bottom Action Bar (Problem 4 Fix: Always in viewport, Enter key works) */}
      <div className="sticky bottom-0 z-30 pt-4 pb-2 bg-[var(--bg)]/95 backdrop-blur-md border-t border-[var(--border)] flex items-center justify-between gap-4">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as any)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          {step === 1 && (
            <button
              type="button"
              disabled={!inputBlob}
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <span>Next: Choose Scheme</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{progressMsg} ({progressPercent}%)</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Split Secret Into Shares</span>
                </>
              )}
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={() => {
                setActiveResultTab("reveal");
              }}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-md"
            >
              <Eye className="w-4 h-4" />
              <span>Stack to Reveal</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

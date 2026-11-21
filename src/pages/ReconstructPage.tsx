import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Download,
  Shuffle,
  RefreshCw,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { parsePngMetadata } from "../engine/pngChunk";
import { reconstructSharesOnDevice } from "../engine/workerClient";
import { ImageFrame } from "../components/ImageFrame";

interface UploadedShareSlot {
  file: File;
  name: string;
  bytes: ArrayBuffer;
  rgba: Uint8Array;
  width: number;
  height: number;
  meta: Record<string, string>;
  url: string;
}

export const ReconstructPage: React.FC = () => {
  const { isWiping, activeRun, trackBlobUrl } = useApp();

  const [slotA, setSlotA] = useState<UploadedShareSlot | null>(null);
  const [slotB, setSlotB] = useState<UploadedShareSlot | null>(null);
  const [extraSlots, setExtraSlots] = useState<UploadedShareSlot[]>([]);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [scheme, setScheme] = useState<"color_overlay" | "color_xor" | "overlay" | "xor">("color_overlay");
  const [nShares, setNShares] = useState<number>(2);

  // Reset when session wiped via Esc
  useEffect(() => {
    if (isWiping) {
      setSlotA(null);
      setSlotB(null);
      setExtraSlots([]);
      setValidationError(null);
      setReconstructionResult(null);
    }
  }, [isWiping]);

  const [isReconstructing, setIsReconstructing] = useState(false);
  const [reconstructionResult, setReconstructionResult] = useState<{
    url: string;
    filename: string;
    width: number;
    height: number;
    sufficient: boolean;
  } | null>(null);

  // Helper to read file bytes and dimensions into RGBA
  const parseUploadedFile = async (file: File): Promise<UploadedShareSlot> => {
    const bytes = await file.arrayBuffer();
    const meta = parsePngMetadata(bytes);

    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not acquire 2D canvas context.");
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();

    const url = trackBlobUrl(URL.createObjectURL(file));

    return {
      file,
      name: file.name,
      bytes,
      rgba: new Uint8Array(imgData.data.buffer),
      width: canvas.width,
      height: canvas.height,
      meta,
      url,
    };
  };

  // Validate loaded slots whenever they change
  useEffect(() => {
    setValidationError(null);

    const slots = [slotA, slotB, ...extraSlots].filter(Boolean) as UploadedShareSlot[];
    if (slots.length === 0) return;

    // Validation 1: Wrong Kind (Reconstruction file dropped instead of share)
    for (const s of slots) {
      if (s.meta.vc_kind === "reconstruction") {
        setValidationError(
          `"${s.name}" is a reconstruction file, not a share. Please upload the two noise images (share-1 / share-2).`
        );
        return;
      }
    }

    // Validation 2: Same file twice
    if (slotA && slotB) {
      const b1 = new Uint8Array(slotA.bytes);
      const b2 = new Uint8Array(slotB.bytes);
      if (b1.length === b2.length) {
        let isIdentical = true;
        for (let i = 0; i < Math.min(b1.length, 1000); i++) {
          if (b1[i] !== b2[i]) {
            isIdentical = false;
            break;
          }
        }
        if (isIdentical) {
          setValidationError(
            "Both slots contain the exact same share file. Two distinct shares are required to reconstruct the secret."
          );
          return;
        }
      }
    }

    // Validation 3: Dimension Mismatch
    if (slotA && slotB) {
      if (slotA.width !== slotB.width || slotA.height !== slotB.height) {
        setValidationError(
          `Share dimensions mismatch (${slotA.width}×${slotA.height} vs ${slotB.width}×${slotB.height}). Shares must have matching dimensions.`
        );
        return;
      }
    }

    // Validation 4: Group Mismatch
    const groups = slots.map((s) => s.meta.vc_group).filter(Boolean);
    if (groups.length > 1 && new Set(groups).size > 1) {
      setValidationError(
        "These shares belong to different generation runs (group ID mismatch). Stacking them will result in uncorrelated noise."
      );
      return;
    }

    // Auto-detect scheme from slotA if metadata present
    if (slotA?.meta?.vc_scheme) {
      setScheme(slotA.meta.vc_scheme as any);
      if (slotA.meta.vc_n) {
        setNShares(parseInt(slotA.meta.vc_n, 10));
      }
    }
  }, [slotA, slotB, extraSlots]);

  // "Use shares from this session" one-click action
  const handleUseCurrentSessionShares = async () => {
    if (!activeRun || !activeRun.shares || activeRun.shares.length < 2) return;

    try {
      const s1 = activeRun.shares[0];
      const s2 = activeRun.shares[1];

      const f1 = new File([s1.pngBytes.buffer as ArrayBuffer], s1.filename, { type: "image/png" });
      const f2 = new File([s2.pngBytes.buffer as ArrayBuffer], s2.filename, { type: "image/png" });

      const parsed1 = await parseUploadedFile(f1);
      const parsed2 = await parseUploadedFile(f2);

      setSlotA(parsed1);
      setSlotB(parsed2);
      setScheme(activeRun.scheme as any);
      setNShares(activeRun.n);
    } catch (err) {
      console.error(err);
    }
  };

  // Perform reconstruction
  const handleReconstruct = async () => {
    const slots = [slotA, slotB, ...extraSlots].filter(Boolean) as UploadedShareSlot[];
    if (slots.length < 2) return;

    setIsReconstructing(true);
    try {
      const payloadFiles = slots.map((s) => ({
        name: s.name,
        bytes: s.bytes,
        rgba: s.rgba,
        width: s.width,
        height: s.height,
      }));

      const res = await reconstructSharesOnDevice(payloadFiles, scheme, nShares);

      const targetBytes = res.enhancedPngBytes || res.rawStackPngBytes;
      const blob = new Blob([targetBytes.buffer as ArrayBuffer], { type: "image/png" });
      const url = trackBlobUrl(URL.createObjectURL(blob));

      setReconstructionResult({
        url,
        filename: `veilshare-reconstructed-${scheme}.png`,
        width: res.width,
        height: res.height,
        sufficient: res.sufficient,
      });
    } catch (err) {
      console.error(err);
      setValidationError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsReconstructing(false);
    }
  };

  const isReady = slotA && slotB && !validationError;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      <div>
        {/* Header with Session Share Reuse Chip */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-[var(--text)]">Reconstruct Secret</h1>
            <p className="text-sm text-[var(--muted)]">
              Upload two or more noise shares to reveal the hidden secret on-device.
            </p>
          </div>

          {/* "Use shares from this session" chip */}
          {activeRun && activeRun.shares && activeRun.shares.length >= 2 && (
            <button
              type="button"
              onClick={handleUseCurrentSessionShares}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--accent-soft)] border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Use shares from this session ({activeRun.shares.length} shares)</span>
            </button>
          )}
        </div>

        {/* Validation Warning Banner */}
        <AnimatePresence>
          {validationError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong className="font-bold">Input Validation Notice: </strong>
                {validationError}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drop Zones (Share A & Share B) */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Drop Zone A */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const parsed = await parseUploadedFile(e.dataTransfer.files[0]);
                setSlotA(parsed);
              }
            }}
            className="flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--border)] overflow-hidden shadow-sm"
          >
            <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--panel-alt)]/50 flex items-center justify-between">
              <span className="font-display font-bold text-xs text-[var(--text)]">Share Slot 1 (A)</span>
              {slotA && (
                <span className="text-[10px] font-mono text-[var(--success)] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}
            </div>

            <div className="p-4 flex flex-col items-center justify-center min-h-[200px]">
              {slotA ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={slotA.url}
                    alt="Slot A preview"
                    className="max-h-[140px] w-auto object-contain rounded border border-[var(--border)]"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <span className="text-xs font-mono text-[var(--text)]">{slotA.name}</span>
                  <span className="text-[11px] font-mono text-[var(--muted)]">{slotA.width} × {slotA.height} px</span>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center cursor-pointer p-6 border-2 border-dashed border-[var(--border)] rounded-xl w-full text-center hover:border-[var(--accent)] transition-colors">
                  <input
                    type="file"
                    accept=".png"
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const parsed = await parseUploadedFile(e.target.files[0]);
                        setSlotA(parsed);
                      }
                    }}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-[var(--muted)] mb-2" />
                  <span className="text-xs font-semibold text-[var(--text)]">Drop Share 1 PNG</span>
                  <span className="text-[10px] text-[var(--muted)] mt-1">or click to browse</span>
                </label>
              )}
            </div>
          </div>

          {/* Drop Zone B */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const parsed = await parseUploadedFile(e.dataTransfer.files[0]);
                setSlotB(parsed);
              }
            }}
            className="flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--border)] overflow-hidden shadow-sm"
          >
            <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--panel-alt)]/50 flex items-center justify-between">
              <span className="font-display font-bold text-xs text-[var(--text)]">Share Slot 2 (B)</span>
              {slotB && (
                <span className="text-[10px] font-mono text-[var(--success)] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}
            </div>

            <div className="p-4 flex flex-col items-center justify-center min-h-[200px]">
              {slotB ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={slotB.url}
                    alt="Slot B preview"
                    className="max-h-[140px] w-auto object-contain rounded border border-[var(--border)]"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <span className="text-xs font-mono text-[var(--text)]">{slotB.name}</span>
                  <span className="text-[11px] font-mono text-[var(--muted)]">{slotB.width} × {slotB.height} px</span>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center cursor-pointer p-6 border-2 border-dashed border-[var(--border)] rounded-xl w-full text-center hover:border-[var(--accent)] transition-colors">
                  <input
                    type="file"
                    accept=".png"
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const parsed = await parseUploadedFile(e.target.files[0]);
                        setSlotB(parsed);
                      }
                    }}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-[var(--muted)] mb-2" />
                  <span className="text-xs font-semibold text-[var(--text)]">Drop Share 2 PNG</span>
                  <span className="text-[10px] text-[var(--muted)] mt-1">or click to browse</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Reconstruction Result Output */}
        {reconstructionResult && (
          <div className="mt-8 pt-6 border-t border-[var(--border)]">
            <h3 className="font-display font-bold text-lg text-[var(--text)] mb-4">Reconstructed Secret</h3>
            <div className="max-w-lg mx-auto">
              <ImageFrame
                title="Decrypted Secret Image"
                subtitle="Reconstructed on-device via visual superposition"
                badge="Revealed"
                imgUrl={reconstructionResult.url}
                filename={reconstructionResult.filename}
                width={reconstructionResult.width}
                height={reconstructionResult.height}
                downloadLabel="Download Revealed Secret"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Reconstruct Action */}
      <div className="sticky bottom-0 z-30 pt-4 pb-2 bg-[var(--bg)]/95 backdrop-blur-md border-t border-[var(--border)] flex items-center justify-between gap-4 mt-6">
        <div className="text-xs font-mono text-[var(--muted)]">
          {scheme === "color_overlay" ? "Colour Overlay (P5 CMY)" : scheme === "color_xor" ? "Colour XOR (P6 Exact)" : scheme}
        </div>

        <button
          type="button"
          disabled={!isReady || isReconstructing}
          onClick={handleReconstruct}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isReconstructing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Reconstructing...</span>
            </>
          ) : (
            <>
              <Layers className="w-4 h-4" />
              <span>Reveal Secret</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

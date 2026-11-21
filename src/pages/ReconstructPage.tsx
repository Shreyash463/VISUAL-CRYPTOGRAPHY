import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Download,
  RefreshCw,
  Plus,
  Trash2,
  ShieldAlert,
  Info,
  X,
  FileCheck,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { parsePngMetadata } from "../engine/pngChunk";
import { reconstructSharesOnDevice } from "../engine/workerClient";
import { ImageFrame } from "../components/ImageFrame";

interface UploadedShareSlot {
  file?: File;
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

  // Target number of shares (2 to 6)
  const [targetN, setTargetN] = useState<number>(2);
  // Array of slots of length targetN
  const [slots, setSlots] = useState<Array<UploadedShareSlot | null>>([null, null]);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [scheme, setScheme] = useState<"color_overlay" | "color_xor" | "overlay" | "xor">("color_overlay");

  const [isReconstructing, setIsReconstructing] = useState(false);
  const [reconstructionResult, setReconstructionResult] = useState<{
    url: string;
    filename: string;
    width: number;
    height: number;
    sufficient: boolean;
    isSecurityDemo?: boolean;
    sharesUsed: number;
    sharesRequired: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync slots array length with targetN
  useEffect(() => {
    setSlots((prev) => {
      if (prev.length === targetN) return prev;
      if (prev.length < targetN) {
        return [...prev, ...Array(targetN - prev.length).fill(null)];
      }
      return prev.slice(0, targetN);
    });
  }, [targetN]);

  // Reset when session wiped via Esc
  useEffect(() => {
    if (isWiping) {
      setSlots(Array(targetN).fill(null));
      setValidationError(null);
      setInfoNotice(null);
      setReconstructionResult(null);
    }
  }, [isWiping, targetN]);

  // Parse uploaded File object into RGBA, dimensions, and metadata
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

  // Helper to test if two slots have identical byte content
  const areBytesIdentical = (b1Buf: ArrayBuffer, b2Buf: ArrayBuffer): boolean => {
    const b1 = new Uint8Array(b1Buf);
    const b2 = new Uint8Array(b2Buf);
    if (b1.length !== b2.length) return false;
    const sampleLen = Math.min(b1.length, 2048);
    for (let i = 0; i < sampleLen; i++) {
      if (b1[i] !== b2[i]) return false;
    }
    return true;
  };

  // Process a batch of files (from drop zone or multi-file picker)
  const handleBatchFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setValidationError(null);
    setInfoNotice(null);

    const parsedList: UploadedShareSlot[] = [];
    const notes: string[] = [];

    for (const f of files) {
      try {
        const parsed = await parseUploadedFile(f);

        // Check 1: Wrong kind (e.g. reconstruction file dropped)
        if (parsed.meta.vc_kind === "reconstruction") {
          setValidationError(
            `"${f.name}" is a reconstruction result file, not a noise share. Please upload noise shares (e.g. share-1.png, share-2.png).`
          );
          continue;
        }

        parsedList.push(parsed);
      } catch (err) {
        console.error("Error reading file", f.name, err);
      }
    }

    if (parsedList.length === 0) return;

    // Detect target N and scheme from first parsed file with metadata
    const metaWithN = parsedList.find((p) => p.meta.vc_n);
    let newTargetN = targetN;
    if (metaWithN && metaWithN.meta.vc_n) {
      const parsedN = parseInt(metaWithN.meta.vc_n, 10);
      if (parsedN >= 2 && parsedN <= 6) {
        newTargetN = parsedN;
        setTargetN(parsedN);
      }
    }
    if (metaWithN && metaWithN.meta.vc_scheme) {
      setScheme(metaWithN.meta.vc_scheme as any);
    }

    // Auto-assign into slots
    setSlots((prevSlots) => {
      // Ensure current working array has length at least newTargetN
      let updated: Array<UploadedShareSlot | null> = [...prevSlots];
      if (updated.length < newTargetN) {
        updated = [...updated, ...Array(newTargetN - updated.length).fill(null)];
      }

      for (const item of parsedList) {
        // Check if duplicate of already loaded share in updated
        const isDup = updated.some((s) => s && areBytesIdentical(s.bytes, item.bytes));
        if (isDup) {
          notes.push(`Share "${item.name}" is already loaded (duplicate ignored).`);
          continue;
        }

        let assigned = false;
        // If file metadata specifies vc_index (1-based)
        if (item.meta.vc_index) {
          const idx = parseInt(item.meta.vc_index, 10) - 1;
          if (idx >= 0 && idx < updated.length && !updated[idx]) {
            updated[idx] = item;
            assigned = true;
          }
        }

        // If not assigned by index, place into first empty slot
        if (!assigned) {
          const firstEmpty = updated.findIndex((s) => s === null);
          if (firstEmpty !== -1) {
            updated[firstEmpty] = item;
            assigned = true;
          } else if (updated.length < 6) {
            // Can expand up to 6
            updated.push(item);
            setTargetN(updated.length);
            assigned = true;
          }
        }
      }

      return updated;
    });

    if (notes.length > 0) {
      setInfoNotice(notes.join(" "));
    }
  };

  // Validation check across currently loaded slots
  const loadedShares = useMemo(() => {
    return slots.filter(Boolean) as UploadedShareSlot[];
  }, [slots]);

  useEffect(() => {
    if (loadedShares.length === 0) {
      setValidationError(null);
      return;
    }

    // Check wrong kind
    for (const s of loadedShares) {
      if (s.meta.vc_kind === "reconstruction") {
        setValidationError(
          `"${s.name}" is a reconstruction file, not a visual share. Please upload noise shares.`
        );
        return;
      }
    }

    // Check dimensions mismatch
    const baseW = loadedShares[0].width;
    const baseH = loadedShares[0].height;
    for (let i = 1; i < loadedShares.length; i++) {
      if (loadedShares[i].width !== baseW || loadedShares[i].height !== baseH) {
        setValidationError(
          `Share dimensions mismatch (${baseW}×${baseH} vs ${loadedShares[i].width}×${loadedShares[i].height}). All shares must have identical dimensions.`
        );
        return;
      }
    }

    // Check group mismatch
    const groups = loadedShares.map((s) => s.meta.vc_group).filter(Boolean);
    if (groups.length > 1 && new Set(groups).size > 1) {
      setValidationError(
        "These shares belong to different generation runs (group ID mismatch). Stacking them will result in uncorrelated noise."
      );
      return;
    }

    // Auto-update scheme if first share has it
    if (loadedShares[0]?.meta?.vc_scheme) {
      setScheme(loadedShares[0].meta.vc_scheme as any);
    }
    if (loadedShares[0]?.meta?.vc_n) {
      const nFromMeta = parseInt(loadedShares[0].meta.vc_n, 10);
      if (nFromMeta >= 2 && nFromMeta <= 6 && nFromMeta !== targetN) {
        setTargetN(nFromMeta);
      }
    }
  }, [loadedShares, targetN]);

  // "Use shares from this session" loads ALL n shares
  const handleUseCurrentSessionShares = async () => {
    if (!activeRun || !activeRun.shares || activeRun.shares.length < 2) return;

    try {
      setValidationError(null);
      setInfoNotice(null);
      setReconstructionResult(null);

      const n = activeRun.shares.length;
      setTargetN(n);
      setScheme(activeRun.scheme as any);

      const newSlots: Array<UploadedShareSlot | null> = [];
      for (let i = 0; i < n; i++) {
        const s = activeRun.shares[i];
        const f = new File([s.pngBytes.buffer as ArrayBuffer], s.filename, { type: "image/png" });
        const parsed = await parseUploadedFile(f);
        newSlots.push(parsed);
      }
      setSlots(newSlots);
      setInfoNotice(`Loaded all ${n} shares from current studio session.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-populate when arriving with activeRun shares if slots are currently empty
  useEffect(() => {
    if (activeRun && activeRun.shares && activeRun.shares.length >= 2 && loadedShares.length === 0) {
      handleUseCurrentSessionShares();
    }
  }, [activeRun]);

  // Missing shares calculation
  const missingIndices: number[] = [];
  slots.forEach((s, idx) => {
    if (!s) missingIndices.push(idx + 1);
  });
  const loadedCount = loadedShares.length;
  const isAllLoaded = loadedCount === targetN && missingIndices.length === 0;

  // Single slot file handler
  const handleSlotUpload = async (slotIdx: number, file: File) => {
    try {
      const parsed = await parseUploadedFile(file);
      setSlots((prev) => {
        const next = [...prev];
        next[slotIdx] = parsed;
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Clear single slot
  const handleClearSlot = (slotIdx: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
    setReconstructionResult(null);
  };

  // Perform full reconstruction (requires ALL targetN shares)
  const handleReconstruct = async () => {
    if (!isAllLoaded || loadedCount < 2) return;

    setIsReconstructing(true);
    setValidationError(null);
    try {
      const payloadFiles = loadedShares.map((s) => ({
        name: s.name,
        bytes: s.bytes,
        rgba: s.rgba,
        width: s.width,
        height: s.height,
      }));

      const res = await reconstructSharesOnDevice(payloadFiles, scheme, targetN);
      const targetBytes = res.enhancedPngBytes || res.rawStackPngBytes;
      const blob = new Blob([targetBytes.buffer as ArrayBuffer], { type: "image/png" });
      const url = trackBlobUrl(URL.createObjectURL(blob));

      setReconstructionResult({
        url,
        filename: `veilshare-revealed-${scheme}-${targetN}shares.png`,
        width: res.width,
        height: res.height,
        sufficient: true,
        isSecurityDemo: false,
        sharesUsed: loadedCount,
        sharesRequired: targetN,
      });
    } catch (err) {
      console.error(err);
      setValidationError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsReconstructing(false);
    }
  };

  // Security demo: reveal with missing shares
  const handleSecurityDemo = async () => {
    if (loadedCount < 1) return;

    setIsReconstructing(true);
    setValidationError(null);
    try {
      const payloadFiles = loadedShares.map((s) => ({
        name: s.name,
        bytes: s.bytes,
        rgba: s.rgba,
        width: s.width,
        height: s.height,
      }));

      // Worker handles incomplete sets and returns raw noise stack
      const res = await reconstructSharesOnDevice(payloadFiles, scheme, targetN);
      const targetBytes = res.rawStackPngBytes;
      const blob = new Blob([targetBytes.buffer as ArrayBuffer], { type: "image/png" });
      const url = trackBlobUrl(URL.createObjectURL(blob));

      setReconstructionResult({
        url,
        filename: `veilshare-security-demo-${loadedCount}-of-${targetN}shares.png`,
        width: res.width,
        height: res.height,
        sufficient: false,
        isSecurityDemo: true,
        sharesUsed: loadedCount,
        sharesRequired: targetN,
      });
    } catch (err) {
      console.error(err);
      setValidationError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsReconstructing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      <div>
        {/* Header & Session Share Reuse */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-[var(--text)]">Reconstruct Secret</h1>
            <p className="text-sm text-[var(--muted)]">
              Multi-share on-device visual decryption. Supports 2 to 6 shares with automatic slot mapping.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Number of Shares Selector */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--panel-alt)] border border-[var(--border)] text-xs text-[var(--text)]">
              <span className="text-[var(--muted)]">Shares (n):</span>
              <select
                value={targetN}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setTargetN(val);
                  setReconstructionResult(null);
                }}
                className="bg-transparent font-bold text-[var(--accent)] font-mono outline-hidden cursor-pointer"
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n} className="bg-[var(--panel)] text-[var(--text)]">
                    {n} shares
                  </option>
                ))}
              </select>
            </div>

            {/* "Add another share" button */}
            {targetN < 6 && (
              <button
                type="button"
                onClick={() => setTargetN((n) => Math.min(6, n + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--panel-alt)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Slot ({targetN + 1})</span>
              </button>
            )}

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
        </div>

        {/* Multi-File Master Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleBatchFiles(e.dataTransfer.files);
            }
          }}
          className="mb-6 p-6 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--panel)]/40 hover:border-[var(--accent)] transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".png"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleBatchFiles(e.target.files);
              }
            }}
            className="hidden"
          />
          <div className="w-12 h-12 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] mb-3 group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="font-display font-bold text-sm text-[var(--text)] mb-1">
            Drop all {targetN} shares here, or click to browse multiple files
          </h3>
          <p className="text-xs text-[var(--muted)] max-w-md">
            Auto-detects share indexes (1 to {targetN}), verifies group IDs, and ignores duplicate uploads.
          </p>
        </div>

        {/* Progress & Missing Indicator Banner */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--panel-alt)]/60 border border-[var(--border)] text-xs">
          <div className="flex items-center gap-2">
            <div className="font-bold text-[var(--text)]">
              Progress: <span className="font-mono text-[var(--accent)]">{loadedCount}</span> of{" "}
              <span className="font-mono text-[var(--accent)]">{targetN}</span> shares loaded
            </div>
            {isAllLoaded ? (
              <span className="inline-flex items-center gap-1 text-[var(--success)] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> All shares ready
              </span>
            ) : (
              <span className="text-amber-400 font-medium">
                Need {missingIndices.length} more share{missingIndices.length > 1 ? "s" : ""}:{" "}
                <span className="font-mono font-bold">{missingIndices.join(", ")}</span>
              </span>
            )}
          </div>

          {/* Quick Clear All */}
          {loadedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setSlots(Array(targetN).fill(null));
                setReconstructionResult(null);
                setValidationError(null);
                setInfoNotice(null);
              }}
              className="text-xs text-[var(--muted)] hover:text-red-400 transition-colors cursor-pointer"
            >
              Clear all slots
            </button>
          )}
        </div>

        {/* Validation Error Banner */}
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

        {/* Info Notice Banner (e.g. Duplicates Ignored) */}
        <AnimatePresence>
          {infoNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 flex items-start gap-3"
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">{infoNotice}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Slot Grid */}
        <div
          className={`grid gap-4 ${
            targetN === 2
              ? "sm:grid-cols-2"
              : targetN === 3
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          } ${targetN >= 4 ? "max-h-[500px] overflow-y-auto pr-1" : ""}`}
        >
          {slots.map((slot, idx) => (
            <div
              key={idx}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleSlotUpload(idx, e.dataTransfer.files[0]);
                }
              }}
              className="flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--border)] overflow-hidden shadow-xs hover:border-[var(--border-strong)] transition-all"
            >
              {/* Slot Header */}
              <div className="px-3.5 py-2 border-b border-[var(--border)] bg-[var(--panel-alt)]/50 flex items-center justify-between">
                <span className="font-display font-bold text-xs text-[var(--text)]">
                  Share Slot {idx + 1} ({String.fromCharCode(65 + idx)})
                </span>
                {slot ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[var(--success)] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </span>
                    <button
                      type="button"
                      onClick={() => handleClearSlot(idx)}
                      title="Remove this share"
                      aria-label={`Remove share slot ${idx + 1}`}
                      className="text-[var(--muted)] hover:text-red-400 transition-colors p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-[var(--muted)]">Empty</span>
                )}
              </div>

              {/* Slot Content */}
              <div className="p-3 flex flex-col items-center justify-center min-h-[170px]">
                {slot ? (
                  <div className="flex flex-col items-center gap-1.5 w-full">
                    <div className="relative group/preview flex items-center justify-center p-2 bg-black/40 rounded-lg w-full max-h-[140px] overflow-hidden">
                      <img
                        src={slot.url}
                        alt={`Slot ${idx + 1} preview`}
                        className="max-h-[120px] w-auto max-w-full object-contain rounded select-none"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>
                    <span className="text-xs font-mono text-[var(--text)] truncate max-w-[200px]" title={slot.name}>
                      {slot.name}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--muted)]">
                      {slot.width} × {slot.height} px
                      {slot.meta.vc_index ? ` · Share #${slot.meta.vc_index}` : ""}
                    </span>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center cursor-pointer p-4 border border-dashed border-[var(--border)] rounded-xl w-full text-center hover:border-[var(--accent)] transition-colors">
                    <input
                      type="file"
                      accept=".png"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleSlotUpload(idx, e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    <Upload className="w-6 h-6 text-[var(--muted)] mb-1" />
                    <span className="text-xs font-semibold text-[var(--text)]">Drop Share {idx + 1}</span>
                    <span className="text-[10px] text-[var(--muted)]">or click to browse</span>
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Reconstruction Result Output */}
        {reconstructionResult && (
          <div className="mt-8 pt-6 border-t border-[var(--border)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-lg text-[var(--text)]">
                  {reconstructionResult.isSecurityDemo ? "Security Demonstration Result" : "Reconstructed Secret Image"}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {reconstructionResult.isSecurityDemo
                    ? "Incomplete set: this is random noise, exactly as the security property promises."
                    : "100% byte-exact lossless reconstruction verified on-device."}
                </p>
              </div>

              {reconstructionResult.isSecurityDemo && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Incomplete Set ({reconstructionResult.sharesUsed} of {reconstructionResult.sharesRequired} shares)
                </span>
              )}
            </div>

            <div className="max-w-md mx-auto">
              <ImageFrame
                title={
                  reconstructionResult.isSecurityDemo
                    ? `Noise Output (${reconstructionResult.sharesUsed} of ${reconstructionResult.sharesRequired} Shares)`
                    : "Revealed Secret Image"
                }
                subtitle={
                  reconstructionResult.isSecurityDemo
                    ? "Uncorrelated random noise · 0 bits revealed"
                    : "Reconstructed on-device via visual superposition"
                }
                badge={reconstructionResult.isSecurityDemo ? "Incomplete Set" : "Revealed"}
                imgUrl={reconstructionResult.url}
                filename={reconstructionResult.filename}
                width={reconstructionResult.width}
                height={reconstructionResult.height}
                downloadLabel={reconstructionResult.isSecurityDemo ? "Download Noise Stack" : "Download Revealed Secret"}
              />

              {reconstructionResult.isSecurityDemo && (
                <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed text-center">
                  <strong>Security Guarantee (Naor-Shamir &amp; Shannon):</strong> Any collection of fewer than{" "}
                  {reconstructionResult.sharesRequired} shares contains zero mutual information about the secret image.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Reconstruct Action Bar */}
      <div className="sticky bottom-0 z-30 pt-4 pb-2 bg-[var(--bg)]/95 backdrop-blur-md border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-4 mt-6">
        <div className="flex items-center gap-3 text-xs font-mono text-[var(--muted)]">
          <span className="font-semibold text-[var(--text)]">
            {scheme === "color_overlay"
              ? "Colour Overlay (P5 CMY)"
              : scheme === "color_xor"
              ? "Colour XOR (P6 Exact)"
              : scheme === "overlay"
              ? "B/W Overlay (P1)"
              : "B/W XOR (P6)"}
          </span>
          <span>•</span>
          <span>
            {loadedCount} / {targetN} shares
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Security Demo Button (visible when 1 <= loaded < targetN) */}
          {loadedCount >= 1 && loadedCount < targetN && (
            <button
              type="button"
              disabled={isReconstructing}
              onClick={handleSecurityDemo}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer shadow-xs"
              title="Demonstrate that fewer than n shares yield zero information"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Security demo: reveal with missing shares</span>
            </button>
          )}

          {/* Primary Reveal Secret Button */}
          <button
            type="button"
            disabled={!isAllLoaded || isReconstructing || Boolean(validationError)}
            onClick={handleReconstruct}
            title={
              !isAllLoaded
                ? `Need ${missingIndices.length} more share${missingIndices.length > 1 ? "s" : ""}: ${missingIndices.join(", ")}`
                : "Reconstruct secret from all shares"
            }
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
                <span>
                  {!isAllLoaded
                    ? `Need ${missingIndices.length} More Share${missingIndices.length > 1 ? "s" : ""}`
                    : "Reveal Secret"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

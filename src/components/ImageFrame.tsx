import React, { useState } from "react";
import { Download, Maximize2, X, Check } from "lucide-react";

export interface ImageFrameProps {
  title: string;
  subtitle?: string;
  imgUrl: string;
  filename: string;
  width: number;
  height: number;
  badge?: string;
  pngBytes?: Uint8Array;
  downloadLabel?: string;
  className?: string;
}

export const ImageFrame: React.FC<ImageFrameProps> = ({
  title,
  subtitle,
  imgUrl,
  filename,
  width,
  height,
  badge,
  pngBytes,
  downloadLabel = "Download PNG",
  className = "",
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleDownload = () => {
    const a = document.createElement("a");
    if (pngBytes) {
      const blob = new Blob([pngBytes.buffer as ArrayBuffer], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      a.href = imgUrl;
      a.download = filename;
      a.click();
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <>
      <div
        className={`flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--border)] overflow-hidden shadow-md transition-all hover:border-[var(--border-strong)] ${className}`}
      >
        {/* Card Header */}
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-2 bg-[var(--panel-alt)]/50">
          <div>
            <h3 className="font-display font-bold text-sm text-[var(--text)]">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--muted)] font-mono">{subtitle}</p>}
          </div>
          {badge && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30">
              {badge}
            </span>
          )}
        </div>

        {/* Image Display with Zoom capability */}
        <div className="relative group flex items-center justify-center p-4 bg-black/40 min-h-[220px] max-h-[340px] overflow-hidden">
          <img
            src={imgUrl}
            alt={title}
            className="max-h-[300px] w-auto max-w-full object-contain rounded select-none shadow-xs"
            style={{ imageRendering: "pixelated" }}
          />

          {/* Quick overlay actions */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-xs">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              aria-label={`Inspect ${title} full size`}
              className="p-2.5 rounded-full bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] hover:scale-110 transition-transform cursor-pointer shadow-lg"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              aria-label={`Download ${filename}`}
              className="p-2.5 rounded-full bg-[var(--accent)] text-white hover:scale-110 transition-transform cursor-pointer shadow-lg"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer Meta & Primary Download Action */}
        <div className="p-3 bg-[var(--panel-alt)]/30 border-t border-[var(--border)] flex items-center justify-between gap-3">
          <span className="text-[11px] font-mono text-[var(--muted)] truncate">
            {width} × {height} px
          </span>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-xs active:scale-95"
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            <span>{isCopied ? "Saved" : downloadLabel}</span>
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-red-400 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={imgUrl}
              alt={title}
              className="max-h-[80vh] w-auto object-contain rounded-xl border border-[var(--border)]"
              style={{ imageRendering: "pixelated" }}
            />
            <div className="mt-3 flex items-center gap-4 text-white text-xs font-mono">
              <span>{filename}</span>
              <span>•</span>
              <span>{width} × {height} px</span>
              <button
                type="button"
                onClick={handleDownload}
                className="px-3 py-1 bg-[var(--accent)] rounded font-semibold text-white ml-2 hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Move, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export interface StackingSimulatorProps {
  share1Url: string;
  share2Url: string;
  width: number;
  height: number;
  className?: string;
}

export const StackingSimulator: React.FC<StackingSimulatorProps> = ({
  share1Url,
  share2Url,
  width,
  height,
  className = "",
}) => {
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isAligned = offset.x === 0 && offset.y === 0;

  // Handle pointer drag
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: offset.x,
      initY: offset.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    let newX = Math.round(dragStartRef.current.initX + dx);
    let newY = Math.round(dragStartRef.current.initY + dy);

    // Magnetic snap within 6px of (0, 0)
    if (Math.abs(newX) < 6) newX = 0;
    if (Math.abs(newY) < 6) newY = 0;

    // Limit range to +/- 60px
    newX = Math.max(-60, Math.min(60, newX));
    newY = Math.max(-60, Math.min(60, newY));

    setOffset({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    dragStartRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -2;
    else if (e.key === "ArrowRight") dx = 2;
    else if (e.key === "ArrowUp") dy = -2;
    else if (e.key === "ArrowDown") dy = 2;
    else return;

    e.preventDefault();
    setOffset((prev) => {
      let nextX = prev.x + dx;
      let nextY = prev.y + dy;
      if (Math.abs(nextX) < 4) nextX = 0;
      if (Math.abs(nextY) < 4) nextY = 0;
      return {
        x: Math.max(-60, Math.min(60, nextX)),
        y: Math.max(-60, Math.min(60, nextY)),
      };
    });
  }, []);

  return (
    <div className={`flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--border)] overflow-hidden shadow-lg ${className}`}>
      {/* Simulator Control Header */}
      <div className="px-5 py-3 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--panel-alt)]/60">
        <div className="flex items-center gap-2">
          <Move className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="font-display font-bold text-sm text-[var(--text)]">
            Live Optical Superposition Simulator
          </h3>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {isAligned ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Aligned (0, 0) · Secret Revealed</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning)]/30">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>
                Offset: Δx={offset.x > 0 ? `+${offset.x}` : offset.x}px, Δy={offset.y > 0 ? `+${offset.y}` : offset.y}px
              </span>
            </span>
          )}

          {/* Quick Snap Controls */}
          <button
            type="button"
            onClick={() => setOffset({ x: 0, y: 0 })}
            className="px-2.5 py-1 rounded text-xs font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
          >
            Snap (0,0)
          </button>
          <button
            type="button"
            onClick={() => setOffset({ x: 14, y: 10 })}
            className="p-1 rounded text-xs bg-[var(--panel)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            title="Misalign layer (+14px, +10px)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Stacking Canvas / Container */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="relative flex items-center justify-center p-6 bg-black/60 min-h-[340px] max-h-[440px] overflow-hidden select-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      >
        <div
          className="relative max-w-full max-h-[320px] shadow-2xl rounded overflow-hidden"
          style={{
            aspectRatio: `${width} / ${height}`,
            width: "320px",
            height: "320px",
          }}
        >
          {/* Layer 1: Share 1 (Stationary Base) */}
          <img
            src={share1Url}
            alt="Base Share 1"
            className="absolute inset-0 w-full h-full object-fill pointer-events-none"
            style={{ imageRendering: "pixelated" }}
          />

          {/* Layer 2: Share 2 (Draggable with mix-blend-mode: multiply) */}
          <img
            src={share2Url}
            alt="Draggable Overlay Share 2"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`absolute inset-0 w-full h-full object-fill cursor-grab active:cursor-grabbing transition-transform duration-75 ${
              isDragging ? "ring-2 ring-[var(--accent)]" : ""
            }`}
            style={{
              mixBlendMode: "multiply",
              imageRendering: "pixelated",
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        </div>

        <div className="absolute bottom-2 left-4 text-[11px] font-mono text-[var(--muted)] bg-black/70 px-2 py-0.5 rounded backdrop-blur-xs">
          Drag overlay or use arrow keys · Magnetic snap at (0,0)
        </div>
      </div>
    </div>
  );
};

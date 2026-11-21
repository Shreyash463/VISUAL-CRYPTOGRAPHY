import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const CinematicIntro: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [phase, setPhase] = useState<"noise" | "curtain" | "done">("noise");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if intro has already played in this browser session
    const seen = sessionStorage.getItem("veilshare_intro_seen");
    // Check ?intro=0 query parameter (either in query or hash)
    const urlParams = new URLSearchParams(window.location.search);
    const hashQuery = window.location.hash.includes("?")
      ? new URLSearchParams(window.location.hash.split("?")[1])
      : null;
    const isIntroDisabled =
      urlParams.get("intro") === "0" || hashQuery?.get("intro") === "0";

    if (seen === "true" || isIntroDisabled) {
      sessionStorage.setItem("veilshare_intro_seen", "true");
      return;
    }

    // Prefers-reduced-motion: brief 200ms fade out
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        handleDismiss();
      }, 250);
      return () => clearTimeout(timer);
    }

    // Activate intro
    setIsVisible(true);

    // Schedule phase transitions
    // 0 - 1200ms: Noise field & logo convergence
    // 1200 - 1900ms: Curtain split
    // 1950ms: Complete and unmount
    const curtainTimer = setTimeout(() => {
      setPhase("curtain");
    }, 1200);

    const completeTimer = setTimeout(() => {
      handleDismiss();
    }, 2000);

    return () => {
      clearTimeout(curtainTimer);
      clearTimeout(completeTimer);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem("veilshare_intro_seen", "true");
    } catch {}
    setIsVisible(false);
    setPhase("done");
  };

  // Skip on any key press
  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      handleDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  // Noise animation on canvas
  useEffect(() => {
    if (!isVisible || phase === "done") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = Math.min(window.innerWidth, 800);
    canvas.height = Math.min(window.innerHeight, 600);

    let frame = 0;
    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;
      const len = w * h;

      // Generate randomized visual cryptography subpixel static
      for (let i = 0; i < len; i += 4) {
        const val = Math.random() > 0.5 ? 255 : 15;
        const idx = i * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 160;
      }
      ctx.putImageData(imgData, 0, 0);

      frame++;
      if (frame < 60 && phase !== "done") {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isVisible, phase]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-label="Cinematic VeilShare Presentation Intro"
        onClick={handleDismiss}
        className="fixed inset-0 z-50 overflow-hidden cursor-pointer select-none"
      >
        {/* Left Curtain */}
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: phase === "curtain" ? "-100%" : 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-y-0 left-0 w-1/2 bg-[#080B14] border-r border-[var(--border)] z-10 shadow-2xl"
        />

        {/* Right Curtain */}
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: phase === "curtain" ? "100%" : 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-y-0 right-0 w-1/2 bg-[#080B14] border-l border-[var(--border)] z-10 shadow-2xl"
        />

        {/* Center Content & Noise Canvas */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover opacity-25"
          />

          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{
              scale: phase === "curtain" ? 1.05 : 1,
              opacity: phase === "curtain" ? 0 : 1,
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative flex flex-col items-center text-center p-8 rounded-3xl bg-[#080B14]/80 backdrop-blur-md border border-[var(--border)] shadow-2xl"
          >
            {/* White Rounded Badge with Official SSPU Emblem */}
            <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center p-2 mb-4 border border-white/30">
              <img
                src="/sspu-logo.png"
                alt="SSPU Official Emblem"
                width={64}
                height={75}
                className="h-16 w-auto object-contain"
              />
            </div>

            <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
              VeilShare
            </h1>
            <p className="text-xs font-mono text-[var(--accent)] mt-1 tracking-wider uppercase">
              On-Device Visual Cryptography Studio
            </p>
            <p className="text-[11px] font-mono text-zinc-400 mt-2">
              Symbiosis Skills & Professional University · Final Review
            </p>
          </motion.div>

          {/* Skip pill */}
          <div className="absolute top-6 right-6 z-30">
            <span className="px-3 py-1.5 rounded-full text-[11px] font-mono bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition-colors shadow-sm">
              Click anywhere or press Esc to skip
            </span>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
};

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../context/AppContext";
import { fillCryptoRandomValues } from "../engine/cryptoRandom";

export const WipeOverlay: React.FC = () => {
  const { isWiping } = useApp();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isWiping) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let frame = 0;
    const drawNoise = () => {
      const imgData = ctx.createImageData(canvas.width, canvas.height);
      const data = imgData.data;
      const rand = new Uint8Array(canvas.width * canvas.height);
      fillCryptoRandomValues(rand);

      for (let i = 0; i < rand.length; i++) {
        const val = rand[i];
        const idx = i * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 200;
      }

      ctx.putImageData(imgData, 0, 0);
      frame++;
      if (frame < 12) {
        requestAnimationFrame(drawNoise);
      }
    };

    drawNoise();
  }, [isWiping]);

  return (
    <AnimatePresence>
      {isWiping && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0E1A]/90 backdrop-blur-md pointer-events-none"
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative z-10 text-center px-6 py-4 rounded-2xl bg-[#141B30] border border-[#2B3558] shadow-2xl"
          >
            <p className="font-display font-bold text-lg text-[#EAF0FF]">Memory Dissolved</p>
            <p className="text-sm text-[#8F9BB8] mt-1">
              Zero secret traces retained. Object URLs revoked & buffers wiped.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

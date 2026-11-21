import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Moon, Sun, Trash2 } from "lucide-react";
import { useApp } from "../context/AppContext";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { theme, toggleTheme, networkRequestsWithData, wipeSession } = useApp();

  const navItems = [
    { label: "Generate", path: "/studio/generate" },
    { label: "Reconstruct", path: "/studio/reconstruct" },
    { label: "Compare", path: "/studio/compare" },
    { label: "About", path: "/studio/about" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[var(--bg)]/90 border-b border-[var(--border)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <Link
          to="/"
          className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg p-1"
        >
          <div className="bg-white p-1 rounded-xl shadow-xs shrink-0 flex items-center justify-center border border-white/20">
            <img
              src="/sspu-logo.png"
              alt="SSPU Official Emblem"
              width={34}
              height={40}
              className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-lg tracking-tight text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              VeilShare
            </span>
            <span className="text-[11px] text-[var(--muted)] font-mono -mt-1 hidden sm:inline">
              SSPU Final Review
            </span>
          </div>
        </Link>

        {/* Studio Animated Tab Pill */}
        <nav aria-label="Studio Navigation" className="flex items-center gap-1 p-1 rounded-xl bg-[var(--panel-alt)] border border-[var(--border)]">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-none ${
                  isActive ? "text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabBadge"
                    className="absolute inset-0 rounded-lg bg-[var(--panel)] border border-[var(--border-strong)] shadow-xs"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Action Icons: Privacy counter, Theme Toggle, Wipe Session */}
        <div className="flex items-center gap-2">
          {/* Privacy Counter Badge */}
          <div
            title="Real-time network telemetry auditor: Proves zero secret image data leaves your browser."
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--panel-alt)] border border-[var(--border)] text-xs font-mono text-[var(--success)]"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
            <span>Data Sent: {networkRequestsWithData}</span>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle visual theme (Noise / Pastel)"
            className="p-2 rounded-lg bg-[var(--panel-alt)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            {theme === "noise" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          {/* Wipe Session (Esc) */}
          <button
            type="button"
            onClick={wipeSession}
            title="Wipe Session (Esc)"
            aria-label="Wipe all volatile images and shares from memory"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent)] text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent)] hover:text-white transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Wipe</span>
            <kbd className="hidden lg:inline-block px-1 py-0.2 text-[9px] font-mono rounded bg-black/20 border border-white/20">
              Esc
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
};

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { WorkerShareItem, WorkerGenerateResult } from "../engine/worker";
import { terminateWorker } from "../engine/workerClient";

export type ThemeMode = "noise" | "pastel";

export interface SessionShare {
  name: string;
  bytes: ArrayBuffer;
  rgba: Uint8Array;
  width: number;
  height: number;
  index: number;
  url: string;
}

export interface AppContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  networkRequestsWithData: number;
  activeRun: WorkerGenerateResult | null;
  setActiveRun: (run: WorkerGenerateResult | null) => void;
  sessionShares: SessionShare[];
  setSessionShares: (shares: SessionShare[]) => void;
  wipeSession: () => void;
  isWiping: boolean;
  trackBlobUrl: (url: string) => string;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem("veilshare_theme") as ThemeMode) || "noise";
  });
  const [networkRequestsWithData, setNetworkRequestsWithData] = useState(0);
  const [activeRun, setActiveRun] = useState<WorkerGenerateResult | null>(null);
  const [sessionShares, setSessionShares] = useState<SessionShare[]>([]);
  const [isWiping, setIsWiping] = useState(false);

  const trackedUrls = useRef<Set<string>>(new Set());

  const trackBlobUrl = useCallback((url: string): string => {
    trackedUrls.current.add(url);
    return url;
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "noise" ? "pastel" : "noise";
      localStorage.setItem("veilshare_theme", next);
      return next;
    });
  }, []);

  // Synchronize document theme class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "pastel") {
      root.classList.add("theme-pastel");
      root.classList.remove("theme-noise");
    } else {
      root.classList.add("theme-noise");
      root.classList.remove("theme-pastel");
    }
  }, [theme]);

  // Install Privacy Auditor (wraps fetch, XHR, sendBeacon to monitor any outgoing data)
  useEffect(() => {
    const origFetch = window.fetch;
    const origXHR = window.XMLHttpRequest.prototype.send;
    const origBeacon = navigator.sendBeacon;

    window.fetch = async (...args) => {
      const [input, init] = args;
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      const isStatic = url.endsWith(".png") || url.endsWith(".svg") || url.endsWith(".woff2") || url.endsWith(".js") || url.endsWith(".css") || url.includes("/assets/");
      if (init && init.body && !isStatic) {
        setNetworkRequestsWithData((c) => c + 1);
      }
      return origFetch.apply(window, args);
    };

    window.XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      if (body) {
        setNetworkRequestsWithData((c) => c + 1);
      }
      return origXHR.apply(this, arguments as any);
    };

    if (origBeacon) {
      navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null) {
        if (data) {
          setNetworkRequestsWithData((c) => c + 1);
        }
        return origBeacon.apply(navigator, [url, data]);
      };
    }

    return () => {
      window.fetch = origFetch;
      window.XMLHttpRequest.prototype.send = origXHR;
      if (origBeacon) navigator.sendBeacon = origBeacon;
    };
  }, []);

  // Wipe Session: triggered by Esc or Wipe button
  const wipeSession = useCallback(() => {
    setIsWiping(true);
    // Play sound / animation, revoke all tracked blob URLs, clear worker
    trackedUrls.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    });
    trackedUrls.current.clear();

    setActiveRun(null);
    setSessionShares([]);
    terminateWorker();

    setTimeout(() => {
      setIsWiping(false);
    }, 700);
  }, []);

  // Global Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        wipeSession();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [wipeSession]);

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        networkRequestsWithData,
        activeRun,
        setActiveRun,
        sessionShares,
        setSessionShares,
        wipeSession,
        isWiping,
        trackBlobUrl,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

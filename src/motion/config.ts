/**
 * VeilShare Motion Design Tokens & Curves.
 * Compliant with Section 7 of Master Prompt v3.
 */

export const VEIL_EASE = [0.22, 1, 0.36, 1] as const;
export const VEIL_EASE_CSS = "cubic-bezier(0.22, 1, 0.36, 1)";

export const DURATIONS = {
  fast: 0.16,  // 160ms
  base: 0.32,  // 320ms
  slow: 0.60,  // 600ms
} as const;

export const STAGGER = {
  fast: 0.04,  // 40ms
  base: 0.06,  // 60ms
} as const;

export const FADE_UP_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATIONS.base,
      ease: VEIL_EASE,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: DURATIONS.fast,
      ease: VEIL_EASE,
    },
  },
};

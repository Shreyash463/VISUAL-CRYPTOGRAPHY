/**
 * Stacking demo component for overlay mode (Naor & Shamir 1994, Hou 2003).
 * Provides interactive draggable transparency with mix-blend-mode: multiply and magnetic snap.
 */
import { el, createIcon } from "./ui.js";
import { checkPixelation } from "./viewer.js";

export function renderStackingDemo(share1B64, share2B64) {
  const container = el("div", { className: "card stacking-card" });

  const title = el("h3", { className: "card-title" }, "Optical Transparency Superposition");

  let offsetX = 32;
  let offsetY = 18;

  const readout = el(
    "div",
    { className: "offset-readout font-mono text-sm" },
    `Offset: x = +${offsetX} px, y = +${offsetY} px`
  );

  const alignBtn = el(
    "button",
    { type: "button", className: "btn btn-secondary btn-sm" },
    [createIcon("i-shuffle"), " Snap to Align"]
  );

  const jitterBtn = el(
    "button",
    { type: "button", className: "btn btn-secondary btn-sm" },
    [createIcon("i-sliders"), " Jitter Offset"]
  );

  const controlsRow = el("div", { className: "stack-controls-row" }, [
    readout,
    el("div", { style: "display: flex; gap: 8px;" }, [jitterBtn, alignBtn]),
  ]);

  const stage = el("div", { className: "stacking-stage" });

  const baseImg = el("img", {
    className: "stack-base-img pixelated",
    src: `data:image/png;base64,${share1B64}`,
    alt: "Share 1 base",
  });

  const topImg = el("img", {
    className: "stack-top-img pixelated",
    src: `data:image/png;base64,${share2B64}`,
    alt: "Share 2 (drag or use arrow keys to align)",
    tabindex: "0",
  });

  topImg.style.mixBlendMode = "multiply";
  checkPixelation(baseImg);
  checkPixelation(topImg);

  stage.appendChild(baseImg);
  stage.appendChild(topImg);

  function updateTransform() {
    let snapX = offsetX;
    let snapY = offsetY;
    const isSnapped = Math.abs(offsetX) <= 3 && Math.abs(offsetY) <= 3;
    if (isSnapped) {
      snapX = 0;
      snapY = 0;
    }
    topImg.style.transform = `translate(${snapX}px, ${snapY}px)`;
    if (isSnapped) {
      readout.textContent = "Offset: x = 0 px, y = 0 px (Magnetic Snap — Perfect Alignment!)";
      readout.style.color = "var(--success)";
    } else {
      const signX = offsetX > 0 ? "+" : "";
      const signY = offsetY > 0 ? "+" : "";
      readout.textContent = `Offset: x = ${signX}${offsetX} px, y = ${signY}${offsetY} px`;
      readout.style.color = "var(--muted)";
    }
  }

  // Pointer drag events
  let isDragging = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let startOffsetX = 0;
  let startOffsetY = 0;

  topImg.addEventListener("pointerdown", (e) => {
    isDragging = true;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    startOffsetX = offsetX;
    startOffsetY = offsetY;
    try {
      topImg.setPointerCapture(e.pointerId);
    } catch (_) {}
    topImg.focus();
  });

  topImg.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const dx = Math.round(e.clientX - startPointerX);
    const dy = Math.round(e.clientY - startPointerY);
    offsetX = startOffsetX + dx;
    offsetY = startOffsetY + dy;
    updateTransform();
  });

  const endDrag = (e) => {
    if (isDragging) {
      isDragging = false;
      try {
        topImg.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  topImg.addEventListener("pointerup", endDrag);
  topImg.addEventListener("pointercancel", endDrag);

  // Keyboard navigation
  topImg.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 10 : 1;
    let handled = false;

    if (e.key === "ArrowLeft") {
      offsetX -= step;
      handled = true;
    } else if (e.key === "ArrowRight") {
      offsetX += step;
      handled = true;
    } else if (e.key === "ArrowUp") {
      offsetY -= step;
      handled = true;
    } else if (e.key === "ArrowDown") {
      offsetY += step;
      handled = true;
    }

    if (handled) {
      e.preventDefault();
      updateTransform();
    }
  });

  alignBtn.addEventListener("click", () => {
    offsetX = 0;
    offsetY = 0;
    updateTransform();
  });

  let jitterSeed = 123456789;
  function pseudoRandom() {
    jitterSeed = (jitterSeed * 1664525 + 1013904223) % 4294967296;
    return jitterSeed / 4294967296;
  }

  jitterBtn.addEventListener("click", () => {
    offsetX = Math.floor(pseudoRandom() * 60) - 30;
    offsetY = Math.floor(pseudoRandom() * 40) - 20;
    if (Math.abs(offsetX) <= 3) offsetX = 15;
    updateTransform();
  });

  updateTransform();

  const caption = el(
    "p",
    { className: "help-text" },
    "Simulates physical transparency superposition using CSS multiply blend. When aligned (offset 0, 0), the secret appears with optical fidelity (C-5)."
  );

  container.appendChild(title);
  container.appendChild(controlsRow);
  container.appendChild(stage);
  container.appendChild(caption);

  return container;
}

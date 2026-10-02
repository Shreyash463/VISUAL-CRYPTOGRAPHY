/**
 * Stacking demo component for overlay mode (Naor & Shamir 1994).
 */
import { el, checkImagePixelation } from "./ui.js";

export function renderStackingDemo(share1B64, share2B64) {
  const container = el("div", { className: "card stacking-card" });

  const title = el("h3", { className: "card-title" }, "Stack the shares yourself");

  let offsetX = 37;
  let offsetY = 23;

  const readout = el(
    "div",
    { className: "offset-readout" },
    `Offset: x = +${offsetX} px, y = +${offsetY} px`
  );

  const alignBtn = el(
    "button",
    { type: "button", className: "btn-secondary btn-sm" },
    "Align shares"
  );

  const controlsRow = el("div", { className: "stack-controls-row" }, [
    readout,
    alignBtn,
  ]);

  const stage = el("div", { className: "stacking-stage" });

  const baseImg = el("img", {
    className: "stack-base-img",
    src: `data:image/png;base64,${share1B64}`,
    alt: "Share 1 base",
  });

  const topImg = el("img", {
    className: "stack-top-img",
    src: `data:image/png;base64,${share2B64}`,
    alt: "Share 2 (drag or focus and use arrow keys to align)",
    tabindex: "0",
  });

  topImg.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  checkImagePixelation(baseImg);
  checkImagePixelation(topImg);

  stage.appendChild(baseImg);
  stage.appendChild(topImg);

  function updateTransform() {
    topImg.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    const signX = offsetX > 0 ? "+" : "";
    const signY = offsetY > 0 ? "+" : "";
    readout.textContent = `Offset: x = ${signX}${offsetX} px, y = ${signY}${offsetY} px`;
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

  const caption = el(
    "p",
    { className: "help-text" },
    "Shares printed on transparencies must align pixel by pixel (C-5). At offset 0, 0 the secret appears."
  );

  container.appendChild(title);
  container.appendChild(controlsRow);
  container.appendChild(stage);
  container.appendChild(caption);

  return container;
}

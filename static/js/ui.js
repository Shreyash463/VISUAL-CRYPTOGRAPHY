/**
 * DOM and UI utility helpers.
 */
import { renderMetricsPanel as renderMetrics } from "./metrics.js";

export function createIcon(id, className = "icon") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${id}`);
  svg.appendChild(use);
  return svg;
}

export function el(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue;

    if (key === "className" || key === "class") {
      element.className = value;
    } else if (key === "textContent" || key === "text") {
      element.textContent = value;
    } else if (key === "disabled") {
      element.disabled = Boolean(value);
    } else if (key === "checked") {
      element.checked = Boolean(value);
    } else if (key === "value") {
      element.value = value;
    } else if (key === "hidden") {
      element.hidden = Boolean(value);
    } else if (key === "style" && typeof value === "object") {
      for (const [sKey, sVal] of Object.entries(value)) {
        element.style.setProperty(sKey, sVal);
      }
    } else if (key !== "style") {
      element.setAttribute(key, String(value));
    }
  }

  const childList = Array.isArray(children) ? children : [children];
  for (const child of childList) {
    if (child === null || child === undefined) continue;
    if (typeof child === "string" || typeof child === "number") {
      element.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }

  return element;
}

export function base64ToBlob(b64, mimeType = "image/png") {
  const byteChars = atob(b64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteNumbers], { type: mimeType });
}

export function setBusy(button, busy, label = "Processing…") {
  if (busy) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "";

    const spinner = el("span", { className: "icon spinner", "aria-hidden": "true" });
    button.appendChild(spinner);
    button.appendChild(document.createTextNode(` ${label}`));
  } else {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }
}

export function showError(container, message) {
  container.textContent = "";
  if (message) {
    const alertBox = el(
      "div",
      { className: "alert alert-error", role: "alert" },
      [createIcon("i-alert"), el("span", {}, message)]
    );
    container.appendChild(alertBox);
  }
}

export function formatNumber(value, decimals = 3) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(decimals);
}

export function badge(text, kind = "neutral") {
  const iconId = kind === "success" ? "i-check" : kind === "error" || kind === "warn" ? "i-x" : "i-info";
  const span = el("span", { className: `badge badge-${kind}` });
  span.appendChild(createIcon(iconId));
  span.appendChild(document.createTextNode(` ${text}`));
  return span;
}

export function renderMetricsPanel(metrics) {
  return renderMetrics(metrics);
}

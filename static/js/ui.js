/**
 * DOM and UI utility helpers.
 */

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
    } else {
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

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function setBusy(button, busy, label = "Processing…") {
  if (busy) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "";

    const spinner = el("span", { className: "spinner", "aria-hidden": "true" });
    button.appendChild(spinner);
    button.appendChild(document.createTextNode(" " + label));
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
      message
    );
    container.appendChild(alertBox);
  }
}

export function formatNumber(value, decimals = 3) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(decimals);
}

export function badge(text, kind = "neutral") {
  return el("span", { className: `badge badge-${kind}` }, text);
}

export function checkImagePixelation(img) {
  const update = () => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      if (img.clientWidth > img.naturalWidth || img.clientHeight > img.naturalHeight) {
        img.classList.add("pixelated");
      } else {
        img.classList.remove("pixelated");
      }
    }
  };

  if (img.complete) {
    update();
  } else {
    img.addEventListener("load", update, { once: true });
  }

  window.addEventListener("resize", update);
}

export function renderMetricsPanel(metrics) {
  const container = el("div", { className: "card metrics-panel" });
  container.appendChild(el("h3", { className: "card-title" }, "Metrics & Verification"));

  // 1 & 2: Sizes and Pixel Expansion
  const expansionText =
    metrics.pixel_expansion === 4.0
      ? "4× (4 subpixels per secret pixel)"
      : "1× (no expansion)";

  const grid = el("div", { className: "metrics-grid" });

  const itemSizes = el("div", { className: "metric-item" }, [
    el("span", { className: "metric-label" }, "Dimensions"),
    el(
      "span",
      { className: "metric-value font-mono" },
      `Secret: ${metrics.secret_size.width} × ${metrics.secret_size.height} px | Share: ${metrics.share_size.width} × ${metrics.share_size.height} px`
    ),
  ]);

  const itemExp = el("div", { className: "metric-item" }, [
    el("span", { className: "metric-label" }, "Pixel Expansion"),
    el("span", { className: "metric-value" }, expansionText),
  ]);

  // 3: Contrast
  const contrastItem = el("div", { className: "metric-item" });
  contrastItem.appendChild(el("span", { className: "metric-label" }, "Contrast (Relative Difference)"));
  if (metrics.contrast.relative_difference === null) {
    contrastItem.appendChild(
      el("span", { className: "metric-value text-sm" }, "not defined (secret has only one colour)")
    );
  } else {
    const measured = formatNumber(metrics.contrast.relative_difference, 3);
    const theo = formatNumber(metrics.contrast.theoretical, 3);
    const matchBadge = metrics.contrast.matches_theory
      ? badge("matches theory", "success")
      : badge("differs", "warn");
    contrastItem.appendChild(
      el("span", { className: "metric-value font-mono" }, [
        `${measured} (theoretical ${theo}) `,
        matchBadge,
      ])
    );
  }

  // 4: Reconstruction Check
  const recItem = el("div", { className: "metric-item" });
  recItem.appendChild(el("span", { className: "metric-label" }, "Reconstruction Check"));
  const recBadge = metrics.reconstruction_check.passed
    ? badge("Passed", "success")
    : badge("Failed", "error");
  recItem.appendChild(
    el("span", { className: "metric-value" }, [
      recBadge,
      el("small", { className: "help-text" }, metrics.reconstruction_check.rule),
    ])
  );

  grid.appendChild(itemSizes);
  grid.appendChild(itemExp);
  grid.appendChild(contrastItem);
  grid.appendChild(recItem);
  container.appendChild(grid);

  // 5: Single-share leakage table
  const leakageSec = el("div", { className: "form-group" });
  leakageSec.appendChild(el("h4", { className: "form-label" }, "Single-Share Leakage Analysis"));

  const tableWrapper = el("div", { className: "table-wrapper" });
  const table = el("table");
  const thead = el("thead", {}, [
    el("tr", {}, [
      el("th", {}, "Share"),
      el("th", {}, "Black overall"),
      el("th", {}, "Black in secret-black"),
      el("th", {}, "Black in secret-white"),
      el("th", {}, "Max deviation (4 dec)"),
      el("th", {}, "Result"),
    ]),
  ]);
  const tbody = el("tbody");

  for (const sh of metrics.leakage.shares) {
    const tr = el("tr", {}, [
      el("td", {}, `Share ${sh.index}`),
      el("td", { className: "font-mono" }, formatNumber(sh.p_black_all, 4)),
      el(
        "td",
        { className: "font-mono" },
        sh.p_black_in_secret_black !== null ? formatNumber(sh.p_black_in_secret_black, 4) : "—"
      ),
      el(
        "td",
        { className: "font-mono" },
        sh.p_black_in_secret_white !== null ? formatNumber(sh.p_black_in_secret_white, 4) : "—"
      ),
      el("td", { className: "font-mono" }, formatNumber(sh.max_deviation, 4)),
      el("td", {}, sh.passed ? badge("Passed", "success") : badge("Failed", "error")),
    ]);
    tbody.appendChild(tr);
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  tableWrapper.appendChild(table);
  leakageSec.appendChild(tableWrapper);

  const leakageFooter = el("div", { className: "stack-controls-row" }, [
    el(
      "span",
      { className: "help-text" },
      "Tolerance: max(0.02, 4·0.5/√m), m = subpixels in the region (project-chosen)."
    ),
    metrics.leakage.all_passed
      ? badge("All passed", "success")
      : badge("Some failed", "error"),
  ]);
  leakageSec.appendChild(leakageFooter);
  container.appendChild(leakageSec);

  // 6: Timing
  const timingP = el(
    "p",
    { className: "help-text" },
    `Share generation: ${formatNumber(metrics.processing_ms, 2)} ms · Total: ${formatNumber(metrics.total_ms, 2)} ms (reported, not targeted)`
  );
  container.appendChild(timingP);

  return container;
}

/**
 * Compare tab module (Section 9, O3, C-1).
 */
import { postForm } from "./api.js";
import { el, base64ToBlob, setBusy, showError, formatNumber, createIcon } from "./ui.js";
import { trackUrl } from "./state.js";
import { getTimestamp, getShareFilename, triggerDownload, renderDownloadBar } from "./download.js";
import { createImageFrame, openInspector } from "./viewer.js";
import { renderMetricsPanel } from "./metrics.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTS = ["png", "jpg", "jpeg", "bmp"];

export function init() {
  const panel = document.getElementById("panel-compare");
  if (!panel) return;

  panel.textContent = "";

  const intro = el(
    "p",
    { className: "help-text" },
    "Run both modes on the same image. P6 removes pixel expansion by moving decoding from the eye to a computation."
  );
  panel.appendChild(intro);

  const form = el("form", { id: "compare-form", className: "card" });

  // 1. Upload Zone
  const uploadSec = el("div", { className: "form-group" });
  uploadSec.appendChild(el("label", { className: "form-label" }, "1. Secret Image Upload"));

  const dropZone = el("div", { className: "drop-zone", tabIndex: "0" });
  const fileInput = el("input", {
    type: "file",
    accept: ".png,.jpg,.jpeg,.bmp",
    id: "comp-file-input",
  });
  dropZone.appendChild(fileInput);

  const dropZoneContent = el("div", { className: "drop-zone-inner" }, [
    createIcon("i-upload", "icon icon-lg drop-zone-icon"),
    el("p", {}, "Drag and drop your image here, or click to browse"),
    el("span", { className: "help-text" }, "PNG, JPG, JPEG, BMP (max 5 MB)"),
  ]);
  dropZone.appendChild(dropZoneContent);

  const filePreviewArea = el("div", { className: "file-preview-area" });
  uploadSec.appendChild(dropZone);
  uploadSec.appendChild(filePreviewArea);
  form.appendChild(uploadSec);

  let selectedFile = null;

  function validateFile(file) {
    if (!file) return "Please choose a file.";
    const name = file.name || "";
    const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    if (!ALLOWED_EXTS.includes(ext)) {
      return "Unsupported file extension. Please upload a PNG, JPG, JPEG, or BMP image.";
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return "File is too large (maximum allowed is 5 MB).";
    }
    return null;
  }

  function handleFileSelected(file) {
    showError(errorContainer, null);
    const err = validateFile(file);
    if (err) {
      selectedFile = null;
      filePreviewArea.textContent = "";
      showError(errorContainer, err);
      compareBtn.disabled = true;
      return;
    }

    selectedFile = file;
    filePreviewArea.textContent = "";

    const previewCard = el("div", { className: "file-row" });
    const thumb = el("img", { className: "file-thumb", alt: file.name });
    const objUrl = trackUrl(URL.createObjectURL(file));
    thumb.src = objUrl;

    const info = el("div", { className: "file-info" }, [
      el("p", { className: "file-name" }, file.name),
      el("p", { className: "help-text" }, `${(file.size / 1024).toFixed(1)} KB`),
    ]);

    const removeBtn = el(
      "button",
      { type: "button", className: "btn btn-secondary btn-sm" },
      [createIcon("i-x"), " Remove"]
    );
    removeBtn.addEventListener("click", () => {
      selectedFile = null;
      fileInput.value = "";
      filePreviewArea.textContent = "";
      dropZone.hidden = false;
      compareBtn.disabled = true;
    });

    previewCard.appendChild(thumb);
    previewCard.appendChild(info);
    previewCard.appendChild(removeBtn);
    filePreviewArea.appendChild(previewCard);
    dropZone.hidden = true;

    compareBtn.disabled = false;
  }

  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  // 2. Preprocessing
  const prepSec = el("div", { className: "form-group" });
  prepSec.appendChild(el("label", { className: "form-label" }, "2. Preprocessing Method"));

  const prepSelect = el("select", { className: "form-select" }, [
    el("option", { value: "halftone", selected: true }, "Halftone (Floyd–Steinberg)"),
    el("option", { value: "threshold" }, "Fixed threshold"),
  ]);
  prepSec.appendChild(prepSelect);

  const thresholdContainer = el("div", { className: "form-group", hidden: true });
  thresholdContainer.appendChild(
    el("label", { className: "form-label text-sm" }, "Threshold value (0 to 255)")
  );

  const rangeRow = el("div", { className: "stack-controls-row" });
  const rangeInput = el("input", {
    type: "range",
    min: "0",
    max: "255",
    value: "128",
    className: "form-range",
  });
  const rangeReadout = el("span", { className: "font-mono text-sm" }, "128");

  rangeInput.addEventListener("input", () => {
    rangeReadout.textContent = rangeInput.value;
  });

  rangeRow.appendChild(rangeInput);
  rangeRow.appendChild(rangeReadout);
  thresholdContainer.appendChild(rangeRow);
  prepSec.appendChild(thresholdContainer);

  const prepHelp = el(
    "p",
    { className: "help-text" },
    "Colour and grey-level images are converted to black-and-white before sharing. Colour sharing is not included: it is treated as an extension only after a security review (P10)."
  );
  prepSec.appendChild(prepHelp);
  form.appendChild(prepSec);

  prepSelect.addEventListener("change", () => {
    thresholdContainer.hidden = prepSelect.value !== "threshold";
  });

  // Error container
  const errorContainer = el("div", { className: "error-container", role: "region" });
  form.appendChild(errorContainer);

  // 3. Compare Button
  const compareBtn = el(
    "button",
    { type: "submit", className: "btn btn-primary", disabled: true },
    [createIcon("i-sliders"), " Compare modes"]
  );
  form.appendChild(compareBtn);

  panel.appendChild(form);

  // Results area
  const resultsContainer = el("div", { className: "results-container", "aria-live": "polite" });
  panel.appendChild(resultsContainer);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    showError(errorContainer, null);
    resultsContainer.textContent = "";
    setBusy(compareBtn, true, "Comparing…");

    const preprocess = prepSelect.value;
    const threshold = parseInt(rangeInput.value, 10);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("preprocess", preprocess);
    formData.append("threshold", String(threshold));

    try {
      const data = await postForm("/api/compare", formData);
      renderComparison(data);
    } catch (err) {
      showError(errorContainer, err.message);
    } finally {
      setBusy(compareBtn, false);
    }
  });

  function renderModeColumn(title, modeData, modeName) {
    const col = el("div", { className: "compare-col-card card" });
    col.appendChild(el("h3", {}, title));

    // Reconstruction Card
    const recHeader = el("h4", { className: "metric-card-title" }, "Reconstruction");
    col.appendChild(recHeader);

    const recSrc = `data:image/png;base64,${modeData.reconstruction_png_b64}`;
    const frameObj = createImageFrame(recSrc, `${title} reconstruction`);
    col.appendChild(frameObj.frame);

    const recFooter = el(
      "p",
      { className: "help-text font-mono" },
      `${modeData.metrics.share_size.width} × ${modeData.metrics.share_size.height} px`
    );
    col.appendChild(recFooter);

    const recBlob = base64ToBlob(modeData.reconstruction_png_b64);
    renderDownloadBar(recBlob, modeName, col, true);

    // Shares Grid
    col.appendChild(el("h4", { className: "metric-card-title", style: { marginTop: "16px" } }, "Generated Shares"));
    const sharesGrid = el("div", { className: "compare-columns" });
    const stamp = getTimestamp();

    modeData.shares.forEach((share) => {
      const card = el("div", { className: "card" });
      card.appendChild(el("h5", { className: "card-title text-sm" }, `Share ${share.index} of 2`));

      const sSrc = `data:image/png;base64,${share.png_b64}`;
      const sFrame = createImageFrame(sSrc, `Share ${share.index}`);
      card.appendChild(sFrame.frame);

      const footer = el("div", { className: "stack-controls-row", style: { marginTop: "8px" } }, [
        el("span", { className: "help-text font-mono text-sm" }, `${share.width} × ${share.height} px`),
      ]);

      const btnRow = el("div", { className: "download-btn-row", style: { marginTop: "8px" } });

      const inspectBtn = el(
        "button",
        { type: "button", className: "btn btn-secondary btn-sm" },
        [createIcon("i-zoom"), " Inspect at 1:1"]
      );
      inspectBtn.addEventListener("click", () => {
        openInspector(sSrc, `Share ${share.index} of 2`, inspectBtn);
      });
      btnRow.appendChild(inspectBtn);

      const downloadBtn = el(
        "button",
        { type: "button", className: "btn btn-secondary btn-sm" },
        [createIcon("i-download"), " Download PNG"]
      );
      downloadBtn.addEventListener("click", () => {
        const blob = base64ToBlob(share.png_b64, "image/png");
        triggerDownload(blob, getShareFilename(modeName, share.index, 2, stamp));
      });
      btnRow.appendChild(downloadBtn);

      card.appendChild(footer);
      card.appendChild(btnRow);
      sharesGrid.appendChild(card);
    });
    col.appendChild(sharesGrid);

    // Metrics Panel
    col.appendChild(renderMetricsPanel(modeData.metrics));

    return col;
  }

  function renderComparison(data) {
    resultsContainer.textContent = "";

    const resultsCard = el("div", { className: "card", style: { marginTop: "24px" } });
    resultsCard.appendChild(el("h2", {}, "Comparison Results"));

    // Secret Card
    const secretCard = el("div", { className: "card", style: { marginTop: "16px" } });
    secretCard.appendChild(el("h4", { className: "metric-card-title" }, "Preprocessed Secret Image"));
    const secSrc = `data:image/png;base64,${data.secret_png_b64}`;
    const sFrame = createImageFrame(secSrc, "Preprocessed secret");
    secretCard.appendChild(sFrame.frame);
    secretCard.appendChild(
      el(
        "p",
        { className: "help-text font-mono" },
        `${data.preprocess.working_size.width} × ${data.preprocess.working_size.height} px`
      )
    );
    resultsCard.appendChild(secretCard);

    // Two equal columns
    const columns = el("div", { className: "compare-columns" });
    columns.appendChild(
      renderModeColumn("Overlay 2-out-of-2 (P1)", data.overlay, "overlay")
    );
    columns.appendChild(
      renderModeColumn("XOR (2,2) (P6)", data.xor, "xor")
    );
    resultsCard.appendChild(columns);

    // Summary Table (Section 9)
    resultsCard.appendChild(el("h3", { style: { marginTop: "32px", marginBottom: "16px" } }, "Summary Comparison"));

    const tableWrapper = el("div", { className: "table-wrapper" });
    const table = el("table", { className: "leakage-table" });
    const thead = el("thead", {}, [
      el("tr", {}, [
        el("th", {}, "Property"),
        el("th", {}, "Overlay 2-out-of-2 (P1)"),
        el("th", {}, "XOR (2,2) (P6)"),
      ]),
    ]);
    const tbody = el("tbody");

    const ovRel =
      data.overlay.metrics.contrast.relative_difference !== null
        ? formatNumber(data.overlay.metrics.contrast.relative_difference, 3)
        : "—";
    const xorRel =
      data.xor.metrics.contrast.relative_difference !== null
        ? formatNumber(data.xor.metrics.contrast.relative_difference, 3)
        : "—";

    // Row 1: Pixel expansion
    const tr1 = el("tr", {}, [
      el("td", { className: "form-label" }, "Pixel expansion"),
      el("td", { className: "font-mono" }, "4× (4 subpixels per secret pixel)"),
      el("td", { className: "font-mono" }, "1× (no expansion)"),
    ]);
    tbody.appendChild(tr1);

    // Row 2: Relative difference (measured)
    const tr2 = el("tr", {}, [
      el("td", { className: "form-label" }, "Relative difference (measured)"),
      el("td", { className: "font-mono" }, ovRel),
      el("td", { className: "font-mono" }, xorRel),
    ]);
    tbody.appendChild(tr2);

    // Row 3: Relative difference (theoretical)
    const tr3 = el("tr", {}, [
      el("td", { className: "form-label" }, "Relative difference (theoretical)"),
      el("td", { className: "font-mono" }, "0.5"),
      el("td", { className: "font-mono" }, "1.0"),
    ]);
    tbody.appendChild(tr3);

    // Row 4: Decoding by eye alone (with icons)
    const eyeOv = el("span", {}, [createIcon("i-check", "icon icon-sm"), " Yes"]);
    const eyeXor = el("span", {}, [createIcon("i-x", "icon icon-sm"), " No"]);
    const tr4 = el("tr", {}, [
      el("td", { className: "form-label" }, "Decoding by eye alone"),
      el("td", {}, eyeOv),
      el("td", {}, eyeXor),
    ]);
    tbody.appendChild(tr4);

    // Row 5: Reconstruction exact (with icons)
    const recOv = el("span", {}, [createIcon("i-x", "icon icon-sm"), " No, recognisable only"]);
    const recXor = el("span", {}, [createIcon("i-check", "icon icon-sm"), " Yes"]);
    const tr5 = el("tr", {}, [
      el("td", { className: "form-label" }, "Reconstruction exact"),
      el("td", {}, recOv),
      el("td", {}, recXor),
    ]);
    tbody.appendChild(tr5);

    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    resultsCard.appendChild(tableWrapper);

    // Comparison Bar Pairs (Section 9)
    const barPairs = el("div", { className: "card", style: { marginTop: "24px" } });

    // Pair 1: Pixel expansion (overlay 4x vs xor 1x, scale 0 to 4)
    const p1Title = el("h4", { className: "metric-card-title" }, "Pixel Expansion (Scale 0 to 4)");
    const p1OvRow = el("div", { className: "stack-controls-row", style: { marginBottom: "8px" } });
    p1OvRow.appendChild(el("span", { className: "text-sm" }, "Overlay (4×)"));
    const p1OvTrack = el("div", { className: "metric-bar-track", style: { flex: "1", margin: "0 12px" } });
    const p1OvFill = el("div", { className: "metric-bar-fill", style: { width: "100%" } });
    p1OvTrack.appendChild(p1OvFill);
    p1OvRow.appendChild(p1OvTrack);
    p1OvRow.appendChild(el("span", { className: "font-mono text-sm" }, "4.0"));

    const p1XorRow = el("div", { className: "stack-controls-row", style: { marginBottom: "16px" } });
    p1XorRow.appendChild(el("span", { className: "text-sm" }, "XOR (1×)"));
    const p1XorTrack = el("div", { className: "metric-bar-track", style: { flex: "1", margin: "0 12px" } });
    const p1XorFill = el("div", { className: "metric-bar-fill", style: { width: "25%" } });
    p1XorTrack.appendChild(p1XorFill);
    p1XorRow.appendChild(p1XorTrack);
    p1XorRow.appendChild(el("span", { className: "font-mono text-sm" }, "1.0"));

    barPairs.appendChild(p1Title);
    barPairs.appendChild(p1OvRow);
    barPairs.appendChild(p1XorRow);

    // Pair 2: Relative difference (measured) (overlay vs xor, scale 0 to 1)
    const p2Title = el("h4", { className: "metric-card-title" }, "Relative Difference (Measured, Scale 0 to 1)");
    const ovPct = data.overlay.metrics.contrast.relative_difference !== null
      ? Math.min(100, Math.max(0, data.overlay.metrics.contrast.relative_difference * 100))
      : 0;
    const xorPct = data.xor.metrics.contrast.relative_difference !== null
      ? Math.min(100, Math.max(0, data.xor.metrics.contrast.relative_difference * 100))
      : 0;

    const p2OvRow = el("div", { className: "stack-controls-row", style: { marginBottom: "8px" } });
    p2OvRow.appendChild(el("span", { className: "text-sm" }, "Overlay"));
    const p2OvTrack = el("div", { className: "metric-bar-track", style: { flex: "1", margin: "0 12px" } });
    const p2OvFill = el("div", { className: "metric-bar-fill", style: { width: `${ovPct}%` } });
    p2OvTrack.appendChild(p2OvFill);
    p2OvRow.appendChild(p2OvTrack);
    p2OvRow.appendChild(el("span", { className: "font-mono text-sm" }, ovRel));

    const p2XorRow = el("div", { className: "stack-controls-row" });
    p2XorRow.appendChild(el("span", { className: "text-sm" }, "XOR"));
    const p2XorTrack = el("div", { className: "metric-bar-track", style: { flex: "1", margin: "0 12px" } });
    const p2XorFill = el("div", { className: "metric-bar-fill", style: { width: `${xorPct}%` } });
    p2XorTrack.appendChild(p2XorFill);
    p2XorRow.appendChild(p2XorTrack);
    p2XorRow.appendChild(el("span", { className: "font-mono text-sm" }, xorRel));

    barPairs.appendChild(p2Title);
    barPairs.appendChild(p2OvRow);
    barPairs.appendChild(p2XorRow);

    resultsCard.appendChild(barPairs);

    // C-1 sentence
    const note = el(
      "p",
      { className: "help-text", style: { marginTop: "16px" } },
      "Overlay mode inherently loses contrast and expands pixels; the figures are measured and reported, not hidden (C-1)."
    );
    resultsCard.appendChild(note);

    resultsContainer.appendChild(resultsCard);
    resultsCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

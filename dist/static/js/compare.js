/**
 * Compare tab module (Section 9, O3, C-1).
 * Extended to compare B/W Overlay (P1), B/W XOR (P6), Colour Overlay (P5), and Colour XOR (P6).
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
    "Benchmark all cryptographic schemes on the same secret image. Compare physical transparency overlay (P1, P5) with digital bitwise XOR (P6)."
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
    el("span", { className: "help-text" }, "PNG, JPG, JPEG, BMP (Colour or Grayscale, max 5 MB)"),
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

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  // 2. Preprocessing Options
  const prepSec = el("div", { className: "form-group" });
  prepSec.appendChild(el("label", { className: "form-label" }, "2. Preprocessing for Grayscale Schemes"));

  const prepSelect = el("select", { className: "form-select", id: "comp-prep-select" }, [
    el("option", { value: "halftone" }, "Floyd-Steinberg Error Diffusion"),
    el("option", { value: "threshold" }, "Fixed Luminance Threshold"),
  ]);
  prepSec.appendChild(prepSelect);

  const threshGroup = el("div", { className: "form-group", style: { marginTop: "8px" }, hidden: true });
  const threshLabel = el("label", { className: "form-label text-sm" }, "Threshold level: 128");
  const rangeInput = el("input", {
    type: "range",
    min: "0",
    max: "255",
    value: "128",
    className: "form-range",
  });
  rangeInput.addEventListener("input", () => {
    threshLabel.textContent = `Threshold level: ${rangeInput.value}`;
  });
  threshGroup.appendChild(threshLabel);
  threshGroup.appendChild(rangeInput);
  prepSec.appendChild(threshGroup);

  prepSelect.addEventListener("change", () => {
    threshGroup.hidden = prepSelect.value !== "threshold";
  });
  form.appendChild(prepSec);

  // Submit button
  const compareBtn = el(
    "button",
    { type: "submit", className: "btn btn-primary btn-full", disabled: true },
    [createIcon("i-sliders"), " Run Comparative Benchmark"]
  );
  form.appendChild(compareBtn);

  const errorContainer = el("div", { className: "error-container" });
  form.appendChild(errorContainer);
  panel.appendChild(form);

  // Results area
  const resultsContainer = el("div", { className: "results-container", "aria-live": "polite" });
  panel.appendChild(resultsContainer);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    showError(errorContainer, null);
    resultsContainer.textContent = "";
    setBusy(compareBtn, true, "Running comparative analysis…");

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
    resultsCard.appendChild(el("h2", {}, "Cryptographic Comparison Results"));

    // Secret Card
    const secretCard = el("div", { className: "card", style: { marginTop: "16px" } });
    secretCard.appendChild(el("h4", { className: "metric-card-title" }, "Original Secret Image"));
    const secSrc = `data:image/png;base64,${data.color_secret_png_b64 || data.secret_png_b64}`;
    const sFrame = createImageFrame(secSrc, "Input Secret Image");
    secretCard.appendChild(sFrame.frame);
    resultsCard.appendChild(secretCard);

    // Columns
    const columns = el("div", { className: "compare-columns" });
    if (data.is_color && data.color_overlay && data.color_xor) {
      columns.appendChild(renderModeColumn("Colour Overlay 2-out-of-2 (P5)", data.color_overlay, "color_overlay"));
      columns.appendChild(renderModeColumn("Colour XOR (2,2) Exact (P6)", data.color_xor, "color_xor"));
    }
    columns.appendChild(renderModeColumn("B/W Overlay 2-out-of-2 (P1)", data.overlay, "overlay"));
    columns.appendChild(renderModeColumn("B/W XOR (2,2) (P6)", data.xor, "xor"));
    resultsCard.appendChild(columns);

    // Summary Comparison Table
    resultsCard.appendChild(el("h3", { style: { marginTop: "32px", marginBottom: "16px" } }, "Summary Comparison Matrix"));

    const tableWrapper = el("div", { className: "table-wrapper" });
    const table = el("table", { className: "leakage-table" });
    const thead = el("thead", {}, [
      el("tr", {}, [
        el("th", {}, "Property / Metric"),
        el("th", {}, "Colour Overlay (P5)"),
        el("th", {}, "Colour XOR (P6)"),
        el("th", {}, "B/W Overlay (P1)"),
        el("th", {}, "B/W XOR (P6)"),
      ]),
    ]);
    const tbody = el("tbody");

    const rows = [
      ["Decoding Paradigm", "Optical superposition / human eye", "Digital computation (Bitwise XOR)", "Optical superposition / human eye", "Digital computation (Bitwise XOR)"],
      ["Pixel Expansion", "2×2 subpixels (4× pixel area)", "1:1 (Zero pixel expansion)", "2×2 subpixels (4× pixel area)", "1:1 (Zero pixel expansion)"],
      ["Color Fidelity", "Halftoned CMY + Gaussian enhanced", "Byte-for-byte exact (PSNR = ∞)", "Binary halftoned (50% contrast)", "Binary bit-identical (100% contrast)"],
      ["Single Share Leakage", "0.000 (Information-theoretically safe)", "0.000 (Random byte distribution)", "0.000 (Information-theoretically safe)", "0.000 (Uniform bits)"],
      ["Multi-Party Access", "2-out-of-2", "n-out-of-n (2 to 6 shares)", "2-out-of-2", "n-out-of-n (2 to 6 shares)"],
    ];

    rows.forEach(([prop, c1, c2, c3, c4]) => {
      const tr = el("tr", {}, [
        el("td", { style: "font-weight: 600;" }, prop),
        el("td", {}, c1),
        el("td", {}, c2),
        el("td", {}, c3),
        el("td", {}, c4),
      ]);
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    resultsCard.appendChild(tableWrapper);

    resultsContainer.appendChild(resultsCard);
    resultsCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

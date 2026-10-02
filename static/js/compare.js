/**
 * Compare tab module (O3, C-1).
 */
import { postForm } from "./api.js";
import {
  el,
  base64ToBlob,
  downloadBlob,
  setBusy,
  showError,
  formatNumber,
  checkImagePixelation,
  renderMetricsPanel,
} from "./ui.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTS = ["png", "jpg", "jpeg", "bmp"];

export function init() {
  const panel = document.getElementById("panel-compare");
  if (!panel) return;

  panel.textContent = "";

  const intro = el(
    "p",
    { className: "intro-text" },
    "Run both modes on the same image. P6 removes pixel expansion by moving decoding from the eye to a computation."
  );
  panel.appendChild(intro);

  const form = el("form", { id: "compare-form" });

  // 1. Upload Zone
  const uploadSec = el("div", { className: "form-group" });
  uploadSec.appendChild(el("label", { className: "form-label" }, "1. Secret Image Upload"));

  const dropZone = el("div", { className: "drop-zone", tabindex: "0" });
  const fileInput = el("input", {
    type: "file",
    accept: ".png,.jpg,.jpeg,.bmp",
    id: "comp-file-input",
  });
  dropZone.appendChild(fileInput);

  const dropZoneContent = el("div", { className: "drop-zone-content" }, [
    el("p", { className: "text-sm" }, "Drag and drop your image here, or click to browse"),
    el("span", { className: "btn-secondary btn-sm" }, "Choose File"),
    el("span", { className: "help-text" }, "Supported formats: PNG, JPG, JPEG, BMP (max 5 MB)"),
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

    const previewCard = el("div", { className: "file-preview-card" });
    const thumb = el("img", { className: "file-preview-thumb", alt: "Thumbnail" });

    const reader = new FileReader();
    reader.onload = (e) => {
      thumb.src = e.target.result;
    };
    reader.readAsDataURL(file);

    const info = el("div", { className: "file-preview-info" }, [
      el("div", { className: "file-preview-name" }, file.name),
      el("div", { className: "text-xs" }, `${(file.size / 1024).toFixed(1)} KB`),
    ]);

    const removeBtn = el(
      "button",
      { type: "button", className: "btn-secondary btn-sm" },
      "Remove"
    );
    removeBtn.addEventListener("click", () => {
      selectedFile = null;
      fileInput.value = "";
      filePreviewArea.textContent = "";
      compareBtn.disabled = true;
    });

    previewCard.appendChild(thumb);
    previewCard.appendChild(info);
    previewCard.appendChild(removeBtn);
    filePreviewArea.appendChild(previewCard);

    compareBtn.disabled = false;
  }

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) {
      handleFileSelected(fileInput.files[0]);
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

  const prepSelect = el("select", { className: "form-control" }, [
    el("option", { value: "halftone", selected: true }, "Halftone (Floyd–Steinberg)"),
    el("option", { value: "threshold" }, "Fixed threshold"),
  ]);
  prepSec.appendChild(prepSelect);

  const thresholdContainer = el("div", { className: "form-group", hidden: true });
  thresholdContainer.appendChild(
    el("label", { className: "form-label" }, "Threshold value (0 to 255)")
  );

  const rangeRow = el("div", { className: "form-range-row" });
  const rangeInput = el("input", {
    type: "range",
    min: "0",
    max: "255",
    value: "128",
    className: "form-range",
  });
  const rangeReadout = el("span", { className: "range-value-badge" }, "128");

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
    { type: "submit", className: "btn-primary", disabled: true },
    "Compare modes"
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
    const col = el("div", { className: "compare-column" });
    col.appendChild(el("h3", {}, title));

    // Reconstruction Card
    const recCard = el("div", { className: "result-card" });
    recCard.appendChild(el("div", { className: "result-card-header" }, "Reconstruction"));
    const imgWrapper = el("div", { className: "result-img-wrapper" });
    const img = el("img", {
      src: `data:image/png;base64,${modeData.reconstruction_png_b64}`,
      alt: `${title} reconstruction`,
    });
    checkImagePixelation(img);
    imgWrapper.appendChild(img);
    recCard.appendChild(imgWrapper);
    recCard.appendChild(
      el(
        "div",
        { className: "result-card-footer" },
        `${modeData.metrics.share_size.width} × ${modeData.metrics.share_size.height} px`
      )
    );
    col.appendChild(recCard);

    // Shares Grid
    col.appendChild(el("h4", { className: "form-label" }, "Generated Shares"));
    const sharesGrid = el("div", { className: "results-grid" });
    modeData.shares.forEach((share) => {
      const card = el("div", { className: "result-card" });
      card.appendChild(
        el("div", { className: "result-card-header" }, `Share ${share.index} of 2`)
      );

      const sImgWrap = el("div", { className: "result-img-wrapper" });
      const sImg = el("img", {
        src: `data:image/png;base64,${share.png_b64}`,
        alt: `Share ${share.index}`,
      });
      checkImagePixelation(sImg);
      sImgWrap.appendChild(sImg);
      card.appendChild(sImgWrap);

      const footer = el("div", { className: "result-card-footer" });
      footer.appendChild(el("span", {}, `${share.width} × ${share.height} px`));

      const downloadBtn = el(
        "button",
        { type: "button", className: "btn-secondary btn-sm" },
        "Download PNG"
      );
      downloadBtn.addEventListener("click", () => {
        const blob = base64ToBlob(share.png_b64, "image/png");
        downloadBlob(blob, `share_${modeName}_${share.index}_of_2.png`);
      });
      footer.appendChild(downloadBtn);
      card.appendChild(footer);

      sharesGrid.appendChild(card);
    });
    col.appendChild(sharesGrid);

    // Metrics Panel
    col.appendChild(renderMetricsPanel(modeData.metrics));

    return col;
  }

  function renderComparison(data) {
    resultsContainer.textContent = "";
    resultsContainer.appendChild(el("h2", {}, "Comparison Results"));

    // Secret Card
    const secretCard = el("div", { className: "result-card" });
    secretCard.appendChild(
      el("div", { className: "result-card-header" }, "Preprocessed Secret Image")
    );
    const sImgWrap = el("div", { className: "result-img-wrapper" });
    const sImg = el("img", {
      src: `data:image/png;base64,${data.secret_png_b64}`,
      alt: "Preprocessed secret",
    });
    checkImagePixelation(sImg);
    sImgWrap.appendChild(sImg);
    secretCard.appendChild(sImgWrap);
    secretCard.appendChild(
      el(
        "div",
        { className: "result-card-footer" },
        `${data.preprocess.working_size.width} × ${data.preprocess.working_size.height} px`
      )
    );
    resultsContainer.appendChild(secretCard);

    // Two equal columns
    const columns = el("div", { className: "compare-columns" });
    columns.appendChild(
      renderModeColumn("Overlay 2-out-of-2 (P1)", data.overlay, "overlay")
    );
    columns.appendChild(
      renderModeColumn("XOR (2,2) (P6)", data.xor, "xor")
    );
    resultsContainer.appendChild(columns);

    // Summary Table
    resultsContainer.appendChild(el("h3", {}, "Summary Comparison"));

    const tableWrapper = el("div", { className: "table-wrapper" });
    const table = el("table");
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

    const rowsData = [
      ["Pixel expansion", "4× (4 subpixels per secret pixel)", "1× (no expansion)"],
      ["Relative difference (measured)", ovRel, xorRel],
      ["Relative difference (theoretical)", "0.5", "1.0"],
      ["Decoding by eye alone", "Yes", "No"],
      ["Reconstruction exact", "No, recognisable only", "Yes"],
    ];

    rowsData.forEach(([prop, ovVal, xorVal]) => {
      const tr = el("tr", {}, [
        el("td", { className: "form-label" }, prop),
        el("td", { className: "font-mono" }, ovVal),
        el("td", { className: "font-mono" }, xorVal),
      ]);
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    resultsContainer.appendChild(tableWrapper);

    const note = el(
      "p",
      { className: "help-text" },
      "Overlay mode inherently loses contrast and expands pixels; the figures are measured and reported, not hidden (C-1)."
    );
    resultsContainer.appendChild(note);
  }
}

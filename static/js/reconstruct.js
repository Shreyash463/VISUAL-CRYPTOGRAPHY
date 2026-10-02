/**
 * Reconstruct tab module (Section 7, FR-6, FR-7, C-5).
 */
import { postForm } from "./api.js";
import { el, base64ToBlob, setBusy, showError, createIcon } from "./ui.js";
import { getLastRun, trackUrl } from "./state.js";
import { renderDownloadBar } from "./download.js";
import { createImageFrame, createFitControl } from "./viewer.js";
import { showToast } from "./toast.js";

let addFilesCallback = null;
let setModeCallback = null;

export function loadSharesFromRun() {
  const run = getLastRun();
  if (!run || !run.shares) return;

  if (setModeCallback) {
    setModeCallback(run.mode, run.n);
  }

  const files = run.shares.map(
    (s) => new File([s.blob], s.name, { type: "image/png" })
  );

  if (addFilesCallback) {
    addFilesCallback(files, true);
  }
}

function getImageDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

export function init() {
  const panel = document.getElementById("panel-reconstruct");
  if (!panel) return;

  panel.textContent = "";

  const layout = document.createElement("div");
  layout.className = "two-col-layout";

  // Left column: Controls
  const controlsCol = document.createElement("div");
  controlsCol.className = "col-sticky-controls card";

  const form = document.createElement("form");
  form.id = "reconstruct-form";

  // Top action: "Use shares from the last Generate run" (P8)
  const useLastRunBtn = document.createElement("button");
  useLastRunBtn.type = "button";
  useLastRunBtn.className = "btn btn-secondary btn-full";
  useLastRunBtn.style.marginBottom = "16px";
  useLastRunBtn.appendChild(createIcon("i-layers"));
  useLastRunBtn.appendChild(document.createTextNode(" Use shares from the last Generate run"));
  form.appendChild(useLastRunBtn);

  function updateUseLastRunState() {
    const run = getLastRun();
    useLastRunBtn.disabled = !run || !run.shares || run.shares.length === 0;
  }
  updateUseLastRunState();

  // (1) Share drop zone
  const dropGroup = document.createElement("div");
  dropGroup.className = "form-group";

  const dropLabel = document.createElement("label");
  dropLabel.className = "form-label";
  dropLabel.textContent = "1. Upload Share Images";
  dropGroup.appendChild(dropLabel);

  const dropZone = document.createElement("div");
  dropZone.className = "drop-zone";
  dropZone.tabIndex = 0;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.accept = ".png,.jpg,.jpeg,.bmp";
  fileInput.id = "rec-file-input";
  dropZone.appendChild(fileInput);

  const dropZoneInner = document.createElement("div");
  dropZoneInner.className = "drop-zone-inner";
  const uploadIcon = createIcon("i-upload", "icon icon-lg drop-zone-icon");
  dropZoneInner.appendChild(uploadIcon);
  const dropText = document.createElement("p");
  dropText.textContent = "Drag and drop your shares here, or click to browse";
  dropZoneInner.appendChild(dropText);
  const dropHint = document.createElement("p");
  dropHint.className = "help-text";
  dropHint.textContent = "Multiple PNG files · identical dimensions required";
  dropZoneInner.appendChild(dropHint);
  dropZone.appendChild(dropZoneInner);

  dropGroup.appendChild(dropZone);

  // Chips container below drop zone (Section 7.2)
  const chipsContainer = document.createElement("div");
  chipsContainer.className = "chips-container";
  dropGroup.appendChild(chipsContainer);
  form.appendChild(dropGroup);

  // (2) Mode: SAME radio cards as Generate
  const modeGroup = document.createElement("div");
  modeGroup.className = "form-group";

  const modeLabel = document.createElement("label");
  modeLabel.className = "form-label";
  modeLabel.textContent = "2. Scheme";
  modeGroup.appendChild(modeLabel);

  const radioCardsGroup = document.createElement("div");
  radioCardsGroup.className = "radio-cards-group";

  // Overlay Card
  const overlayCard = document.createElement("label");
  overlayCard.className = "radio-card selected";
  const radioOverlay = document.createElement("input");
  radioOverlay.type = "radio";
  radioOverlay.name = "rec-mode";
  radioOverlay.value = "overlay";
  radioOverlay.checked = true;
  overlayCard.appendChild(radioOverlay);

  const overlayContent = document.createElement("div");
  overlayContent.className = "radio-card-content";
  const overlayTitle = document.createElement("div");
  overlayTitle.className = "radio-card-title";
  overlayTitle.textContent = "Overlay 2-out-of-2 (P1)";
  const overlayDesc = document.createElement("div");
  overlayDesc.className = "radio-card-desc";
  overlayDesc.textContent = "Baseline Naor-Shamir (1994). 2×2 subpixels per pixel. Decoding by physical stacking without computation.";
  overlayContent.appendChild(overlayTitle);
  overlayContent.appendChild(overlayDesc);
  overlayCard.appendChild(overlayContent);

  // XOR Card
  const xorCard = document.createElement("label");
  xorCard.className = "radio-card";
  const radioXor = document.createElement("input");
  radioXor.type = "radio";
  radioXor.name = "rec-mode";
  radioXor.value = "xor";
  xorCard.appendChild(radioXor);

  const xorContent = document.createElement("div");
  xorContent.className = "radio-card-content";
  const xorTitle = document.createElement("div");
  xorTitle.className = "radio-card-title";
  xorTitle.textContent = "XOR (n,n) (P6)";
  const xorDesc = document.createElement("div");
  xorDesc.className = "radio-card-desc";
  xorDesc.textContent = "Wang et al. (2005). No pixel expansion. Perfect reconstruction when all n shares are combined by XOR.";
  xorContent.appendChild(xorTitle);
  xorContent.appendChild(xorDesc);
  xorCard.appendChild(xorContent);

  radioCardsGroup.appendChild(overlayCard);
  radioCardsGroup.appendChild(xorCard);
  modeGroup.appendChild(radioCardsGroup);
  form.appendChild(modeGroup);

  // (3) Total shares n
  const sharesGroup = document.createElement("div");
  sharesGroup.className = "form-group";

  const sharesLabel = document.createElement("label");
  sharesLabel.className = "form-label";
  sharesLabel.textContent = "3. Total shares n";
  sharesGroup.appendChild(sharesLabel);

  const overlayNote = document.createElement("p");
  overlayNote.className = "help-text";
  overlayNote.textContent = "2 shares (fixed)";
  sharesGroup.appendChild(overlayNote);

  const xorSelectGroup = document.createElement("div");
  xorSelectGroup.hidden = true;
  const xorSelect = document.createElement("select");
  xorSelect.className = "form-select";
  [2, 3, 4, 5, 6].forEach((n) => {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = `${n} shares`;
    xorSelect.appendChild(opt);
  });
  xorSelectGroup.appendChild(xorSelect);
  sharesGroup.appendChild(xorSelectGroup);
  form.appendChild(sharesGroup);

  function updateModeSelection() {
    if (radioOverlay.checked) {
      overlayCard.classList.add("selected");
      xorCard.classList.remove("selected");
      overlayNote.hidden = false;
      xorSelectGroup.hidden = true;
    } else {
      overlayCard.classList.remove("selected");
      xorCard.classList.add("selected");
      overlayNote.hidden = true;
      xorSelectGroup.hidden = false;
    }
    validateFilesAndState();
  }

  radioOverlay.addEventListener("change", updateModeSelection);
  radioXor.addEventListener("change", updateModeSelection);

  setModeCallback = (mode, n) => {
    if (mode === "overlay") {
      radioOverlay.checked = true;
    } else {
      radioXor.checked = true;
      xorSelect.value = String(n);
    }
    updateModeSelection();
  };

  // (4) Submit button
  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn btn-primary btn-full";
  submitBtn.disabled = true;
  submitBtn.appendChild(createIcon("i-shuffle"));
  submitBtn.appendChild(document.createTextNode(" Reconstruct"));
  form.appendChild(submitBtn);

  const errorSlot = document.createElement("div");
  form.appendChild(errorSlot);

  controlsCol.appendChild(form);
  layout.appendChild(controlsCol);

  // Right column: Result area (Section 7.4)
  const resultsCol = document.createElement("div");
  resultsCol.className = "results-col";

  const emptyState = document.createElement("div");
  emptyState.className = "empty-state-card";
  const emptyH3 = document.createElement("h3");
  emptyH3.textContent = "The combined image will appear here.";
  const emptyP = document.createElement("p");
  emptyP.className = "help-text";
  emptyP.textContent = "Select shares on the left and click Reconstruct.";
  emptyState.appendChild(emptyH3);
  emptyState.appendChild(emptyP);
  resultsCol.appendChild(emptyState);

  layout.appendChild(resultsCol);
  panel.appendChild(layout);

  // Chosen files management & client checks (Section 7.3)
  let chosenFiles = []; // array of { file, dim: {width, height} }

  async function addFiles(fileList, replace = false) {
    if (replace) {
      chosenFiles = [];
    }
    for (const f of fileList) {
      const dim = await getImageDimensions(f);
      chosenFiles.push({ file: f, dim });
    }
    renderChips();
    validateFilesAndState();
  }

  addFilesCallback = addFiles;

  useLastRunBtn.addEventListener("click", () => {
    loadSharesFromRun();
  });

  function renderChips() {
    chipsContainer.textContent = "";
    if (chosenFiles.length === 0) return;

    // Check base dimensions from first file
    const baseW = chosenFiles[0]?.dim?.width || 0;
    const baseH = chosenFiles[0]?.dim?.height || 0;

    chosenFiles.forEach((item, idx) => {
      const chip = document.createElement("div");
      chip.className = "share-chip";

      const isMismatch = item.dim.width !== baseW || item.dim.height !== baseH;
      if (isMismatch) {
        chip.classList.add("mismatch");
      }

      const thumb = document.createElement("img");
      thumb.className = "chip-thumb";
      const objUrl = trackUrl(URL.createObjectURL(item.file));
      thumb.src = objUrl;
      thumb.alt = item.file.name;
      chip.appendChild(thumb);

      const details = document.createElement("div");
      details.className = "chip-details";

      const title = document.createElement("span");
      title.className = "chip-title";
      title.textContent = item.file.name;

      const meta = document.createElement("span");
      meta.className = "chip-meta font-mono";
      const sizeKb = (item.file.size / 1024).toFixed(1);
      meta.textContent = `${sizeKb} KB · ${item.dim.width} × ${item.dim.height} px`;

      details.appendChild(title);
      details.appendChild(meta);
      chip.appendChild(details);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-secondary btn-sm";
      removeBtn.appendChild(createIcon("i-x"));
      removeBtn.appendChild(document.createTextNode(" Remove"));
      removeBtn.addEventListener("click", () => {
        chosenFiles.splice(idx, 1);
        renderChips();
        validateFilesAndState();
      });
      chip.appendChild(removeBtn);

      chipsContainer.appendChild(chip);
    });
  }

  function validateFilesAndState() {
    showError(errorSlot, null);

    if (chosenFiles.length === 0) {
      submitBtn.disabled = true;
      return;
    }

    const baseW = chosenFiles[0].dim.width;
    const baseH = chosenFiles[0].dim.height;

    // Check dimension mismatch
    const hasMismatch = chosenFiles.some((item) => item.dim.width !== baseW || item.dim.height !== baseH);
    if (hasMismatch) {
      showError(errorSlot, "Shares must have identical dimensions so they align pixel by pixel (C-5).");
      submitBtn.disabled = true;
      return;
    }

    // Check overlay even dimensions
    if (radioOverlay.checked) {
      if (baseW % 2 !== 0 || baseH % 2 !== 0) {
        showError(errorSlot, "Overlay shares must have even width and height.");
        submitBtn.disabled = true;
        return;
      }
    }

    submitBtn.disabled = false;
  }

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      fileInput.value = "";
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  });

  // Reconstruct submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(errorSlot, null);

    if (chosenFiles.length === 0) {
      showError(errorSlot, "Please select shares to reconstruct.");
      return;
    }

    const mode = radioOverlay.checked ? "overlay" : "xor";
    const n = mode === "overlay" ? 2 : parseInt(xorSelect.value, 10);

    const fd = new FormData();
    fd.append("mode", mode);
    fd.append("n", String(n));
    chosenFiles.forEach((item) => {
      fd.append("shares", item.file, item.file.name);
    });

    setBusy(submitBtn, true, "Reconstructing…");
    submitBtn.disabled = true;

    try {
      const data = await postForm("/api/reconstruct", fd);
      renderResult(data, mode);
    } catch (err) {
      showError(errorSlot, err.message || "Failed to reconstruct secret.");
    } finally {
      setBusy(submitBtn, false);
      submitBtn.disabled = false;
    }
  });

  function renderResult(data, mode) {
    resultsCol.textContent = "";

    const card = document.createElement("div");
    card.className = "card";

    // Header with Clear button
    const headerRow = document.createElement("div");
    headerRow.className = "stack-controls-row";

    const h2 = document.createElement("h2");
    h2.textContent = "Result";
    headerRow.appendChild(h2);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn btn-secondary btn-sm";
    clearBtn.appendChild(createIcon("i-trash"));
    clearBtn.appendChild(document.createTextNode(" Clear result"));
    clearBtn.addEventListener("click", () => {
      resultsCol.textContent = "";
      resultsCol.appendChild(emptyState);
      showToast("Result cleared.", "i-trash");
    });
    headerRow.appendChild(clearBtn);
    card.appendChild(headerRow);

    // Server message
    const msgBox = document.createElement("div");
    msgBox.className = `alert alert-${data.sufficient ? "info" : "warn"}`;
    msgBox.appendChild(createIcon("i-alert"));
    const msgSpan = document.createElement("span");
    msgSpan.textContent = data.message;
    msgBox.appendChild(msgSpan);
    card.appendChild(msgBox);

    if (!data.sufficient) {
      const extraP = document.createElement("p");
      extraP.className = "help-text";
      extraP.textContent = "A result built from too few shares shows no recognisable secret (FR-7).";
      card.appendChild(extraP);
    }

    // Image frame with Fit control (Section 6.2)
    const scrollContainer = document.createElement("div");
    scrollContainer.className = "reconstruct-scroll-wrap";
    scrollContainer.style.overflow = "auto";
    scrollContainer.style.maxHeight = "70vh";
    scrollContainer.style.display = "flex";
    scrollContainer.style.justifyContent = "center";
    scrollContainer.style.background = "#ffffff";
    scrollContainer.style.borderRadius = "8px";
    scrollContainer.style.padding = "16px";
    scrollContainer.style.border = "1px solid var(--border)";

    const imgSrc = `data:image/png;base64,${data.reconstruction_png_base64}`;
    const img = document.createElement("img");
    img.src = imgSrc;
    img.alt = "Reconstruction";
    img.className = "pixelated";
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    scrollContainer.appendChild(img);

    const fitControl = createFitControl(img, scrollContainer);
    card.appendChild(fitControl);
    card.appendChild(scrollContainer);

    // Download bar (Section 5)
    const recBlob = base64ToBlob(data.reconstruction_png_base64);
    renderDownloadBar(recBlob, mode, card, data.sufficient);

    // Alignment note
    const alignNote = document.createElement("p");
    alignNote.className = "help-text";
    alignNote.style.marginTop = "12px";
    alignNote.textContent = "Shares must come from the same run and have identical dimensions so they align pixel by pixel (C-5).";
    card.appendChild(alignNote);

    resultsCol.appendChild(card);
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Refresh "Use last run" state on panel display
  window.addEventListener("hashchange", updateUseLastRunState);
}

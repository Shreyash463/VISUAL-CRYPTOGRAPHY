/**
 * Reconstruct tab module (Section 7, FR-6, FR-7, C-5).
 * Extended with dual drop zones (Share A & Share B), client-side PNG tEXt metadata
 * auto-detection, group mismatch warnings, animated reveal, and Enhanced/Raw toggle.
 */
import { postForm } from "./api.js";
import { el, base64ToBlob, setBusy, showError, createIcon, createBadge } from "./ui.js";
import { getLastRun, trackUrl } from "./state.js";
import { renderDownloadBar, triggerDownload } from "./download.js";
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

/**
 * Fast client-side parser for PNG tEXt chunks.
 */
async function parsePngMetadata(file) {
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    if (view.getUint32(0) !== 0x89504E47) return {};
    let offset = 8;
    const meta = {};
    const dec = new TextDecoder();
    while (offset < buffer.byteLength - 8) {
      const len = view.getUint32(offset);
      const type = dec.decode(new Uint8Array(buffer, offset + 4, 4));
      if (type === "tEXt") {
        const chunkData = new Uint8Array(buffer, offset + 8, len);
        const nullIdx = chunkData.indexOf(0);
        if (nullIdx !== -1) {
          const key = dec.decode(chunkData.subarray(0, nullIdx));
          const val = dec.decode(chunkData.subarray(nullIdx + 1));
          meta[key] = val;
        }
      } else if (type === "IEND") {
        break;
      }
      offset += 12 + len;
    }
    return meta;
  } catch (_) {
    return {};
  }
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

  // Top action: "Use shares from the last Generate run"
  const useLastRunBtn = document.createElement("button");
  useLastRunBtn.id = "btn-load-last-run";
  useLastRunBtn.type = "button";
  useLastRunBtn.className = "btn btn-secondary btn-full";
  useLastRunBtn.style.marginBottom = "16px";
  useLastRunBtn.appendChild(createIcon("i-layers"));
  useLastRunBtn.appendChild(document.createTextNode(" Use shares from last Generate run"));
  form.appendChild(useLastRunBtn);

  function updateUseLastRunState() {
    const run = getLastRun();
    useLastRunBtn.disabled = !run || !run.shares || run.shares.length === 0;
  }
  updateUseLastRunState();
  window.addEventListener("vc:run-updated", updateUseLastRunState);
  document.getElementById("tab-reconstruct")?.addEventListener("click", updateUseLastRunState);

  // (1) Dual Drop Zones (Share A & Share B)
  const dropGroup = document.createElement("div");
  dropGroup.className = "form-group";

  const dropLabel = document.createElement("label");
  dropLabel.className = "form-label";
  dropLabel.textContent = "1. Upload Visual Shares";
  dropGroup.appendChild(dropLabel);

  const dualDropWrap = document.createElement("div");
  dualDropWrap.className = "dual-drop-zones";

  // Share A Drop Zone
  const dropZoneA = document.createElement("div");
  dropZoneA.className = "drop-zone-share";
  dropZoneA.appendChild(createIcon("i-upload", "icon icon-lg"));
  const pA = document.createElement("p");
  const strongA = document.createElement("strong");
  strongA.textContent = "Share A (1)";
  pA.appendChild(strongA);
  const helpA = document.createElement("p");
  helpA.className = "help-text";
  helpA.textContent = "Drop or click";
  const thumbSlotA = document.createElement("div");
  thumbSlotA.className = "thumb-slot";
  dropZoneA.appendChild(pA);
  dropZoneA.appendChild(helpA);
  dropZoneA.appendChild(thumbSlotA);

  const inputA = document.createElement("input");
  inputA.type = "file";
  inputA.accept = ".png";
  inputA.hidden = true;
  dropZoneA.appendChild(inputA);
  dropZoneA.addEventListener("click", () => inputA.click());

  // Share B Drop Zone
  const dropZoneB = document.createElement("div");
  dropZoneB.className = "drop-zone-share";
  dropZoneB.appendChild(createIcon("i-upload", "icon icon-lg"));
  const pB = document.createElement("p");
  const strongB = document.createElement("strong");
  strongB.textContent = "Share B (2)";
  pB.appendChild(strongB);
  const helpB = document.createElement("p");
  helpB.className = "help-text";
  helpB.textContent = "Drop or click";
  const thumbSlotB = document.createElement("div");
  thumbSlotB.className = "thumb-slot";
  dropZoneB.appendChild(pB);
  dropZoneB.appendChild(helpB);
  dropZoneB.appendChild(thumbSlotB);

  const inputB = document.createElement("input");
  inputB.type = "file";
  inputB.accept = ".png";
  inputB.hidden = true;
  dropZoneB.appendChild(inputB);
  dropZoneB.addEventListener("click", () => inputB.click());

  dualDropWrap.appendChild(dropZoneA);
  dualDropWrap.appendChild(dropZoneB);
  dropGroup.appendChild(dualDropWrap);

  // Fallback multi-file drop zone for n > 2
  const multiDropHint = document.createElement("p");
  multiDropHint.className = "help-text";
  multiDropHint.textContent = "Or select multiple PNG shares at once:";
  const multiInput = document.createElement("input");
  multiInput.id = "recon-multi-input";
  multiInput.type = "file";
  multiInput.multiple = true;
  multiInput.accept = ".png";
  multiInput.className = "form-control text-sm";
  multiInput.style.marginTop = "6px";
  dropGroup.appendChild(multiDropHint);
  dropGroup.appendChild(multiInput);

  form.appendChild(dropGroup);

  // Group mismatch alert banner
  const groupAlert = document.createElement("div");
  groupAlert.className = "alert alert-warn";
  groupAlert.style.display = "none";
  groupAlert.appendChild(createIcon("i-alert"));
  const groupSpan = document.createElement("span");
  const groupStrong = document.createElement("strong");
  groupStrong.textContent = "Group Warning: ";
  groupSpan.appendChild(groupStrong);
  groupSpan.appendChild(document.createTextNode("These shares do not belong to the same generation run (group mismatch). Stacking them will result in uncorrelated noise."));
  groupAlert.appendChild(groupSpan);
  form.appendChild(groupAlert);

  // Chips container for loaded files
  const chipsContainer = document.createElement("div");
  chipsContainer.className = "chips-container";
  form.appendChild(chipsContainer);

  // (2) Reconstruction Scheme
  const schemeGroup = document.createElement("div");
  schemeGroup.className = "form-group";
  const schemeLabel = document.createElement("label");
  schemeLabel.className = "form-label";
  schemeLabel.textContent = "2. Reconstruction Scheme";
  schemeGroup.appendChild(schemeLabel);

  const schemeSelect = document.createElement("select");
  schemeSelect.className = "form-select";
  schemeSelect.id = "recon-scheme-select";
  const optColorOverlay = new Option("Colour Overlay 2-out-of-2 (P5, Hou CMY)", "color_overlay");
  const optColorXor = new Option("Colour XOR (n, n) Exact (P6 Extension)", "color_xor");
  const optBwOverlay = new Option("B/W Overlay 2-out-of-2 (P1, Naor-Shamir)", "overlay");
  const optBwXor = new Option("B/W XOR (n, n) (P6, Wang et al.)", "xor");

  schemeSelect.add(optColorOverlay);
  schemeSelect.add(optColorXor);
  schemeSelect.add(optBwOverlay);
  schemeSelect.add(optBwXor);
  schemeGroup.appendChild(schemeSelect);
  form.appendChild(schemeGroup);

  // (3) Total shares n
  const sharesGroup = document.createElement("div");
  sharesGroup.className = "form-group";
  const sharesLabel = document.createElement("label");
  sharesLabel.className = "form-label";
  sharesLabel.textContent = "3. Total Shares in Access Structure (n)";
  sharesGroup.appendChild(sharesLabel);

  const overlayNote = document.createElement("p");
  overlayNote.className = "help-text";
  overlayNote.textContent = "2 shares required (fixed for physical overlay)";
  sharesGroup.appendChild(overlayNote);

  const xorSelectGroup = document.createElement("div");
  xorSelectGroup.id = "recon-xor-select-group";
  xorSelectGroup.hidden = true;
  xorSelectGroup.style.display = "none";
  const xorSelect = document.createElement("select");
  xorSelect.className = "form-select";
  xorSelect.id = "recon-n-select";
  [2, 3, 4, 5, 6].forEach((n) => {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = `${n} shares`;
    xorSelect.appendChild(opt);
  });
  xorSelectGroup.appendChild(xorSelect);
  sharesGroup.appendChild(xorSelectGroup);
  form.appendChild(sharesGroup);

  function syncSchemeUi() {
    const mode = schemeSelect.value;
    const isXor = mode === "xor" || mode === "color_xor";
    overlayNote.hidden = isXor;
    overlayNote.style.display = isXor ? "none" : "block";
    xorSelectGroup.hidden = !isXor;
    xorSelectGroup.style.display = isXor ? "block" : "none";
    validateFilesAndState();
  }

  schemeSelect.addEventListener("change", syncSchemeUi);

  setModeCallback = (mode, n) => {
    schemeSelect.value = mode;
    if (mode === "xor" || mode === "color_xor") {
      xorSelect.value = String(n || 2);
    }
    syncSchemeUi();
  };

  // (4) Submit button
  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.id = "btn-reconstruct";
  submitBtn.className = "btn btn-primary btn-full";
  submitBtn.disabled = true;
  submitBtn.appendChild(createIcon("i-shuffle"));
  submitBtn.appendChild(document.createTextNode(" Reconstruct Secret"));
  form.appendChild(submitBtn);

  const errorSlot = document.createElement("div");
  form.appendChild(errorSlot);

  controlsCol.appendChild(form);
  layout.appendChild(controlsCol);

  // Right column: Result area
  const resultsCol = document.createElement("div");
  resultsCol.className = "results-col";

  const emptyState = document.createElement("div");
  emptyState.className = "empty-state-card";
  const emptyH3 = document.createElement("h3");
  emptyH3.textContent = "The reconstructed image will appear here.";
  const emptyP = document.createElement("p");
  emptyP.className = "help-text";
  emptyP.textContent = "Upload shares into Drop Zone A and B and click Reconstruct Secret.";
  emptyState.appendChild(emptyH3);
  emptyState.appendChild(emptyP);
  resultsCol.appendChild(emptyState);

  layout.appendChild(resultsCol);
  panel.appendChild(layout);

  // Chosen files state: array of { file, dim, meta }
  let chosenFiles = [];

  function updateZonePreviews() {
    const slotA = dropZoneA.querySelector(".thumb-slot");
    const slotB = dropZoneB.querySelector(".thumb-slot");
    slotA.textContent = "";
    slotB.textContent = "";

    if (chosenFiles[0]) {
      dropZoneA.classList.add("loaded");
      const img = document.createElement("img");
      img.className = "share-thumb-preview";
      img.src = trackUrl(URL.createObjectURL(chosenFiles[0].file));
      slotA.appendChild(img);
    } else {
      dropZoneA.classList.remove("loaded");
    }

    if (chosenFiles[1]) {
      dropZoneB.classList.add("loaded");
      const img = document.createElement("img");
      img.className = "share-thumb-preview";
      img.src = trackUrl(URL.createObjectURL(chosenFiles[1].file));
      slotB.appendChild(img);
    } else {
      dropZoneB.classList.remove("loaded");
    }
  }

  async function addFiles(fileList, replace = false) {
    if (replace) {
      chosenFiles = [];
    }
    for (const f of fileList) {
      const dim = await getImageDimensions(f);
      const meta = await parsePngMetadata(f);

      // Auto-detect scheme from first file with metadata
      if (meta.vc_scheme && chosenFiles.length === 0) {
        schemeSelect.value = meta.vc_scheme;
        if (meta.vc_n) xorSelect.value = meta.vc_n;
        syncSchemeUi();
      }

      chosenFiles.push({ file: f, dim, meta });
    }
    renderChips();
    updateZonePreviews();
    validateFilesAndState();
  }

  addFilesCallback = addFiles;

  // Setup drag & drop on zones
  [dropZoneA, dropZoneB].forEach((zone, zIdx) => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => {
      zone.classList.remove("dragover");
    });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        // Replace or set the specific index
        const file = e.dataTransfer.files[0];
        getImageDimensions(file).then(async (dim) => {
          const meta = await parsePngMetadata(file);
          if (zIdx === 0) {
            chosenFiles[0] = { file, dim, meta };
          } else {
            chosenFiles[1] = { file, dim, meta };
          }
          // Filter undefined
          chosenFiles = chosenFiles.filter(Boolean);
          renderChips();
          updateZonePreviews();
          validateFilesAndState();
        });
      }
    });
  });

  inputA.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      getImageDimensions(f).then(async (dim) => {
        const meta = await parsePngMetadata(f);
        chosenFiles[0] = { file: f, dim, meta };
        chosenFiles = chosenFiles.filter(Boolean);
        renderChips();
        updateZonePreviews();
        validateFilesAndState();
      });
    }
  });

  inputB.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      getImageDimensions(f).then(async (dim) => {
        const meta = await parsePngMetadata(f);
        chosenFiles[1] = { file: f, dim, meta };
        chosenFiles = chosenFiles.filter(Boolean);
        renderChips();
        updateZonePreviews();
        validateFilesAndState();
      });
    }
  });

  multiInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      multiInput.value = "";
    }
  });

  useLastRunBtn.addEventListener("click", () => {
    loadSharesFromRun();
    showToast("Transferred shares from last Generate run.", "i-layers");
  });

  function renderChips() {
    chipsContainer.textContent = "";
    if (chosenFiles.length === 0) return;

    const baseW = chosenFiles[0]?.dim?.width || 0;
    const baseH = chosenFiles[0]?.dim?.height || 0;

    // Check group IDs across files
    const groups = chosenFiles.map((c) => c.meta.vc_group).filter(Boolean);
    const hasGroupMismatch = groups.length > 1 && new Set(groups).size > 1;
    groupAlert.style.display = hasGroupMismatch ? "flex" : "none";

    chosenFiles.forEach((item, idx) => {
      const chip = document.createElement("div");
      chip.className = "share-chip";

      const isMismatch = item.dim.width !== baseW || item.dim.height !== baseH;
      if (isMismatch) chip.classList.add("mismatch");

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
      const groupText = item.meta.vc_group ? ` · Group: ${item.meta.vc_group}` : "";
      meta.textContent = `${sizeKb} KB · ${item.dim.width} × ${item.dim.height} px${groupText}`;

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
        updateZonePreviews();
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
    const mode = schemeSelect.value;
    if (mode === "overlay" || mode === "color_overlay") {
      if (baseW % 2 !== 0 || baseH % 2 !== 0) {
        showError(errorSlot, "Overlay shares must have even width and height.");
        submitBtn.disabled = true;
        return;
      }
    }

    submitBtn.disabled = false;
  }

  // Reconstruct submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(errorSlot, null);

    if (chosenFiles.length === 0) {
      showError(errorSlot, "Please upload visual shares to reconstruct.");
      return;
    }

    const mode = schemeSelect.value;
    const isXor = mode === "xor" || mode === "color_xor";
    const n = isXor ? parseInt(xorSelect.value, 10) : 2;

    const fd = new FormData();
    fd.append("mode", mode);
    fd.append("n", String(n));
    fd.append("n_total", String(n));
    chosenFiles.forEach((item) => {
      fd.append("shares", item.file, item.file.name);
    });

    setBusy(submitBtn, true, "Reconstructing secret…");
    submitBtn.disabled = true;

    try {
      const data = await postForm("/api/reconstruct", fd);
      renderResult(data, mode);
    } catch (err) {
      console.error("Reconstruction error:", err);
      resultsCol.textContent = "";
      resultsCol.appendChild(emptyState);
      let friendlyMsg = "Failed to reconstruct secret from shares. Please verify the shares and try again.";
      if (err && err.message && !err.message.includes("Cannot read properties") && !err.message.includes("undefined") && !err.message.includes("TypeError")) {
        friendlyMsg = err.message;
      }
      showError(errorSlot, friendlyMsg);
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
    h2.textContent = "Reconstructed Secret Result";
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

    // Group Warning message if present
    if (data.warning) {
      const warnBox = document.createElement("div");
      warnBox.className = "alert alert-warn";
      warnBox.appendChild(createIcon("i-alert"));
      const warnSpan = document.createElement("span");
      warnSpan.textContent = data.warning;
      warnBox.appendChild(warnSpan);
      card.appendChild(warnBox);
    }

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

    // Toggle for Colour Overlay: Enhanced vs Raw
    let currentRecB64 = data.reconstruction_png_b64;
    const isColorOverlay = mode === "color_overlay" && data.raw_stack_png_b64 && data.enhanced_png_b64;

    if (isColorOverlay) {
      const toggleDiv = document.createElement("div");
      toggleDiv.className = "display-toggle-group";
      const btnEnh = document.createElement("button");
      btnEnh.type = "button";
      btnEnh.className = "btn-toggle-option active";
      btnEnh.textContent = "Display Enhanced (Recommended)";

      const btnRaw = document.createElement("button");
      btnRaw.type = "button";
      btnRaw.className = "btn-toggle-option";
      btnRaw.textContent = "Raw Optical Stack (Physical)";

      toggleDiv.appendChild(btnEnh);
      toggleDiv.appendChild(btnRaw);
      card.appendChild(toggleDiv);

      btnEnh.addEventListener("click", () => {
        btnEnh.classList.add("active");
        btnRaw.classList.remove("active");
        img.src = `data:image/png;base64,${data.enhanced_png_b64}`;
        currentRecB64 = data.enhanced_png_b64;
      });

      btnRaw.addEventListener("click", () => {
        btnRaw.classList.add("active");
        btnEnh.classList.remove("active");
        img.src = `data:image/png;base64,${data.raw_stack_png_b64}`;
        currentRecB64 = data.raw_stack_png_b64;
      });
    }

    // Image frame with Fit control
    const scrollContainer = document.createElement("div");
    scrollContainer.className = "reconstruct-scroll-wrap image-frame";
    scrollContainer.style.overflow = "auto";
    scrollContainer.style.maxHeight = "70vh";
    scrollContainer.style.display = "flex";
    scrollContainer.style.justifyContent = "center";
    scrollContainer.style.background = "#ffffff";
    scrollContainer.style.borderRadius = "8px";
    scrollContainer.style.padding = "16px";
    scrollContainer.style.border = "1px solid var(--border)";

    const imgSrc = `data:image/png;base64,${currentRecB64}`;
    const img = document.createElement("img");
    img.src = imgSrc;
    img.alt = "Reconstructed Secret";
    img.className = "pixelated reveal-animated";
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    scrollContainer.appendChild(img);

    const fitControl = createFitControl(img, scrollContainer);
    card.appendChild(fitControl);
    card.appendChild(scrollContainer);

    // Download button for reconstructed image
    const recBlob = base64ToBlob(currentRecB64);
    renderDownloadBar(recBlob, mode, card, data.sufficient);

    resultsCol.appendChild(card);
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  window.addEventListener("hashchange", updateUseLastRunState);
}

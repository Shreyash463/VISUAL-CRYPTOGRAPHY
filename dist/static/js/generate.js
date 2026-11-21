/**
 * Generate tab module (FR-1, FR-3, FR-4, FR-5, FR-8).
 * Extended with full Colour Visual Cryptography (Mode A: P5 CMY, Mode B: P6 XOR),
 * automatic color detection, procedural demo mode, and ZIP packaging.
 */
import { postForm } from "./api.js";
import { el, base64ToBlob, setBusy, showError, createIcon, createBadge } from "./ui.js";
import { setLastRun, clearRun, trackUrl } from "./state.js";
import { showToast } from "./toast.js";
import { getTimestamp, getShareFilename, triggerDownload, renderDownloadBar, createZipBlob } from "./download.js";
import { createImageFrame, createRevealSlider, openInspector } from "./viewer.js";
import { renderMetricsPanel } from "./metrics.js";
import { renderStackingDemo } from "./stacking.js";
import { loadSharesFromRun } from "./reconstruct.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTS = ["png", "jpg", "jpeg", "bmp"];

function createSeededNoiseCanvas(seed) {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(48, 48);
  let s = seed;
  for (let i = 0; i < 48 * 48; i++) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const v = s > 2147483648 ? 255 : 0;
    const idx = i * 4;
    imgData.data[idx] = v;
    imgData.data[idx + 1] = v;
    imgData.data[idx + 2] = v;
    imgData.data[idx + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Procedurally generate a vibrant, colorful SSPU demonstration image.
 */
export function generateProceduralDemoImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 240;
  const ctx = canvas.getContext("2d");

  // Pure white background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, 240, 240);

  // Concentric vibrant rings
  ctx.beginPath();
  ctx.arc(120, 120, 100, 0, Math.PI * 2);
  ctx.fillStyle = "#E5323F"; // Crimson red
  ctx.fill();

  ctx.beginPath();
  ctx.arc(120, 120, 75, 0, Math.PI * 2);
  ctx.fillStyle = "#00A8FF"; // Cyan
  ctx.fill();

  ctx.beginPath();
  ctx.arc(120, 120, 50, 0, Math.PI * 2);
  ctx.fillStyle = "#FFD700"; // Gold / Yellow
  ctx.fill();

  // Central star / monogram
  ctx.fillStyle = "#141B30";
  ctx.font = "bold 28px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SSPU", 120, 120);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob], "sspu_demo_secret.png", { type: "image/png" }));
    }, "image/png");
  });
}

export function init() {
  const panel = document.getElementById("panel-generate");
  if (!panel) return;

  panel.textContent = "";

  // 4.1 Hero strip
  const heroDetails = document.createElement("details");
  heroDetails.open = true;
  heroDetails.className = "hero-strip card";

  const heroSummary = document.createElement("summary");
  heroSummary.appendChild(createIcon("i-info"));
  heroSummary.appendChild(document.createTextNode(" How Visual Cryptography Works"));
  heroDetails.appendChild(heroSummary);

  const heroRow = document.createElement("div");
  heroRow.className = "hero-cards-row";

  const stepsData = [
    { num: "1", title: "Split", text: "The secret image is split into noise-like shares.", icon: "i-layers" },
    { num: "2", title: "Distribute", text: "No individual share leaks a single bit of information.", icon: "i-lock" },
    { num: "3", title: "Combine", text: "Superimposing shares reveals the secret optically or digitally.", icon: "i-eye" },
  ];

  stepsData.forEach((st, idx) => {
    const card = document.createElement("div");
    card.className = "hero-card";

    const cardHeader = document.createElement("div");
    cardHeader.className = "hero-card-header";
    cardHeader.appendChild(createIcon(st.icon));
    const numSpan = document.createElement("span");
    numSpan.className = "hero-card-num";
    numSpan.textContent = st.num;
    cardHeader.appendChild(numSpan);
    card.appendChild(cardHeader);

    const textP = document.createElement("p");
    textP.className = "hero-card-text";
    const strong = document.createElement("strong");
    strong.textContent = `${st.title}: `;
    textP.appendChild(strong);
    textP.appendChild(document.createTextNode(st.text));
    card.appendChild(textP);

    heroRow.appendChild(card);

    if (idx < stepsData.length - 1) {
      const arr = createIcon("i-arrow-right", "icon hero-arrow");
      heroRow.appendChild(arr);
    }
  });

  heroDetails.appendChild(heroRow);
  panel.appendChild(heroDetails);

  // 4.2 Two-column layout
  const layout = document.createElement("div");
  layout.className = "two-col-layout";

  // Left column: Controls
  const controlsCol = document.createElement("div");
  controlsCol.className = "col-sticky-controls card";

  const form = document.createElement("form");
  form.id = "generate-form";

  // Stepper
  const stepper = document.createElement("div");
  stepper.className = "stepper";

  // Step 1: Upload
  const step1 = document.createElement("div");
  step1.className = "step-item";
  const step1H = document.createElement("div");
  step1H.className = "step-header";
  const circle1 = document.createElement("div");
  circle1.className = "step-circle";
  circle1.textContent = "1";
  step1H.appendChild(circle1);
  const step1Title = document.createElement("span");
  step1Title.textContent = "1. Upload Secret Image";
  step1H.appendChild(step1Title);
  step1.appendChild(step1H);

  const dropZone = document.createElement("div");
  dropZone.className = "drop-zone";
  dropZone.tabIndex = 0;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".png,.jpg,.jpeg,.bmp";
  fileInput.id = "gen-file-input";
  dropZone.appendChild(fileInput);

  const dropZoneInner = document.createElement("div");
  dropZoneInner.className = "drop-zone-inner";
  const uploadIcon = createIcon("i-upload", "icon icon-lg drop-zone-icon");
  dropZoneInner.appendChild(uploadIcon);
  const dropText = document.createElement("p");
  dropText.textContent = "Drag & drop image here, or click to browse";
  dropZoneInner.appendChild(dropText);
  const dropHint = document.createElement("p");
  dropHint.className = "help-text";
  dropHint.textContent = "Lossless PNG, JPG, BMP · Colour or Grayscale";
  dropZoneInner.appendChild(dropHint);
  dropZone.appendChild(dropZoneInner);

  const fileRowSlot = document.createElement("div");
  step1.appendChild(dropZone);
  step1.appendChild(fileRowSlot);
  stepper.appendChild(step1);

  let selectedFile = null;
  let isColorDetected = false;

  function updateStep1Validity() {
    circle1.textContent = "";
    if (selectedFile) {
      circle1.className = "step-circle valid";
      circle1.appendChild(createIcon("i-check", "icon icon-sm"));
    } else {
      circle1.className = "step-circle";
      circle1.textContent = "1";
    }
  }

  function renderSelectedFile(file, colorDetected = false) {
    fileRowSlot.textContent = "";
    if (!file) return;

    const row = document.createElement("div");
    row.className = "file-row";

    const thumb = document.createElement("img");
    thumb.className = "file-thumb";
    const objectUrl = trackUrl(URL.createObjectURL(file));
    thumb.src = objectUrl;
    thumb.alt = file.name;
    row.appendChild(thumb);

    const info = document.createElement("div");
    info.className = "file-info";
    const nameP = document.createElement("p");
    nameP.className = "file-name";
    nameP.textContent = file.name;

    const sizeRow = document.createElement("div");
    sizeRow.style.display = "flex";
    sizeRow.style.alignItems = "center";
    sizeRow.style.gap = "8px";

    const sizeP = document.createElement("span");
    sizeP.className = "help-text";
    sizeP.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    sizeRow.appendChild(sizeP);

    if (colorDetected) {
      const colBadge = document.createElement("span");
      colBadge.className = "color-detect-badge";
      const dot = document.createElement("span");
      dot.className = "dot";
      colBadge.appendChild(dot);
      colBadge.appendChild(document.createTextNode("Colour detected"));
      sizeRow.appendChild(colBadge);
    }

    info.appendChild(nameP);
    info.appendChild(sizeRow);
    row.appendChild(info);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-secondary btn-sm";
    removeBtn.appendChild(createIcon("i-x"));
    removeBtn.appendChild(document.createTextNode(" Remove"));
    removeBtn.addEventListener("click", () => {
      selectedFile = null;
      isColorDetected = false;
      fileInput.value = "";
      fileRowSlot.textContent = "";
      dropZone.hidden = false;
      updateStep1Validity();
      updateSchemeAvailability(false);
    });
    row.appendChild(removeBtn);

    fileRowSlot.appendChild(row);
    dropZone.hidden = true;
  }

  // Client-side quick color analyzer
  function analyzeImageColor(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try { URL.revokeObjectURL(url); } catch (_) {}
        const canvas = document.createElement("canvas");
        const w = Math.min(img.naturalWidth || 64, 64);
        const h = Math.min(img.naturalHeight || 64, 64);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h).data;
        let colorPixels = 0;
        const total = w * h;
        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
          if (maxDiff > 15) colorPixels++;
        }
        resolve(colorPixels / total > 0.01);
      };
      img.onerror = () => {
        try { URL.revokeObjectURL(url); } catch (_) {}
        resolve(false);
      };
      img.src = url;
    });
  }

  async function handleFile(file) {
    showError(errorSlot, null);
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      showError(errorSlot, "Unsupported file format. Please upload a PNG, JPG, JPEG, or BMP image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      showError(errorSlot, "File is too large (maximum allowed is 5 MB).");
      return;
    }
    selectedFile = file;
    isColorDetected = await analyzeImageColor(file);
    updateStep1Validity();
    renderSelectedFile(file, isColorDetected);
    updateSchemeAvailability(isColorDetected);
  }

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
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
      handleFile(e.dataTransfer.files[0]);
    }
  });

  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  // Step 2: Scheme Selection (4 Schemes)
  const step2 = document.createElement("div");
  step2.className = "step-item";
  const step2H = document.createElement("div");
  step2H.className = "step-header";
  const circle2 = document.createElement("div");
  circle2.className = "step-circle valid";
  circle2.appendChild(createIcon("i-check", "icon icon-sm"));
  step2H.appendChild(circle2);
  const step2Title = document.createElement("span");
  step2Title.textContent = "2. Cryptographic Scheme";
  step2H.appendChild(step2Title);
  step2.appendChild(step2H);

  // Keep colour switch row
  const colorToggleRow = document.createElement("div");
  colorToggleRow.className = "color-switch-row";
  colorToggleRow.style.display = "none";

  const labelColor = document.createElement("label");
  const radioColor = document.createElement("input");
  radioColor.type = "radio";
  radioColor.name = "color-pref";
  radioColor.value = "color";
  radioColor.checked = true;
  labelColor.appendChild(radioColor);
  labelColor.appendChild(document.createTextNode(" Keep colour (recommended)"));

  const labelBw = document.createElement("label");
  const radioBw = document.createElement("input");
  radioBw.type = "radio";
  radioBw.name = "color-pref";
  radioBw.value = "bw";
  labelBw.appendChild(radioBw);
  labelBw.appendChild(document.createTextNode(" Force black & white"));

  colorToggleRow.appendChild(labelColor);
  colorToggleRow.appendChild(labelBw);
  step2.appendChild(colorToggleRow);

  const radioCardsGroup = document.createElement("div");
  radioCardsGroup.className = "radio-cards-group";

  // Scheme Card Helper
  function makeSchemeCard(id, value, titleText, paperBadgeText, descText, isChecked = false) {
    const card = document.createElement("label");
    card.className = `radio-card ${isChecked ? "selected" : ""}`;
    card.id = `card-${id}`;
    card.setAttribute("role", "radio");
    card.setAttribute("aria-checked", isChecked ? "true" : "false");

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "gen-mode";
    radio.value = value;
    radio.checked = isChecked;
    card.appendChild(radio);

    const content = document.createElement("div");
    content.className = "radio-card-content";

    const titleDiv = document.createElement("div");
    titleDiv.className = "radio-card-title";
    const tSpan = document.createElement("span");
    tSpan.textContent = titleText;
    const badge = createBadge("Selected", "success", "i-check");
    badge.hidden = !isChecked;
    badge.style.display = isChecked ? "inline-flex" : "none";

    titleDiv.appendChild(tSpan);
    titleDiv.appendChild(badge);

    const paperBadge = document.createElement("span");
    paperBadge.className = "paper-badge";
    paperBadge.style.margin = "4px 0";
    paperBadge.style.display = "inline-block";
    paperBadge.textContent = paperBadgeText;

    const descDiv = document.createElement("div");
    descDiv.className = "radio-card-desc";
    descDiv.textContent = descText;

    content.appendChild(titleDiv);
    content.appendChild(paperBadge);
    content.appendChild(descDiv);
    card.appendChild(content);

    return { card, radio, badge };
  }

  // 1. Colour Overlay (P5 Hou)
  const scColorOverlay = makeSchemeCard(
    "color-overlay",
    "color_overlay",
    "Colour Overlay 2-out-of-2",
    "P5 · Hou 2003",
    "CMY halftoning with 2×2 subpixels. Reconstructs in full colour by physical overlay or display enhancement."
  );

  // 2. Colour XOR (P6)
  const scColorXor = makeSchemeCard(
    "color-xor",
    "color_xor",
    "Colour XOR (n, n) Exact",
    "P6 Extension",
    "24-bit RGB bitwise XOR. Zero expansion, byte-for-byte exact lossless colour reconstruction."
  );

  // 3. B/W Overlay (P1 Naor-Shamir)
  const scBwOverlay = makeSchemeCard(
    "bw-overlay",
    "overlay",
    "B/W Overlay 2-out-of-2",
    "P1 · Naor-Shamir 1994",
    "Baseline visual cryptography. 2×2 subpixels. Physical transparency overlay decoding.",
    true
  );

  // 4. B/W XOR (P6 Wang)
  const scBwXor = makeSchemeCard(
    "bw-xor",
    "xor",
    "B/W XOR (n, n)",
    "P6 · Wang 2005",
    "Bitwise modular addition. Zero expansion, bit-identical black & white reconstruction."
  );

  const schemeCards = [scColorOverlay, scColorXor, scBwOverlay, scBwXor];

  schemeCards.forEach(({ card }) => radioCardsGroup.appendChild(card));
  step2.appendChild(radioCardsGroup);
  stepper.appendChild(step2);

  // Step 3: Shares Count
  const step3 = document.createElement("div");
  step3.className = "step-item";
  const step3H = document.createElement("div");
  step3H.className = "step-header";
  const circle3 = document.createElement("div");
  circle3.className = "step-circle valid";
  circle3.appendChild(createIcon("i-check", "icon icon-sm"));
  step3H.appendChild(circle3);
  const step3Title = document.createElement("span");
  step3Title.textContent = "3. Number of Shares (n)";
  step3H.appendChild(step3Title);
  step3.appendChild(step3H);

  const sharesWrapper = document.createElement("div");
  sharesWrapper.className = "form-group";
  const overlayShareNote = document.createElement("p");
  overlayShareNote.className = "help-text";
  overlayShareNote.id = "overlay-share-note";
  overlayShareNote.textContent = "2 shares (fixed for overlay superposition)";

  const xorSelectGroup = document.createElement("div");
  xorSelectGroup.id = "xor-select-group";
  xorSelectGroup.hidden = true;
  xorSelectGroup.style.display = "none";
  const xorSelectLabel = document.createElement("label");
  xorSelectLabel.className = "form-label text-sm";
  xorSelectLabel.id = "xor-n-label";
  xorSelectLabel.htmlFor = "xor-n-select";
  xorSelectLabel.textContent = "Number of shares n (Wang et al. 2005 XOR secret sharing, 2 to 6 shares):";
  const xorSelect = document.createElement("select");
  xorSelect.className = "form-select";
  xorSelect.id = "xor-n-select";
  xorSelect.name = "n";
  [2, 3, 4, 5, 6].forEach((n) => {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = `${n} shares`;
    xorSelect.appendChild(opt);
  });
  xorSelectGroup.appendChild(xorSelectLabel);
  xorSelectGroup.appendChild(xorSelect);

  sharesWrapper.appendChild(overlayShareNote);
  sharesWrapper.appendChild(xorSelectGroup);
  step3.appendChild(sharesWrapper);
  stepper.appendChild(step3);

  function getSelectedMode() {
    const checked = schemeCards.find((c) => c.radio.checked);
    return checked ? checked.radio.value : "overlay";
  }

  function syncSchemeSelection() {
    const mode = getSelectedMode();
    schemeCards.forEach(({ card, radio, badge }) => {
      const isSel = radio.checked;
      if (isSel) {
        card.classList.add("selected");
        card.setAttribute("aria-checked", "true");
        badge.hidden = false;
        badge.style.display = "inline-flex";
      } else {
        card.classList.remove("selected");
        card.setAttribute("aria-checked", "false");
        badge.hidden = true;
        badge.style.display = "none";
      }
    });

    const isXor = mode === "xor" || mode === "color_xor";
    overlayShareNote.hidden = isXor;
    overlayShareNote.style.display = isXor ? "none" : "block";
    xorSelectGroup.hidden = !isXor;
    xorSelectGroup.style.display = isXor ? "block" : "none";

    // Halftone step is only applicable for binary overlay
    const isColorXor = mode === "color_xor";
    if (prepSelect) prepSelect.disabled = isColorXor;
  }

  schemeCards.forEach(({ card, radio }) => {
    card.addEventListener("click", () => {
      if (!radio.checked) {
        schemeCards.forEach((c) => { c.radio.checked = false; });
        radio.checked = true;
        syncSchemeSelection();
      }
    });
    radio.addEventListener("change", syncSchemeSelection);
  });

  function updateSchemeAvailability(hasColor) {
    if (hasColor) {
      colorToggleRow.style.display = "flex";
      // Auto-select Colour Overlay
      scColorOverlay.radio.checked = true;
    } else {
      colorToggleRow.style.display = "none";
      scBwOverlay.radio.checked = true;
    }
    syncSchemeSelection();
  }

  // Handle color preference radio
  colorToggleRow.querySelectorAll("input").forEach((r) => {
    r.addEventListener("change", (e) => {
      if (e.target.value === "bw") {
        scBwOverlay.radio.checked = true;
      } else {
        scColorOverlay.radio.checked = true;
      }
      syncSchemeSelection();
    });
  });

  // Step 4: Preprocessing (for B/W and Halftone)
  const step4 = document.createElement("div");
  step4.className = "step-item";
  const step4H = document.createElement("div");
  step4H.className = "step-header";
  const circle4 = document.createElement("div");
  circle4.className = "step-circle valid";
  circle4.appendChild(createIcon("i-check", "icon icon-sm"));
  step4H.appendChild(circle4);
  const step4Title = document.createElement("span");
  step4Title.textContent = "4. Preprocessing & Binarization";
  step4H.appendChild(step4Title);
  step4.appendChild(step4H);

  const prepSelect = document.createElement("select");
  prepSelect.className = "form-select";
  const optHalftone = document.createElement("option");
  optHalftone.value = "halftone";
  optHalftone.textContent = "Floyd-Steinberg Error Diffusion (Recommended)";
  const optThreshold = document.createElement("option");
  optThreshold.value = "threshold";
  optThreshold.textContent = "Fixed Luminance Threshold";
  prepSelect.appendChild(optHalftone);
  prepSelect.appendChild(optThreshold);

  const threshGroup = document.createElement("div");
  threshGroup.className = "form-group";
  threshGroup.hidden = true;
  threshGroup.style.marginTop = "8px";
  const threshLabel = document.createElement("label");
  threshLabel.className = "form-label text-sm";
  threshLabel.textContent = "Threshold level (0–255): 128";
  const threshSlider = document.createElement("input");
  threshSlider.type = "range";
  threshSlider.min = "0";
  threshSlider.max = "255";
  threshSlider.value = "128";
  threshSlider.className = "form-range";
  threshSlider.addEventListener("input", () => {
    threshLabel.textContent = `Threshold level (0–255): ${threshSlider.value}`;
  });
  threshGroup.appendChild(threshLabel);
  threshGroup.appendChild(threshSlider);

  step4.appendChild(prepSelect);
  step4.appendChild(threshGroup);
  stepper.appendChild(step4);

  prepSelect.addEventListener("change", () => {
    threshGroup.hidden = prepSelect.value !== "threshold";
  });

  form.appendChild(stepper);

  // Submit button
  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn btn-primary btn-full";
  submitBtn.appendChild(createIcon("i-shuffle"));
  submitBtn.appendChild(document.createTextNode(" Split Secret Into Shares"));
  form.appendChild(submitBtn);

  const errorSlot = document.createElement("div");
  form.appendChild(errorSlot);

  controlsCol.appendChild(form);
  layout.appendChild(controlsCol);

  // Right column: Results area
  const resultsCol = document.createElement("div");
  resultsCol.className = "results-col";

  // Empty state
  const emptyState = document.createElement("div");
  emptyState.className = "empty-state-card";

  const emptyArt = document.createElement("div");
  emptyArt.className = "empty-state-art";
  const c1 = createSeededNoiseCanvas(123456);
  c1.className = "noise-canvas-square noise-sq-1";
  const c2 = createSeededNoiseCanvas(789012);
  c2.className = "noise-canvas-square noise-sq-2";
  emptyArt.appendChild(c1);
  emptyArt.appendChild(c2);
  emptyState.appendChild(emptyArt);

  const emptyH3 = document.createElement("h3");
  emptyH3.textContent = "Your visual shares will appear here";
  emptyState.appendChild(emptyH3);
  const emptyP = document.createElement("p");
  emptyP.className = "help-text";
  emptyP.textContent = "Select an image and click Split Secret Into Shares, or click Demo Mode.";
  emptyState.appendChild(emptyP);

  resultsCol.appendChild(emptyState);
  layout.appendChild(resultsCol);
  panel.appendChild(layout);

  // Wire One-Click Demo Mode button
  const demoModeBtn = document.getElementById("btn-demo-mode");
  if (demoModeBtn) {
    demoModeBtn.addEventListener("click", async () => {
      setBusy(demoModeBtn, true, "Loading demo…");
      try {
        const demoFile = await generateProceduralDemoImage();
        await handleFile(demoFile);
        // Trigger submit automatically!
        submitBtn.click();
        showToast("Loaded vibrant colourful demonstration secret!", "i-sparkles");
      } catch (err) {
        showToast("Failed to initialize demo image.", "i-alert", "error");
      } finally {
        setBusy(demoModeBtn, false);
      }
    });
  }

  // Form Submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(errorSlot, null);

    if (!selectedFile) {
      showError(errorSlot, "Please choose an image file before generating shares.");
      return;
    }

    const mode = getSelectedMode();
    const isXor = mode === "xor" || mode === "color_xor";
    const n = isXor ? parseInt(xorSelect.value, 10) : 2;
    const preprocessing = prepSelect.value;
    const threshold = preprocessing === "threshold" ? parseInt(threshSlider.value, 10) : undefined;

    const fd = new FormData();
    fd.append("file", selectedFile);
    fd.append("mode", mode);
    fd.append("n", String(n));
    fd.append("preprocess", preprocessing);
    if (threshold !== undefined) {
      fd.append("threshold", String(threshold));
    }

    setBusy(submitBtn, true, "Generating shares…");
    submitBtn.disabled = true;

    // Show skeletons
    resultsCol.textContent = "";
    const skelContainer = document.createElement("div");
    skelContainer.className = "skeleton-container";
    for (let i = 0; i < 3; i++) {
      const sk = document.createElement("div");
      sk.className = "skeleton-card";
      skelContainer.appendChild(sk);
    }
    resultsCol.appendChild(skelContainer);

    try {
      const data = await postForm("/api/generate", fd);
      renderResults(data, mode, n);
    } catch (err) {
      console.error("Share generation error:", err);
      resultsCol.textContent = "";
      resultsCol.appendChild(emptyState);
      let friendlyMsg = "Failed to generate visual cryptography shares. Please verify the input image and try again.";
      if (err && err.message && !err.message.includes("Cannot read properties") && !err.message.includes("undefined") && !err.message.includes("TypeError")) {
        friendlyMsg = err.message;
      }
      showError(errorSlot, friendlyMsg);
    } finally {
      setBusy(submitBtn, false);
      submitBtn.disabled = false;
    }
  });

  function renderResults(data, mode, n) {
    resultsCol.textContent = "";
    const stamp = getTimestamp();
    const group = data.group_id || null;

    const shareObjects = data.shares.map((s) => {
      const b64 = s.png_b64;
      return {
        index: s.index,
        blob: base64ToBlob(b64),
        name: s.filename || getShareFilename(mode, s.index, n, stamp, group),
        b64,
        width: s.width,
        height: s.height,
      };
    });

    const secretB64 = data.secret_png_b64;
    const secretBlob = base64ToBlob(secretB64);
    const recB64 = data.reconstruction_png_b64;
    const reconstructionBlob = base64ToBlob(recB64);

    setLastRun({
      mode,
      n,
      stamp,
      group,
      shares: shareObjects,
      secretBlob,
      reconstructionBlob,
      metrics: data.metrics,
      is_color: data.is_color,
      raw_stack_png_b64: data.raw_stack_png_b64,
      enhanced_png_b64: data.enhanced_png_b64,
    });

    // Results Header
    const headerRow = document.createElement("div");
    headerRow.className = "results-header-row";

    const titleDiv = document.createElement("div");
    titleDiv.className = "results-title-group";
    const h2 = document.createElement("h2");
    h2.textContent = "Generated Shares & Superposition";
    const subtitle = document.createElement("p");
    subtitle.className = "help-text";
    subtitle.textContent = `Generated ${n} shares using ${mode.replace("_", " ")} (${data.metrics.processing_ms} ms)`;
    titleDiv.appendChild(h2);
    titleDiv.appendChild(subtitle);
    headerRow.appendChild(titleDiv);

    // Actions: "Download All (ZIP)" & "Send to Reconstruct"
    const actionBtns = document.createElement("div");
    actionBtns.style.display = "flex";
    actionBtns.style.gap = "8px";

    const zipBtn = document.createElement("button");
    zipBtn.type = "button";
    zipBtn.className = "btn btn-primary btn-sm";
    zipBtn.appendChild(createIcon("i-download"));
    zipBtn.appendChild(document.createTextNode(" Download Shares (ZIP)"));
    zipBtn.addEventListener("click", async () => {
      try {
        setBusy(zipBtn, true, "Zipping…");
        const zipFiles = shareObjects.map((s) => ({ name: s.name, blob: s.blob }));
        const zipBlob = await createZipBlob(zipFiles);
        triggerDownload(zipBlob, `vc-${mode}-${group || stamp}-shares.zip`);
      } catch (err) {
        showToast("Failed to create ZIP file.", "i-alert", "error");
      } finally {
        setBusy(zipBtn, false);
      }
    });
    actionBtns.appendChild(zipBtn);

    const sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.className = "btn btn-secondary btn-sm";
    sendBtn.appendChild(createIcon("i-link"));
    sendBtn.appendChild(document.createTextNode(" Send to Reconstruct Tab"));
    sendBtn.addEventListener("click", () => {
      const recTab = document.getElementById("tab-reconstruct");
      if (recTab) {
        recTab.click();
        loadSharesFromRun();
        showToast("Shares transferred to Reconstruct tab.", "i-link");
      }
    });
    actionBtns.appendChild(sendBtn);

    headerRow.appendChild(actionBtns);
    resultsCol.appendChild(headerRow);

    // Tabs inside Results (Overview, Individual Shares, Metrics, Superposition Stacking)
    const subNav = document.createElement("div");
    subNav.className = "tabs-nav-wrapper";
    subNav.style.marginTop = "16px";
    const subTabs = document.createElement("nav");
    subTabs.className = "tabs-nav";
    subTabs.setAttribute("role", "tablist");

    const tOverview = el("button", { id: "rtab-overview", className: "tab-btn", role: "tab", "aria-selected": "true" }, [createIcon("i-image"), " Overview"]);
    const tShares = el("button", { id: "rtab-shares", className: "tab-btn", role: "tab", "aria-selected": "false" }, [createIcon("i-layers"), ` Shares (${n})`]);
    const tStack = el("button", { id: "rtab-stack", className: "tab-btn", role: "tab", "aria-selected": "false" }, [createIcon("i-shuffle"), " Live Superposition"]);
    const tMetrics = el("button", { id: "rtab-metrics", className: "tab-btn", role: "tab", "aria-selected": "false" }, [createIcon("i-sliders"), " Cryptographic Metrics"]);

    subTabs.appendChild(tOverview);
    subTabs.appendChild(tShares);
    subTabs.appendChild(tStack);
    subTabs.appendChild(tMetrics);
    subNav.appendChild(subTabs);
    resultsCol.appendChild(subNav);

    // Panel 1: Overview (Secret, Superposition result)
    const pOverview = el("div", { id: "rpanel-overview", className: "tab-panel", role: "tabpanel" });
    const gridOverview = el("div", { className: "results-grid-2col" });

    const fSecret = createImageFrame(
      `data:image/png;base64,${secretB64}`,
      "Secret Image (Input)",
      `${data.metrics.secret_size.width} × ${data.metrics.secret_size.height} px`,
      secretBlob,
      `secret_${stamp}.png`
    );
    const fReconstruction = createImageFrame(
      `data:image/png;base64,${recB64}`,
      data.is_color ? "Reconstructed Colour Result" : "Reconstructed Result",
      `${data.metrics.secret_size.width} × ${data.metrics.secret_size.height} px`,
      reconstructionBlob,
      `reconstruction_${mode}_${stamp}.png`
    );
    fReconstruction.frame.classList.add("reveal-animated");

    gridOverview.appendChild(fSecret.frame);
    gridOverview.appendChild(fReconstruction.frame);
    pOverview.appendChild(gridOverview);

    // Download bar
    renderDownloadBar(reconstructionBlob, mode, pOverview, true);
    resultsCol.appendChild(pOverview);

    // Panel 2: Shares
    const pShares = el("div", { id: "rpanel-shares", className: "tab-panel", role: "tabpanel", hidden: true });
    const gridShares = el("div", { className: "results-grid-cards" });

    shareObjects.forEach((s) => {
      const frame = createImageFrame(
        `data:image/png;base64,${s.b64}`,
        `Share ${s.index} of ${n}`,
        `${s.width} × ${s.height} px · Lossless PNG`,
        s.blob,
        s.name
      );
      gridShares.appendChild(frame.frame);
    });
    pShares.appendChild(gridShares);
    resultsCol.appendChild(pShares);

    // Panel 3: Live Superposition Stacking Demo
    const pStack = el("div", { id: "rpanel-stack", className: "tab-panel", role: "tabpanel", hidden: true });
    if (shareObjects.length >= 2) {
      const stackDemo = renderStackingDemo(shareObjects[0].b64, shareObjects[1].b64);
      pStack.appendChild(stackDemo);
    } else {
      pStack.appendChild(el("p", { className: "help-text" }, "Requires at least 2 shares for optical superposition."));
    }
    resultsCol.appendChild(pStack);

    // Panel 4: Metrics
    const pMetrics = el("div", { id: "rpanel-metrics", className: "tab-panel", role: "tabpanel", hidden: true });
    renderMetricsPanel(data.metrics, pMetrics);
    resultsCol.appendChild(pMetrics);

    // Sub-tabs switching logic
    const subPanels = [
      { tab: tOverview, panel: pOverview },
      { tab: tShares, panel: pShares },
      { tab: tStack, panel: pStack },
      { tab: tMetrics, panel: pMetrics },
    ];

    subPanels.forEach(({ tab, panel: p }) => {
      tab.addEventListener("click", () => {
        subPanels.forEach((item) => {
          const isAct = item.tab === tab;
          item.tab.setAttribute("aria-selected", String(isAct));
          item.panel.hidden = !isAct;
        });
      });
    });

    resultsCol.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  syncSchemeSelection();
}

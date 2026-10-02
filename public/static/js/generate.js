/**
 * Generate tab module (FR-1, FR-3, FR-4, FR-5, FR-8).
 */
import { postForm } from "./api.js";
import { el, base64ToBlob, setBusy, showError, createIcon, createBadge } from "./ui.js";
import { setLastRun, clearRun, trackUrl } from "./state.js";
import { showToast } from "./toast.js";
import { getTimestamp, getShareFilename, triggerDownload, renderDownloadBar } from "./download.js";
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
  heroSummary.appendChild(document.createTextNode(" How it works"));
  heroDetails.appendChild(heroSummary);

  const heroRow = document.createElement("div");
  heroRow.className = "hero-cards-row";

  const stepsData = [
    { num: "1", title: "Split", text: "the secret image becomes noise-like shares.", icon: "i-layers" },
    { num: "2", title: "Distribute", text: "no single share reveals anything.", icon: "i-lock" },
    { num: "3", title: "Combine", text: "the right shares together reveal the secret.", icon: "i-eye" },
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
  step1Title.textContent = "1 Upload";
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
  dropText.textContent = "Drag and drop your image here, or click to browse";
  dropZoneInner.appendChild(dropText);
  const dropHint = document.createElement("p");
  dropHint.className = "help-text";
  dropHint.textContent = "PNG, JPG, JPEG, BMP · max 5 MB";
  dropZoneInner.appendChild(dropHint);
  dropZone.appendChild(dropZoneInner);

  const fileRowSlot = document.createElement("div");
  step1.appendChild(dropZone);
  step1.appendChild(fileRowSlot);
  stepper.appendChild(step1);

  let selectedFile = null;

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

  function renderSelectedFile(file) {
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
    const sizeP = document.createElement("p");
    sizeP.className = "help-text";
    sizeP.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    info.appendChild(nameP);
    info.appendChild(sizeP);
    row.appendChild(info);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-secondary btn-sm";
    removeBtn.appendChild(createIcon("i-x"));
    removeBtn.appendChild(document.createTextNode(" Remove"));
    removeBtn.addEventListener("click", () => {
      selectedFile = null;
      fileInput.value = "";
      fileRowSlot.textContent = "";
      dropZone.hidden = false;
      updateStep1Validity();
    });
    row.appendChild(removeBtn);

    fileRowSlot.appendChild(row);
    dropZone.hidden = true;
  }

  function handleFile(file) {
    showError(errorSlot, null);
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      showError(errorSlot, "Unsupported file extension. Please upload a PNG, JPG, JPEG, or BMP image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      showError(errorSlot, "File is too large (maximum allowed is 5 MB).");
      return;
    }
    selectedFile = file;
    updateStep1Validity();
    renderSelectedFile(file);
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

  // Step 2: Scheme
  const step2 = document.createElement("div");
  step2.className = "step-item";
  const step2H = document.createElement("div");
  step2H.className = "step-header";
  const circle2 = document.createElement("div");
  circle2.className = "step-circle valid";
  circle2.appendChild(createIcon("i-check", "icon icon-sm"));
  step2H.appendChild(circle2);
  const step2Title = document.createElement("span");
  step2Title.textContent = "2 Scheme";
  step2H.appendChild(step2Title);
  step2.appendChild(step2H);

  const radioCardsGroup = document.createElement("div");
  radioCardsGroup.className = "radio-cards-group";

  // Overlay Card
  const overlayCard = document.createElement("label");
  overlayCard.className = "radio-card selected";
  const radioOverlay = document.createElement("input");
  radioOverlay.type = "radio";
  radioOverlay.name = "gen-mode";
  radioOverlay.value = "overlay";
  radioOverlay.checked = true;
  overlayCard.appendChild(radioOverlay);

  const overlayContent = document.createElement("div");
  overlayContent.className = "radio-card-content";
  const overlayTitle = document.createElement("div");
  overlayTitle.className = "radio-card-title";
  const overlayTitleText = document.createElement("span");
  overlayTitleText.textContent = "Overlay 2-out-of-2 (P1)";
  const overlayBadge = createBadge("Selected", "success", "i-check");
  overlayTitle.appendChild(overlayTitleText);
  overlayTitle.appendChild(overlayBadge);

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
  radioXor.name = "gen-mode";
  radioXor.value = "xor";
  xorCard.appendChild(radioXor);

  const xorContent = document.createElement("div");
  xorContent.className = "radio-card-content";
  const xorTitle = document.createElement("div");
  xorTitle.className = "radio-card-title";
  const xorTitleText = document.createElement("span");
  xorTitleText.textContent = "XOR (n,n) (P6)";
  const xorBadge = createBadge("Selected", "success", "i-check");
  xorBadge.hidden = true;
  xorTitle.appendChild(xorTitleText);
  xorTitle.appendChild(xorBadge);

  const xorDesc = document.createElement("div");
  xorDesc.className = "radio-card-desc";
  xorDesc.textContent = "Wang et al. (2005). No pixel expansion. Perfect reconstruction when all n shares are combined by XOR.";
  xorContent.appendChild(xorTitle);
  xorContent.appendChild(xorDesc);
  xorCard.appendChild(xorContent);

  radioCardsGroup.appendChild(overlayCard);
  radioCardsGroup.appendChild(xorCard);
  step2.appendChild(radioCardsGroup);
  stepper.appendChild(step2);

  // Step 3: Shares
  const step3 = document.createElement("div");
  step3.className = "step-item";
  const step3H = document.createElement("div");
  step3H.className = "step-header";
  const circle3 = document.createElement("div");
  circle3.className = "step-circle valid";
  circle3.appendChild(createIcon("i-check", "icon icon-sm"));
  step3H.appendChild(circle3);
  const step3Title = document.createElement("span");
  step3Title.textContent = "3 Shares";
  step3H.appendChild(step3Title);
  step3.appendChild(step3H);

  const sharesWrapper = document.createElement("div");
  sharesWrapper.className = "form-group";
  const overlayShareNote = document.createElement("p");
  overlayShareNote.className = "help-text";
  overlayShareNote.textContent = "2 shares (fixed)";

  const xorSelectGroup = document.createElement("div");
  xorSelectGroup.hidden = true;
  const xorSelectLabel = document.createElement("label");
  xorSelectLabel.className = "form-label text-sm";
  xorSelectLabel.textContent = "Number of shares (n)";
  const xorSelect = document.createElement("select");
  xorSelect.className = "form-select";
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

  function updateModeSelection() {
    if (radioOverlay.checked) {
      overlayCard.classList.add("selected");
      xorCard.classList.remove("selected");
      overlayBadge.hidden = false;
      xorBadge.hidden = true;
      overlayShareNote.hidden = false;
      xorSelectGroup.hidden = true;
    } else {
      overlayCard.classList.remove("selected");
      xorCard.classList.add("selected");
      overlayBadge.hidden = true;
      xorBadge.hidden = false;
      overlayShareNote.hidden = true;
      xorSelectGroup.hidden = false;
    }
  }

  radioOverlay.addEventListener("change", updateModeSelection);
  radioXor.addEventListener("change", updateModeSelection);

  // Step 4: Preprocessing
  const step4 = document.createElement("div");
  step4.className = "step-item";
  const step4H = document.createElement("div");
  step4H.className = "step-header";
  const circle4 = document.createElement("div");
  circle4.className = "step-circle valid";
  circle4.appendChild(createIcon("i-check", "icon icon-sm"));
  step4H.appendChild(circle4);
  const step4Title = document.createElement("span");
  step4Title.textContent = "4 Preprocessing";
  step4H.appendChild(step4Title);
  step4.appendChild(step4H);

  const prepSelect = document.createElement("select");
  prepSelect.className = "form-select";
  const optHalftone = document.createElement("option");
  optHalftone.value = "halftone";
  optHalftone.textContent = "Halftone (Floyd-Steinberg)";
  const optThreshold = document.createElement("option");
  optThreshold.value = "threshold";
  optThreshold.textContent = "Fixed threshold";
  prepSelect.appendChild(optHalftone);
  prepSelect.appendChild(optThreshold);

  const threshGroup = document.createElement("div");
  threshGroup.className = "form-group";
  threshGroup.hidden = true;

  const threshLabelRow = document.createElement("div");
  threshLabelRow.className = "stack-controls-row";
  const threshLabel = document.createElement("label");
  threshLabel.className = "form-label text-sm";
  threshLabel.textContent = "Threshold level (0-255)";
  const threshValSpan = document.createElement("span");
  threshValSpan.className = "font-mono text-sm";
  threshValSpan.textContent = "128";
  threshLabelRow.appendChild(threshLabel);
  threshLabelRow.appendChild(threshValSpan);

  const threshSlider = document.createElement("input");
  threshSlider.type = "range";
  threshSlider.min = "0";
  threshSlider.max = "255";
  threshSlider.value = "128";
  threshSlider.className = "form-range";
  threshSlider.addEventListener("input", () => {
    threshValSpan.textContent = threshSlider.value;
  });

  threshGroup.appendChild(threshLabelRow);
  threshGroup.appendChild(threshSlider);

  const prepTip = document.createElement("p");
  prepTip.className = "help-text";
  prepTip.appendChild(createIcon("i-info"));
  prepTip.appendChild(
    document.createTextNode(" Tip: choose Fixed threshold for text, logos and certificates; choose Halftone for photos.")
  );

  step4.appendChild(prepSelect);
  step4.appendChild(threshGroup);
  step4.appendChild(prepTip);
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
  submitBtn.appendChild(document.createTextNode(" Generate shares"));
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
  emptyH3.textContent = "Your shares will appear here";
  emptyState.appendChild(emptyH3);
  const emptyP = document.createElement("p");
  emptyP.className = "help-text";
  emptyP.textContent = "Upload an image and press Generate shares.";
  emptyState.appendChild(emptyP);

  resultsCol.appendChild(emptyState);
  layout.appendChild(resultsCol);
  panel.appendChild(layout);

  // Form Submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(errorSlot, null);

    if (!selectedFile) {
      showError(errorSlot, "Please choose a file before generating shares.");
      return;
    }

    const mode = radioOverlay.checked ? "overlay" : "xor";
    const n = mode === "overlay" ? 2 : parseInt(xorSelect.value, 10);
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

    setBusy(submitBtn, true, "Generating…");
    submitBtn.disabled = true;
    fileInput.disabled = true;
    radioOverlay.disabled = true;
    radioXor.disabled = true;
    xorSelect.disabled = true;
    prepSelect.disabled = true;
    threshSlider.disabled = true;

    // Show 3 skeleton cards in results area
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
      resultsCol.textContent = "";
      resultsCol.appendChild(emptyState);
      showError(errorSlot, err.message || "Failed to generate shares.");
    } finally {
      setBusy(submitBtn, false);
      submitBtn.disabled = false;
      fileInput.disabled = false;
      radioOverlay.disabled = false;
      radioXor.disabled = false;
      xorSelect.disabled = false;
      prepSelect.disabled = false;
      threshSlider.disabled = false;
    }
  });

  function renderResults(data, mode, n) {
    resultsCol.textContent = "";
    const stamp = getTimestamp();

    const shareObjects = data.shares.map((s) => {
      const b64 = s.png_b64 || s.png_base64;
      return {
        index: s.index,
        blob: base64ToBlob(b64),
        name: getShareFilename(mode, s.index, n, stamp),
        b64,
      };
    });
    const secretB64 = data.secret_png_b64 || data.secret_bw_png_base64;
    const secretBlob = base64ToBlob(secretB64);
    const recB64 = data.reconstruction_png_b64 || data.reconstruction_png_base64;
    const reconstructionBlob = base64ToBlob(recB64);

    setLastRun({
      mode,
      n,
      stamp,
      shares: shareObjects,
      secretBlob,
      reconstructionBlob,
      metrics: data.metrics,
    });

    // Results Header (Section 4.8)
    const headerRow = document.createElement("div");
    headerRow.className = "results-header card";

    const topRow = document.createElement("div");
    topRow.className = "results-header-top";

    const hTitle = document.createElement("h2");
    hTitle.tabIndex = -1;
    hTitle.textContent = "Results";
    topRow.appendChild(hTitle);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn btn-secondary btn-sm";
    clearBtn.appendChild(createIcon("i-trash"));
    clearBtn.appendChild(document.createTextNode(" Clear results"));
    clearBtn.addEventListener("click", () => {
      clearRun();
      resultsCol.textContent = "";
      resultsCol.appendChild(emptyState);
      showToast("Results cleared from this page.", "i-trash");
    });
    topRow.appendChild(clearBtn);
    headerRow.appendChild(topRow);

    const hNote = document.createElement("p");
    hNote.className = "help-text";
    hNote.textContent =
      "Nothing is stored on the server. Results live only in this browser tab until you clear them or close the page.";
    headerRow.appendChild(hNote);

    resultsCol.appendChild(headerRow);

    // Results Sub-tabs (Section 4.9)
    const subtabsNavWrapper = document.createElement("div");
    subtabsNavWrapper.className = "subtabs-nav-wrapper";

    const subtabsNav = document.createElement("nav");
    subtabsNav.className = "subtabs-nav";
    subtabsNav.setAttribute("role", "tablist");
    subtabsNav.setAttribute("aria-label", "Results sub-tabs");

    const tabsDef = [
      { id: "rtab-overview", panelId: "rpanel-overview", label: "Overview", icon: "i-image" },
      { id: "rtab-shares", panelId: "rpanel-shares", label: "Shares", icon: "i-layers" },
      { id: "rtab-metrics", panelId: "rpanel-metrics", label: "Metrics", icon: "i-sliders" },
      { id: "rtab-stack", panelId: "rpanel-stack", label: "Stack demo", icon: "i-eye" },
    ];

    const tabButtons = [];
    const panelElements = [];

    // Panels container
    const panelsWrap = document.createElement("div");

    tabsDef.forEach((td, idx) => {
      const btn = document.createElement("button");
      btn.id = td.id;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-controls", td.panelId);
      btn.setAttribute("aria-selected", idx === 0 ? "true" : "false");
      btn.className = "subtab-btn";
      btn.tabIndex = idx === 0 ? 0 : -1;
      btn.appendChild(createIcon(td.icon));
      btn.appendChild(document.createTextNode(` ${td.label}`));
      subtabsNav.appendChild(btn);
      tabButtons.push(btn);

      const pnl = document.createElement("div");
      pnl.id = td.panelId;
      pnl.setAttribute("role", "tabpanel");
      pnl.setAttribute("aria-labelledby", td.id);
      pnl.className = "subtab-panel";
      pnl.hidden = idx !== 0;
      panelsWrap.appendChild(pnl);
      panelElements.push(pnl);
    });

    subtabsNavWrapper.appendChild(subtabsNav);
    resultsCol.appendChild(subtabsNavWrapper);
    resultsCol.appendChild(panelsWrap);

    // Sub-tab switching
    tabButtons.forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        tabButtons.forEach((b, i) => {
          const isActive = i === idx;
          b.setAttribute("aria-selected", isActive ? "true" : "false");
          b.tabIndex = isActive ? 0 : -1;
          panelElements[i].hidden = !isActive;
        });
      });
    });

    // Populate Overview panel (Section 4.10)
    const pnlOverview = panelElements[0];
    const recSrc = `data:image/png;base64,${recB64}`;
    const sh1Src = `data:image/png;base64,${shareObjects[0].b64}`;

    // Reveal Slider
    const slider = createRevealSlider(recSrc, sh1Src);
    pnlOverview.appendChild(slider);

    // Two cards side by side
    const cardsRow = document.createElement("div");
    cardsRow.className = "overview-cards-grid";

    // Secret card
    const secCard = document.createElement("div");
    secCard.className = "card";
    const secTitle = document.createElement("h3");
    secTitle.className = "card-title";
    secTitle.textContent = "Secret (black-and-white)";
    const secSize = document.createElement("p");
    secSize.className = "help-text font-mono";
    secSize.textContent = `${data.metrics.secret_size.width} × ${data.metrics.secret_size.height} px`;
    const secFrame = createImageFrame(`data:image/png;base64,${secretB64}`, "Secret (black-and-white)");
    secCard.appendChild(secTitle);
    secCard.appendChild(secSize);
    secCard.appendChild(secFrame.frame);
    cardsRow.appendChild(secCard);

    // Reconstruction card
    const recCard = document.createElement("div");
    recCard.className = "card";
    const recTitle = document.createElement("h3");
    recTitle.className = "card-title";
    recTitle.textContent = "Reconstruction (all shares combined)";
    const recSize = document.createElement("p");
    recSize.className = "help-text font-mono";
    recSize.textContent = `${data.metrics.share_size.width} × ${data.metrics.share_size.height} px`;
    const recFrame = createImageFrame(recSrc, "Reconstruction");
    recCard.appendChild(recTitle);
    recCard.appendChild(recSize);
    recCard.appendChild(recFrame.frame);
    renderDownloadBar(reconstructionBlob, mode, recCard, true);
    cardsRow.appendChild(recCard);

    pnlOverview.appendChild(cardsRow);

    // Populate Shares panel (Section 4.11)
    const pnlShares = panelElements[1];
    const sharesGrid = document.createElement("div");
    sharesGrid.className = "shares-grid";

    const shareCheckboxes = [];

    shareObjects.forEach((sh) => {
      const shCard = document.createElement("div");
      shCard.className = "card";

      const topRow = document.createElement("div");
      topRow.className = "stack-controls-row";

      const cbLabel = document.createElement("label");
      cbLabel.className = "form-label text-sm";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.value = String(sh.index);
      cbLabel.appendChild(cb);
      cbLabel.appendChild(document.createTextNode(` Share ${sh.index} of ${n}`));
      topRow.appendChild(cbLabel);

      shCard.appendChild(topRow);
      shareCheckboxes.push(cb);

      const shSrc = `data:image/png;base64,${sh.b64}`;
      const frameObj = createImageFrame(shSrc, `Share ${sh.index} of ${n}`);
      shCard.appendChild(frameObj.frame);

      const sizeP = document.createElement("p");
      sizeP.className = "help-text font-mono";
      sizeP.textContent = `${data.metrics.share_size.width} × ${data.metrics.share_size.height} px`;
      shCard.appendChild(sizeP);

      const noteP = document.createElement("p");
      noteP.className = "help-text";
      noteP.textContent = "Looks flat grey because it is random noise. One share alone reveals nothing.";
      shCard.appendChild(noteP);

      const btnRow = document.createElement("div");
      btnRow.className = "download-btn-row";

      const inspectBtn = document.createElement("button");
      inspectBtn.type = "button";
      inspectBtn.className = "btn btn-secondary btn-sm";
      inspectBtn.appendChild(createIcon("i-zoom"));
      inspectBtn.appendChild(document.createTextNode(" Inspect at 1:1"));
      inspectBtn.addEventListener("click", () => {
        openInspector(shSrc, `Share ${sh.index} of ${n}`, inspectBtn);
      });
      btnRow.appendChild(inspectBtn);

      const dlBtn = document.createElement("button");
      dlBtn.type = "button";
      dlBtn.className = "btn btn-secondary btn-sm";
      dlBtn.appendChild(createIcon("i-download"));
      dlBtn.appendChild(document.createTextNode(" Download PNG"));
      dlBtn.addEventListener("click", () => {
        triggerDownload(sh.blob, sh.name);
      });
      btnRow.appendChild(dlBtn);

      shCard.appendChild(btnRow);
      sharesGrid.appendChild(shCard);
    });

    pnlShares.appendChild(sharesGrid);

    // Below grid buttons
    const actionsRow = document.createElement("div");
    actionsRow.className = "download-btn-row";
    actionsRow.style.marginTop = "16px";

    const combineBtn = document.createElement("button");
    combineBtn.type = "button";
    combineBtn.className = "btn btn-primary";
    combineBtn.appendChild(createIcon("i-shuffle"));
    combineBtn.appendChild(document.createTextNode(" Combine selected shares"));

    const openRecBtn = document.createElement("button");
    openRecBtn.type = "button";
    openRecBtn.className = "btn btn-secondary";
    openRecBtn.appendChild(createIcon("i-link"));
    openRecBtn.appendChild(document.createTextNode(" Open in Reconstruct"));
    openRecBtn.addEventListener("click", () => {
      loadSharesFromRun();
      window.location.hash = "#reconstruct";
    });

    actionsRow.appendChild(combineBtn);
    actionsRow.appendChild(openRecBtn);
    pnlShares.appendChild(actionsRow);

    const combineResultSlot = document.createElement("div");
    pnlShares.appendChild(combineResultSlot);

    combineBtn.addEventListener("click", async () => {
      combineResultSlot.textContent = "";
      const selectedIndices = shareCheckboxes.filter((c) => c.checked).map((c) => parseInt(c.value, 10));

      if (selectedIndices.length === 0) {
        showToast("Please select at least one share.", "i-alert", "warn");
        return;
      }

      setBusy(combineBtn, true, "Combining…");
      try {
        const cfd = new FormData();
        cfd.append("mode", mode);
        cfd.append("n", String(n));
        cfd.append("n_total", String(n));
        selectedIndices.forEach((idx) => {
          const sh = shareObjects.find((s) => s.index === idx);
          if (sh) {
            cfd.append("shares", sh.blob, sh.name);
          }
        });

        const res = await postForm("/api/reconstruct", cfd);

        const card = document.createElement("div");
        card.className = "card";
        card.style.marginTop = "16px";

        const msgBox = document.createElement("div");
        msgBox.className = `alert alert-${res.sufficient ? "info" : "warn"}`;
        msgBox.appendChild(createIcon("i-alert"));
        const msgText = document.createElement("span");
        msgText.textContent = res.message;
        msgBox.appendChild(msgText);
        card.appendChild(msgBox);

        if (!res.sufficient) {
          const extraP = document.createElement("p");
          extraP.className = "help-text";
          extraP.textContent = "A result built from too few shares shows no recognisable secret (FR-7).";
          card.appendChild(extraP);
        }

        const combB64 = res.reconstruction_png_b64 || res.reconstruction_png_base64;
        const resFrame = createImageFrame(`data:image/png;base64,${combB64}`, "Combined shares");
        card.appendChild(resFrame.frame);

        const resBlob = base64ToBlob(combB64);
        renderDownloadBar(resBlob, mode, card, res.sufficient);

        combineResultSlot.appendChild(card);
      } catch (err) {
        showToast(err.message || "Failed to combine shares.", "i-alert", "error");
      } finally {
        setBusy(combineBtn, false);
      }
    });

    // Populate Metrics panel (Section 4.12)
    const pnlMetrics = panelElements[2];
    pnlMetrics.appendChild(renderMetricsPanel(data.metrics));

    // Populate Stack demo panel (Section 4.12)
    const pnlStack = panelElements[3];
    if (mode === "overlay") {
      const s1B64 = shareObjects[0].b64;
      const s2B64 = shareObjects[1] ? shareObjects[1].b64 : "";
      pnlStack.appendChild(renderStackingDemo(s1B64, s2B64));
    } else {
      const xorNotice = document.createElement("div");
      xorNotice.className = "alert alert-info";
      xorNotice.appendChild(createIcon("i-info"));
      const span = document.createElement("span");
      span.textContent = "Stacking by hand applies to Overlay mode. XOR shares are combined by computation, not by overlaying.";
      xorNotice.appendChild(span);
      pnlStack.appendChild(xorNotice);
    }

    // Smooth scroll and focus (Section 4.7)
    headerRow.scrollIntoView({ behavior: "smooth", block: "start" });
    hTitle.focus();
  }
}

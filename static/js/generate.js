/**
 * Generate tab module (FR-1, FR-3, FR-4, FR-5, FR-8).
 */
import { postForm } from "./api.js";
import {
  el,
  base64ToBlob,
  downloadBlob,
  setBusy,
  showError,
  checkImagePixelation,
  renderMetricsPanel,
} from "./ui.js";
import { renderStackingDemo } from "./stacking.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTS = ["png", "jpg", "jpeg", "bmp"];

export function init() {
  const panel = document.getElementById("panel-generate");
  if (!panel) return;

  panel.textContent = "";

  // Intro text
  const intro = el(
    "p",
    { className: "intro-text" },
    "Upload a secret image. The system turns it into noise-like shares. The secret appears only when the required shares are combined."
  );
  panel.appendChild(intro);

  const form = el("form", { id: "generate-form" });

  // 1. Upload Zone
  const uploadSec = el("div", { className: "form-group" });
  uploadSec.appendChild(el("label", { className: "form-label" }, "1. Secret Image Upload"));

  const dropZone = el("div", { className: "drop-zone", tabindex: "0" });
  const fileInput = el("input", {
    type: "file",
    accept: ".png,.jpg,.jpeg,.bmp",
    id: "gen-file-input",
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
      generateBtn.disabled = true;
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
      generateBtn.disabled = true;
    });

    previewCard.appendChild(thumb);
    previewCard.appendChild(info);
    previewCard.appendChild(removeBtn);
    filePreviewArea.appendChild(previewCard);

    generateBtn.disabled = false;
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

  // 2. Mode Radio Cards
  const modeSec = el("div", { className: "form-group" });
  modeSec.appendChild(el("label", { className: "form-label" }, "2. Cryptographic Scheme"));

  const radioGroup = el("div", { className: "radio-cards-group" });

  const cardOverlay = el("label", { className: "radio-card selected" });
  const radioOverlay = el("input", {
    type: "radio",
    name: "gen-mode",
    value: "overlay",
    checked: true,
  });
  cardOverlay.appendChild(radioOverlay);
  cardOverlay.appendChild(
    el("div", { className: "radio-card-title" }, "Overlay 2-out-of-2 (P1)")
  );
  cardOverlay.appendChild(
    el(
      "div",
      { className: "radio-card-desc" },
      "Each secret pixel becomes a 2×2 block of subpixels in each of two shares. Stacking both shares reveals the secret; one share alone looks like random noise. Cost: the result is dimmer (relative difference 1/2) and each share has 4× the pixels."
    )
  );

  const cardXor = el("label", { className: "radio-card" });
  const radioXor = el("input", {
    type: "radio",
    name: "gen-mode",
    value: "xor",
  });
  cardXor.appendChild(radioXor);
  cardXor.appendChild(el("div", { className: "radio-card-title" }, "XOR (n,n) (P6)"));
  cardXor.appendChild(
    el(
      "div",
      { className: "radio-card-desc" },
      "No pixel expansion. All n shares combined by XOR give the secret exactly; fewer than n reveal nothing. Cost: decoding needs a computation, not just the eye."
    )
  );

  radioGroup.appendChild(cardOverlay);
  radioGroup.appendChild(cardXor);
  modeSec.appendChild(radioGroup);
  form.appendChild(modeSec);

  // 3. Number of Shares
  const sharesSec = el("div", { className: "form-group" });
  sharesSec.appendChild(el("label", { className: "form-label" }, "3. Number of Shares"));

  const sharesOverlaySpan = el(
    "div",
    { className: "form-control font-mono text-sm", id: "gen-shares-overlay" },
    "2 shares"
  );
  const sharesXorSelect = el(
    "select",
    { className: "form-control", id: "gen-shares-xor", hidden: true },
    [
      el("option", { value: "2", selected: true }, "2 shares"),
      el("option", { value: "3" }, "3 shares"),
      el("option", { value: "4" }, "4 shares"),
      el("option", { value: "5" }, "5 shares"),
      el("option", { value: "6" }, "6 shares"),
    ]
  );

  sharesSec.appendChild(sharesOverlaySpan);
  sharesSec.appendChild(sharesXorSelect);
  form.appendChild(sharesSec);

  function updateModeSelection(mode) {
    if (mode === "overlay") {
      cardOverlay.classList.add("selected");
      cardXor.classList.remove("selected");
      sharesOverlaySpan.hidden = false;
      sharesXorSelect.hidden = true;
    } else {
      cardOverlay.classList.remove("selected");
      cardXor.classList.add("selected");
      sharesOverlaySpan.hidden = true;
      sharesXorSelect.hidden = false;
    }
  }

  radioOverlay.addEventListener("change", () => updateModeSelection("overlay"));
  radioXor.addEventListener("change", () => updateModeSelection("xor"));

  // 4. Preprocessing
  const prepSec = el("div", { className: "form-group" });
  prepSec.appendChild(el("label", { className: "form-label" }, "4. Preprocessing Method"));

  const prepSelect = el("select", { className: "form-control", id: "gen-prep-select" }, [
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

  // Error Alert Container
  const errorContainer = el("div", { className: "error-container", role: "region" });
  form.appendChild(errorContainer);

  // 5. Generate Button
  const generateBtn = el(
    "button",
    { type: "submit", className: "btn-primary", disabled: true },
    "Generate shares"
  );
  form.appendChild(generateBtn);

  panel.appendChild(form);

  // Results Container
  const resultsContainer = el("div", { className: "results-container", "aria-live": "polite" });
  panel.appendChild(resultsContainer);

  // Form submit handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    showError(errorContainer, null);
    resultsContainer.textContent = "";
    setBusy(generateBtn, true, "Generating…");

    const mode = radioOverlay.checked ? "overlay" : "xor";
    const n = mode === "overlay" ? 2 : parseInt(sharesXorSelect.value, 10);
    const preprocess = prepSelect.value;
    const threshold = parseInt(rangeInput.value, 10);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("mode", mode);
    formData.append("n", String(n));
    formData.append("preprocess", preprocess);
    formData.append("threshold", String(threshold));

    try {
      const data = await postForm("/api/generate", formData);
      renderResults(data);
    } catch (err) {
      showError(errorContainer, err.message);
    } finally {
      setBusy(generateBtn, false);
    }
  });

  function renderResults(data) {
    resultsContainer.textContent = "";

    const resultsTitle = el("h2", {}, "Generated Results");
    resultsContainer.appendChild(resultsTitle);

    // Row of Secret and Combined Reconstruction
    const overviewGrid = el("div", { className: "results-grid" });

    // Secret Card
    const secretCard = el("div", { className: "result-card" });
    secretCard.appendChild(
      el("div", { className: "result-card-header" }, "Secret (black-and-white)")
    );
    const secretImgWrapper = el("div", { className: "result-img-wrapper" });
    const secretImg = el("img", {
      src: `data:image/png;base64,${data.secret_png_b64}`,
      alt: "Preprocessed secret image",
    });
    checkImagePixelation(secretImg);
    secretImgWrapper.appendChild(secretImg);
    secretCard.appendChild(secretImgWrapper);
    secretCard.appendChild(
      el(
        "div",
        { className: "result-card-footer" },
        `${data.metrics.secret_size.width} × ${data.metrics.secret_size.height} px`
      )
    );
    overviewGrid.appendChild(secretCard);

    // Reconstruction Card
    const recCard = el("div", { className: "result-card" });
    recCard.appendChild(
      el("div", { className: "result-card-header" }, "Reconstruction (all shares combined)")
    );
    const recImgWrapper = el("div", { className: "result-img-wrapper" });
    const recImg = el("img", {
      src: `data:image/png;base64,${data.reconstruction_png_b64}`,
      alt: "Reconstructed secret image from all shares",
    });
    checkImagePixelation(recImg);
    recImgWrapper.appendChild(recImg);
    recCard.appendChild(recImgWrapper);
    recCard.appendChild(
      el(
        "div",
        { className: "result-card-footer" },
        `${data.metrics.share_size.width} × ${data.metrics.share_size.height} px`
      )
    );
    overviewGrid.appendChild(recCard);

    resultsContainer.appendChild(overviewGrid);

    // Share Cards Heading
    resultsContainer.appendChild(el("h3", {}, "Individual Shares"));

    const sharesGrid = el("div", { className: "results-grid" });
    const shareCheckboxes = [];

    data.shares.forEach((share) => {
      const card = el("div", { className: "result-card" });

      const header = el("div", { className: "result-card-header" });
      const cbLabel = el("label", { className: "checkbox-label" });
      const cb = el("input", { type: "checkbox", checked: true });
      shareCheckboxes.push({ index: share.index, cb, png_b64: share.png_b64 });
      cbLabel.appendChild(cb);
      cbLabel.appendChild(
        el("span", {}, `Share ${share.index} of ${data.n}`)
      );
      header.appendChild(cbLabel);
      card.appendChild(header);

      const imgWrapper = el("div", { className: "result-img-wrapper" });
      const img = el("img", {
        src: `data:image/png;base64,${share.png_b64}`,
        alt: `Share ${share.index} of ${data.n}`,
      });
      checkImagePixelation(img);
      imgWrapper.appendChild(img);
      card.appendChild(imgWrapper);

      const footer = el("div", { className: "result-card-footer" });
      footer.appendChild(
        el("span", {}, `${share.width} × ${share.height} px`)
      );

      const downloadBtn = el(
        "button",
        { type: "button", className: "btn-secondary btn-sm" },
        "Download PNG"
      );
      downloadBtn.addEventListener("click", () => {
        const blob = base64ToBlob(share.png_b64, "image/png");
        downloadBlob(blob, `share_${data.mode}_${share.index}_of_${data.n}.png`);
      });
      footer.appendChild(downloadBtn);
      card.appendChild(footer);

      sharesGrid.appendChild(card);
    });

    resultsContainer.appendChild(sharesGrid);

    // Combine Selected Shares Section
    const combineSec = el("div", { className: "card" });
    combineSec.appendChild(el("h3", { className: "card-title" }, "Combine Selected Shares"));
    combineSec.appendChild(
      el(
        "p",
        { className: "help-text" },
        "Select any subset of shares using the checkboxes above to test reconstruction."
      )
    );

    const combineBtn = el(
      "button",
      { type: "button", className: "btn-secondary" },
      "Combine selected shares"
    );
    combineSec.appendChild(combineBtn);

    const combineResultArea = el("div", {
      className: "combine-result-area",
      role: "region",
      "aria-live": "polite",
    });
    combineSec.appendChild(combineResultArea);

    combineBtn.addEventListener("click", async () => {
      const selected = shareCheckboxes.filter((item) => item.cb.checked);
      combineResultArea.textContent = "";

      if (selected.length === 0) {
        combineResultArea.appendChild(
          el("div", { className: "alert alert-error", role: "alert" }, "Please select at least one share.")
        );
        return;
      }

      setBusy(combineBtn, true, "Combining…");
      const cFormData = new FormData();
      selected.forEach((item) => {
        const blob = base64ToBlob(item.png_b64, "image/png");
        cFormData.append("shares", blob, `share_${item.index}.png`);
      });
      cFormData.append("mode", data.mode);
      cFormData.append("n_total", String(data.n));

      try {
        const recData = await postForm("/api/reconstruct", cFormData);
        const alertClass = recData.sufficient ? "alert alert-info" : "alert alert-warn";
        const msgBox = el("div", { className: alertClass, role: "status" }, recData.message);
        combineResultArea.appendChild(msgBox);

        const imgCard = el("div", { className: "result-card" });
        const cImgWrapper = el("div", { className: "result-img-wrapper" });
        const cImg = el("img", {
          src: `data:image/png;base64,${recData.reconstruction_png_b64}`,
          alt: "Combination result of selected shares",
        });
        checkImagePixelation(cImg);
        cImgWrapper.appendChild(cImg);
        imgCard.appendChild(cImgWrapper);
        imgCard.appendChild(
          el("div", { className: "result-card-footer" }, `${recData.width} × ${recData.height} px`)
        );
        combineResultArea.appendChild(imgCard);
      } catch (err) {
        combineResultArea.appendChild(
          el("div", { className: "alert alert-error", role: "alert" }, err.message)
        );
      } finally {
        setBusy(combineBtn, false);
      }
    });

    resultsContainer.appendChild(combineSec);

    // Metrics Panel
    resultsContainer.appendChild(renderMetricsPanel(data.metrics));

    // Stacking Demo (overlay mode only, n = 2)
    if (data.mode === "overlay" && data.n === 2 && data.shares.length >= 2) {
      resultsContainer.appendChild(
        renderStackingDemo(data.shares[0].png_b64, data.shares[1].png_b64)
      );
    }
  }
}

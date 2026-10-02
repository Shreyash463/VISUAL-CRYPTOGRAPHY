/**
 * Reconstruct tab module (FR-6, FR-7).
 */
import { postForm } from "./api.js";
import { el, setBusy, showError, checkImagePixelation } from "./ui.js";

const MAX_SHARE_BYTES = 2 * 1024 * 1024; // 2 MB

export function init() {
  const panel = document.getElementById("panel-reconstruct");
  if (!panel) return;

  panel.textContent = "";

  const intro = el(
    "p",
    { className: "intro-text" },
    "Already have shares? Upload them here and the system combines them."
  );
  panel.appendChild(intro);

  const form = el("form", { id: "reconstruct-form" });

  // 1. Multi-file Drop Zone
  const uploadSec = el("div", { className: "form-group" });
  uploadSec.appendChild(el("label", { className: "form-label" }, "1. Select Share PNG Files"));

  const dropZone = el("div", { className: "drop-zone", tabindex: "0" });
  const fileInput = el("input", {
    type: "file",
    accept: ".png",
    multiple: true,
    id: "rec-file-input",
  });
  dropZone.appendChild(fileInput);

  const dropZoneContent = el("div", { className: "drop-zone-content" }, [
    el("p", { className: "text-sm" }, "Drag and drop share PNG files here, or click to browse"),
    el("span", { className: "btn-secondary btn-sm" }, "Choose Files"),
    el("span", { className: "help-text" }, "Lossless binary PNG shares only (max 2 MB each)"),
  ]);
  dropZone.appendChild(dropZoneContent);

  const fileListArea = el("div", { className: "files-list" });
  uploadSec.appendChild(dropZone);
  uploadSec.appendChild(fileListArea);
  form.appendChild(uploadSec);

  let selectedFiles = [];

  function updateFileList() {
    fileListArea.textContent = "";
    selectedFiles.forEach((file, idx) => {
      const item = el("div", { className: "file-item" });
      item.appendChild(
        el("span", { className: "file-preview-name" }, `${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
      );

      const removeBtn = el(
        "button",
        { type: "button", className: "btn-secondary btn-sm" },
        "Remove"
      );
      removeBtn.addEventListener("click", () => {
        selectedFiles.splice(idx, 1);
        updateFileList();
      });
      item.appendChild(removeBtn);
      fileListArea.appendChild(item);
    });

    reconstructBtn.disabled = selectedFiles.length === 0;
  }

  function handleFiles(files) {
    showError(errorContainer, null);
    let hasError = false;

    for (const file of Array.from(files)) {
      const name = file.name || "";
      const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
      if (ext !== "png") {
        showError(errorContainer, `File "${file.name}" rejected: only PNG shares are accepted.`);
        hasError = true;
        continue;
      }
      if (file.size > MAX_SHARE_BYTES) {
        showError(errorContainer, `File "${file.name}" rejected: share file exceeds 2 MB limit.`);
        hasError = true;
        continue;
      }
      selectedFiles.push(file);
    }

    if (!hasError) {
      showError(errorContainer, null);
    }
    updateFileList();
  }

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files) {
      handleFiles(fileInput.files);
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
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // 2. Mode Radio
  const modeSec = el("div", { className: "form-group" });
  modeSec.appendChild(el("label", { className: "form-label" }, "2. Reconstruction Mode"));

  const radioRow = el("div", { className: "stack-controls-row" });
  const radioOverlayLabel = el("label", { className: "checkbox-label" });
  const radioOverlay = el("input", {
    type: "radio",
    name: "rec-mode",
    value: "overlay",
    checked: true,
  });
  radioOverlayLabel.appendChild(radioOverlay);
  radioOverlayLabel.appendChild(document.createTextNode(" Overlay 2-out-of-2"));

  const radioXorLabel = el("label", { className: "checkbox-label" });
  const radioXor = el("input", {
    type: "radio",
    name: "rec-mode",
    value: "xor",
  });
  radioXorLabel.appendChild(radioXor);
  radioXorLabel.appendChild(document.createTextNode(" XOR (n,n)"));

  radioRow.appendChild(radioOverlayLabel);
  radioRow.appendChild(radioXorLabel);
  modeSec.appendChild(radioRow);
  form.appendChild(modeSec);

  // 3. Total shares n
  const totalNSec = el("div", { className: "form-group" });
  totalNSec.appendChild(el("label", { className: "form-label" }, "3. Total Shares in Scheme (n)"));

  const nOverlaySpan = el("div", { className: "form-control font-mono text-sm" }, "2 shares");
  const nXorSelect = el("select", { className: "form-control", hidden: true }, [
    el("option", { value: "2", selected: true }, "2 shares"),
    el("option", { value: "3" }, "3 shares"),
    el("option", { value: "4" }, "4 shares"),
    el("option", { value: "5" }, "5 shares"),
    el("option", { value: "6" }, "6 shares"),
  ]);

  totalNSec.appendChild(nOverlaySpan);
  totalNSec.appendChild(nXorSelect);
  form.appendChild(totalNSec);

  function updateRecMode() {
    if (radioOverlay.checked) {
      nOverlaySpan.hidden = false;
      nXorSelect.hidden = true;
    } else {
      nOverlaySpan.hidden = true;
      nXorSelect.hidden = false;
    }
  }

  radioOverlay.addEventListener("change", updateRecMode);
  radioXor.addEventListener("change", updateRecMode);

  // Error container
  const errorContainer = el("div", { className: "error-container", role: "region" });
  form.appendChild(errorContainer);

  // 4. Submit button
  const reconstructBtn = el(
    "button",
    { type: "submit", className: "btn-primary", disabled: true },
    "Reconstruct"
  );
  form.appendChild(reconstructBtn);

  panel.appendChild(form);

  // Results area
  const resultsContainer = el("div", { className: "results-container", "aria-live": "polite" });
  panel.appendChild(resultsContainer);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    showError(errorContainer, null);
    resultsContainer.textContent = "";
    setBusy(reconstructBtn, true, "Reconstructing…");

    const mode = radioOverlay.checked ? "overlay" : "xor";
    const nTotal = mode === "overlay" ? 2 : parseInt(nXorSelect.value, 10);

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("shares", file, file.name);
    });
    formData.append("mode", mode);
    formData.append("n_total", String(nTotal));

    try {
      const data = await postForm("/api/reconstruct", formData);
      renderReconstructResult(data);
    } catch (err) {
      showError(errorContainer, err.message);
    } finally {
      setBusy(reconstructBtn, false);
    }
  });

  function renderReconstructResult(data) {
    resultsContainer.textContent = "";
    resultsContainer.appendChild(el("h2", {}, "Reconstruction Result"));

    const card = el("div", { className: "result-card" });

    // Combined image at top
    const imgWrapper = el("div", { className: "result-img-wrapper" });
    const img = el("img", {
      src: `data:image/png;base64,${data.reconstruction_png_b64}`,
      alt: "Combined reconstruction result",
    });
    checkImagePixelation(img);
    imgWrapper.appendChild(img);
    card.appendChild(imgWrapper);

    card.appendChild(
      el("div", { className: "result-card-footer" }, `${data.width} × ${data.height} px`)
    );
    resultsContainer.appendChild(card);

    // Message
    if (!data.sufficient) {
      const warnBox = el(
        "div",
        { className: "alert alert-warn", role: "status" },
        `${data.message} A result built from too few shares shows no recognisable secret (FR-7).`
      );
      resultsContainer.appendChild(warnBox);
    } else {
      const infoBox = el(
        "div",
        { className: "alert alert-info", role: "status" },
        data.message
      );
      resultsContainer.appendChild(infoBox);
    }

    // Alignment note
    const note = el(
      "p",
      { className: "help-text" },
      "Shares must come from the same run and have identical dimensions so they align pixel by pixel (C-5)."
    );
    resultsContainer.appendChild(note);
  }
}

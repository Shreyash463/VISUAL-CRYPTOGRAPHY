/**
 * Reconstruction download module with viewing copy generator (Section 5).
 */
import { showToast } from "./toast.js";

export function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function getShareFilename(mode, i, n, stamp) {
  return `share_${mode}_${i}_of_${n}_${stamp}.png`;
}

export function getReconstructionFilename(mode, viewing = false, stamp = null) {
  const s = stamp || getTimestamp();
  return viewing ? `reconstruction_${mode}_viewing_${s}.png` : `reconstruction_${mode}_${s}.png`;
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
  }, 1000);
  showToast(`Downloaded ${filename}`, "i-download");
}

export function makeViewingCopy(pngBlob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(pngBlob);
    img.onload = () => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}

      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w % 2 !== 0 || h % 2 !== 0) {
        showToast("Viewing copy is available for overlay results only.", "i-alert", "error");
        reject(new Error("Viewing copy is available for overlay results only."));
        return;
      }

      const canvasIn = document.createElement("canvas");
      canvasIn.width = w;
      canvasIn.height = h;
      const ctxIn = canvasIn.getContext("2d");
      ctxIn.drawImage(img, 0, 0);
      const imgData = ctxIn.getImageData(0, 0, w, h);
      const data = imgData.data;

      const outW = w / 2;
      const outH = h / 2;
      const canvasOut = document.createElement("canvas");
      canvasOut.width = outW;
      canvasOut.height = outH;
      const ctxOut = canvasOut.getContext("2d");
      const outImgData = ctxOut.createImageData(outW, outH);
      const outData = outImgData.data;

      for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) {
          let whiteCount = 0;
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const inIdx = ((y * 2 + dy) * w + (x * 2 + dx)) * 4;
              if (data[inIdx] >= 128) {
                whiteCount++;
              }
            }
          }
          const light = whiteCount / 4;
          const pixelVal = Math.min(255, Math.round(510 * light));
          const outIdx = (y * outW + x) * 4;
          outData[outIdx] = pixelVal;
          outData[outIdx + 1] = pixelVal;
          outData[outIdx + 2] = pixelVal;
          outData[outIdx + 3] = 255;
        }
      }

      ctxOut.putImageData(outImgData, 0, 0);
      canvasOut.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create viewing copy blob."));
        }
      }, "image/png");
    };

    img.onerror = () => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
      reject(new Error("Failed to load image for viewing copy."));
    };

    img.src = url;
  });
}

function createIcon(id) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${id}`);
  svg.appendChild(use);
  return svg;
}

export function renderDownloadBar(blob, mode, containerEl, sufficient = true) {
  const bar = document.createElement("div");
  bar.className = "download-bar card";

  const btnRow = document.createElement("div");
  btnRow.className = "download-btn-row";

  if (mode === "overlay") {
    const btnStacked = document.createElement("button");
    btnStacked.type = "button";
    btnStacked.className = "btn btn-primary";
    btnStacked.appendChild(createIcon("i-download"));
    btnStacked.appendChild(document.createTextNode(" Download stacked PNG (exact, 2× size)"));

    const btnViewing = document.createElement("button");
    btnViewing.type = "button";
    btnViewing.className = "btn btn-secondary";
    btnViewing.appendChild(createIcon("i-image"));
    btnViewing.appendChild(document.createTextNode(" Download viewing copy (original size)"));

    if (sufficient) {
      btnStacked.addEventListener("click", () => {
        const stamp = getTimestamp();
        triggerDownload(blob, `reconstruction_overlay_${stamp}.png`);
      });

      btnViewing.addEventListener("click", async () => {
        try {
          const viewingBlob = await makeViewingCopy(blob);
          const stamp = getTimestamp();
          triggerDownload(viewingBlob, `reconstruction_overlay_viewing_${stamp}.png`);
        } catch (err) {
          showToast(err.message || "Failed to generate viewing copy.", "i-alert", "error");
        }
      });
    } else {
      btnStacked.disabled = true;
      btnStacked.setAttribute("aria-disabled", "true");
      btnViewing.disabled = true;
      btnViewing.setAttribute("aria-disabled", "true");
    }

    btnRow.appendChild(btnStacked);
    btnRow.appendChild(btnViewing);
    bar.appendChild(btnRow);

    const helpP = document.createElement("p");
    helpP.className = "help-text";
    helpP.textContent =
      "The stacked file is the faithful result of overlaying the shares. The viewing copy is made in your browser: each 2×2 block is averaged to one pixel and contrast is doubled for easier reading. It is a display convenience; contrast loss is still reported in the metrics (C-1).";
    bar.appendChild(helpP);
  } else {
    const btnXor = document.createElement("button");
    btnXor.type = "button";
    btnXor.className = "btn btn-primary";
    btnXor.appendChild(createIcon("i-download"));
    btnXor.appendChild(document.createTextNode(" Download reconstruction PNG (exact)"));

    if (sufficient) {
      btnXor.addEventListener("click", () => {
        const stamp = getTimestamp();
        triggerDownload(blob, `reconstruction_xor_${stamp}.png`);
      });
    } else {
      btnXor.disabled = true;
      btnXor.setAttribute("aria-disabled", "true");
    }

    btnRow.appendChild(btnXor);
    bar.appendChild(btnRow);
  }

  if (sufficient) {
    const alertRow = document.createElement("div");
    alertRow.className = "alert alert-info";
    alertRow.appendChild(createIcon("i-alert"));
    const span = document.createElement("span");
    span.textContent = " This file contains the revealed secret. Store or share it carefully.";
    alertRow.appendChild(span);
    bar.appendChild(alertRow);
  } else {
    const disabledNote = document.createElement("div");
    disabledNote.className = "alert alert-warn";
    disabledNote.appendChild(createIcon("i-alert"));
    const span = document.createElement("span");
    span.textContent = " Download is available only when all required shares are combined.";
    disabledNote.appendChild(span);
    bar.appendChild(disabledNote);
  }

  containerEl.appendChild(bar);
  return bar;
}

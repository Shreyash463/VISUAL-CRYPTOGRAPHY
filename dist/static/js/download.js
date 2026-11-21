/**
 * Reconstruction download module with viewing copy generator and ZIP share packager.
 */
import { showToast } from "./toast.js";

export function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function getShareFilename(mode, i, n, stamp, group = null) {
  if (group) {
    return `vc-${mode}-${group}-share${i}-of-${n}.png`;
  }
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

// Pure JS CRC32 implementation
function makeCrcTable() {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  return table;
}
const crcTable = makeCrcTable();

function computeCrc32(uint8arr) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < uint8arr.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ uint8arr[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

/**
 * Create an uncompressed (Store) ZIP Blob from a list of { name: string, blob: Blob }.
 */
export async function createZipBlob(files) {
  const fileDataList = [];
  for (const f of files) {
    const arrayBuffer = await f.blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const enc = new TextEncoder();
    const nameBytes = enc.encode(f.name);
    const crc = computeCrc32(data);
    fileDataList.push({ nameBytes, data, crc, size: data.length });
  }

  const parts = [];
  const entries = [];
  let offset = 0;

  for (const item of fileDataList) {
    const local = new Uint8Array(30 + item.nameBytes.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true); // Store
    view.setUint32(10, 0, true); // time/date
    view.setUint32(14, item.crc, true);
    view.setUint32(18, item.size, true);
    view.setUint32(22, item.size, true);
    view.setUint16(26, item.nameBytes.length, true);
    view.setUint16(28, 0, true);
    local.set(item.nameBytes, 30);

    parts.push(local, item.data);
    entries.push({ nameBytes: item.nameBytes, size: item.size, crc: item.crc, offset });
    offset += local.length + item.size;
  }

  const cdOffset = offset;
  let cdSize = 0;

  for (const entry of entries) {
    const cd = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(cd.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint32(12, 0, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.size, true);
    view.setUint32(24, entry.size, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint32(36, 0, true);
    view.setUint32(42, entry.offset, true);
    cd.set(entry.nameBytes, 46);

    parts.push(cd);
    cdSize += cd.length;
  }

  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entries.length, true);
  view.setUint16(10, entries.length, true);
  view.setUint32(12, cdSize, true);
  view.setUint32(16, cdOffset, true);
  view.setUint16(20, 0, true);

  parts.push(eocd);
  return new Blob(parts, { type: "application/zip" });
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

  const isOverlay = mode === "overlay" || mode === "color_overlay";

  if (isOverlay) {
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
        triggerDownload(blob, `reconstruction_${mode}_${stamp}.png`);
      });

      btnViewing.addEventListener("click", async () => {
        try {
          const viewingBlob = await makeViewingCopy(blob);
          const stamp = getTimestamp();
          triggerDownload(viewingBlob, `reconstruction_${mode}_viewing_${stamp}.png`);
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
      "The reconstructed file represents the combined secret. Lossless PNG format ensures subpixels and colour channels remain intact without JPEG compression artifacts.";
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
        triggerDownload(blob, `reconstruction_${mode}_${stamp}.png`);
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

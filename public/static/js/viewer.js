/**
 * Shared viewer utilities, Fit control, Reveal slider, and Inspector dialog (Section 6).
 */

function createIcon(id) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${id}`);
  svg.appendChild(use);
  return svg;
}

export function checkPixelation(img) {
  const update = () => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      if (img.clientWidth > img.naturalWidth || img.clientHeight > img.naturalHeight) {
        img.classList.add("pixelated");
      } else {
        img.classList.remove("pixelated");
      }
    }
  };

  if (img.complete) {
    update();
  } else {
    img.addEventListener("load", update, { once: true });
  }

  window.addEventListener("resize", update);
}

export function createImageFrame(src, alt = "") {
  const frame = document.createElement("div");
  frame.className = "image-frame";

  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;

  checkPixelation(img);
  frame.appendChild(img);

  return { frame, img };
}

export function createFitControl(img, scrollContainer) {
  const wrapper = document.createElement("div");
  wrapper.className = "fit-control-segmented";

  const btnFit = document.createElement("button");
  btnFit.type = "button";
  btnFit.className = "btn-segmented active";
  btnFit.setAttribute("aria-pressed", "true");
  btnFit.textContent = "Fit width";

  const btnActual = document.createElement("button");
  btnActual.type = "button";
  btnActual.className = "btn-segmented";
  btnActual.setAttribute("aria-pressed", "false");
  btnActual.textContent = "100%";

  btnFit.addEventListener("click", () => {
    btnFit.classList.add("active");
    btnFit.setAttribute("aria-pressed", "true");
    btnActual.classList.remove("active");
    btnActual.setAttribute("aria-pressed", "false");

    scrollContainer.classList.remove("scroll-actual");
    img.style.maxWidth = "100%";
    img.style.width = "auto";
  });

  btnActual.addEventListener("click", () => {
    btnActual.classList.add("active");
    btnActual.setAttribute("aria-pressed", "true");
    btnFit.classList.remove("active");
    btnFit.setAttribute("aria-pressed", "false");

    scrollContainer.classList.add("scroll-actual");
    img.style.maxWidth = "none";
    if (img.naturalWidth > 0) {
      img.style.width = `${img.naturalWidth}px`;
    }
  });

  wrapper.appendChild(btnFit);
  wrapper.appendChild(btnActual);
  return wrapper;
}

export function createRevealSlider(baseSrc, overlaySrc, altBase = "All shares combined", altOverlay = "Share 1 alone") {
  const container = document.createElement("div");
  container.className = "reveal-container";

  const stage = document.createElement("div");
  stage.className = "reveal-stage";
  stage.style.setProperty("--pos", "50%");

  const baseImg = document.createElement("img");
  baseImg.className = "reveal-base-img";
  baseImg.src = baseSrc;
  baseImg.alt = altBase;
  checkPixelation(baseImg);

  const overlayWrap = document.createElement("div");
  overlayWrap.className = "reveal-overlay-wrap";

  const overlayImg = document.createElement("img");
  overlayImg.className = "reveal-overlay-img";
  overlayImg.src = overlaySrc;
  overlayImg.alt = altOverlay;
  checkPixelation(overlayImg);

  overlayWrap.appendChild(overlayImg);

  const divider = document.createElement("div");
  divider.className = "reveal-divider";

  const badgeLeft = document.createElement("span");
  badgeLeft.className = "reveal-badge reveal-badge-left";
  badgeLeft.textContent = "Share 1 alone (noise)";

  const badgeRight = document.createElement("span");
  badgeRight.className = "reveal-badge reveal-badge-right";
  badgeRight.textContent = "All shares combined";

  stage.appendChild(baseImg);
  stage.appendChild(overlayWrap);
  stage.appendChild(divider);
  stage.appendChild(badgeLeft);
  stage.appendChild(badgeRight);

  const controlRow = document.createElement("div");
  controlRow.className = "reveal-control-row";

  const range = document.createElement("input");
  range.type = "range";
  range.min = "0";
  range.max = "100";
  range.value = "50";
  range.className = "form-range reveal-range";
  range.setAttribute("aria-label", "Drag to compare Share 1 alone with all shares combined");

  const label = document.createElement("p");
  label.className = "help-text";
  label.textContent = "Drag to compare Share 1 alone with all shares combined";

  range.addEventListener("input", () => {
    stage.style.setProperty("--pos", `${range.value}%`);
  });

  controlRow.appendChild(range);
  controlRow.appendChild(label);

  container.appendChild(stage);
  container.appendChild(controlRow);

  return container;
}

export function openInspector(imgSrc, title = "Inspect at 1:1", triggerEl = null) {
  const dialog = document.getElementById("inspector-dialog");
  if (!dialog) return;

  dialog.textContent = "";

  const header = document.createElement("div");
  header.className = "dialog-header";

  const h3 = document.createElement("h3");
  h3.textContent = title;
  header.appendChild(h3);

  const zoomRow = document.createElement("div");
  zoomRow.className = "dialog-zoom-row";

  let currentZoom = 1;
  const zoomBtns = [1, 2, 4].map((z) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn-segmented ${z === currentZoom ? "active" : ""}`;
    btn.setAttribute("aria-pressed", z === currentZoom ? "true" : "false");
    btn.textContent = `${z}×`;
    return { z, btn };
  });

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn btn-secondary btn-sm";
  closeBtn.appendChild(createIcon("i-x"));
  closeBtn.appendChild(document.createTextNode(" Close"));

  zoomBtns.forEach(({ btn }) => zoomRow.appendChild(btn));
  header.appendChild(zoomRow);
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  const body = document.createElement("div");
  body.className = "dialog-body";

  const scrollWrap = document.createElement("div");
  scrollWrap.className = "dialog-scroll-wrap";

  const img = document.createElement("img");
  img.src = imgSrc;
  img.alt = title;
  img.className = "pixelated";

  function applyZoom() {
    if (img.naturalWidth > 0) {
      img.style.width = `${img.naturalWidth * currentZoom}px`;
    }
  }

  img.addEventListener("load", applyZoom);

  zoomBtns.forEach(({ z, btn }) => {
    btn.addEventListener("click", () => {
      currentZoom = z;
      zoomBtns.forEach(({ btn: b, z: bz }) => {
        const isActive = bz === currentZoom;
        if (isActive) {
          b.classList.add("active");
        } else {
          b.classList.remove("active");
        }
        b.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      applyZoom();
    });
  });

  scrollWrap.appendChild(img);
  body.appendChild(scrollWrap);

  const note = document.createElement("p");
  note.className = "help-text";
  note.textContent =
    "Zoom in to see the individual subpixels. A single share is random noise and reveals no information about the secret.";
  body.appendChild(note);

  dialog.appendChild(body);

  const handleClose = () => {
    dialog.close();
    if (triggerEl && typeof triggerEl.focus === "function") {
      triggerEl.focus();
    }
  };

  closeBtn.addEventListener("click", handleClose);

  dialog.addEventListener("click", (e) => {
    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!isInDialog) {
      handleClose();
    }
  });

  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    handleClose();
  });

  dialog.showModal();
  applyZoom();
}

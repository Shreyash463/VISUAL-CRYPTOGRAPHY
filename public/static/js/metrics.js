/**
 * Visual metrics cards with progress bars and badges (Section 8).
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

function createBadge(text, type, iconId) {
  const span = document.createElement("span");
  span.className = `badge badge-${type}`;
  span.appendChild(createIcon(iconId));
  span.appendChild(document.createTextNode(` ${text}`));
  return span;
}

function formatNumber(num, dec) {
  if (typeof num === "number" && !isNaN(num)) {
    return num.toFixed(dec);
  }
  return String(num);
}

export function renderMetricsPanel(metrics) {
  const container = document.createElement("div");
  container.className = "metrics-container";

  // Grid of metric cards
  const grid = document.createElement("div");
  grid.className = "metrics-grid";

  // 1. Dimensions card
  const dimCard = document.createElement("div");
  dimCard.className = "metric-card card";
  const dimTitle = document.createElement("h4");
  dimTitle.className = "metric-card-title";
  dimTitle.textContent = "Dimensions";
  const dimVal = document.createElement("p");
  dimVal.className = "metric-detail font-mono";
  dimVal.textContent = `Secret: ${metrics.secret_size.width} × ${metrics.secret_size.height} px | Share: ${metrics.share_size.width} × ${metrics.share_size.height} px`;
  dimCard.appendChild(dimTitle);
  dimCard.appendChild(dimVal);
  grid.appendChild(dimCard);

  // 2. Pixel expansion card
  const expCard = document.createElement("div");
  expCard.className = "metric-card card";
  const expTitle = document.createElement("h4");
  expTitle.className = "metric-card-title";
  expTitle.textContent = "Pixel Expansion";

  const expBig = document.createElement("div");
  expBig.className = "metric-big-number";
  expBig.textContent = metrics.pixel_expansion === 4.0 ? "4×" : "1×";

  const expTrack = document.createElement("div");
  expTrack.className = "metric-bar-track";
  const expFill = document.createElement("div");
  expFill.className = "metric-bar-fill";
  const expPct = Math.min(100, Math.max(0, (metrics.pixel_expansion / 4.0) * 100));
  expFill.style.width = `${expPct}%`;
  expTrack.appendChild(expFill);

  const expCaption = document.createElement("p");
  expCaption.className = "help-text";
  expCaption.textContent = "subpixels per secret pixel";

  expCard.appendChild(expTitle);
  expCard.appendChild(expBig);
  expCard.appendChild(expTrack);
  expCard.appendChild(expCaption);
  grid.appendChild(expCard);

  // 3. Contrast card
  const conCard = document.createElement("div");
  conCard.className = "metric-card card";
  const conTitle = document.createElement("h4");
  conTitle.className = "metric-card-title";
  conTitle.textContent = "Contrast (Relative Difference)";

  if (metrics.contrast.relative_difference === null) {
    const conNull = document.createElement("p");
    conNull.className = "help-text";
    conNull.textContent = "not defined (secret has only one colour)";
    conCard.appendChild(conTitle);
    conCard.appendChild(conNull);
  } else {
    const measuredVal = formatNumber(metrics.contrast.relative_difference, 3);
    const theoVal = formatNumber(metrics.contrast.theoretical, 3);

    const conValRow = document.createElement("div");
    conValRow.className = "metric-val-row";

    const conMono = document.createElement("span");
    conMono.className = "font-mono";
    conMono.textContent = `${measuredVal} (theoretical ${theoVal}) `;
    conValRow.appendChild(conMono);

    const matchBadge = metrics.contrast.matches_theory
      ? createBadge("matches theory", "success", "i-check")
      : createBadge("differs", "warn", "i-x");
    conValRow.appendChild(matchBadge);

    const track = document.createElement("div");
    track.className = "metric-bar-track metric-contrast-track";

    const fill = document.createElement("div");
    fill.className = "metric-bar-fill";
    const fillPct = Math.min(100, Math.max(0, metrics.contrast.relative_difference * 100));
    fill.style.width = `${fillPct}%`;
    track.appendChild(fill);

    const marker = document.createElement("div");
    marker.className = "metric-marker";
    const theoPct = Math.min(100, Math.max(0, metrics.contrast.theoretical * 100));
    marker.style.left = `${theoPct}%`;
    marker.setAttribute("title", `Theoretical: ${theoVal}`);
    track.appendChild(marker);

    const conLabels = document.createElement("div");
    conLabels.className = "metric-track-labels";
    const lbl0 = document.createElement("span");
    lbl0.textContent = "0.0";
    const lbl1 = document.createElement("span");
    lbl1.textContent = "1.0";
    conLabels.appendChild(lbl0);
    conLabels.appendChild(lbl1);

    conCard.appendChild(conTitle);
    conCard.appendChild(conValRow);
    conCard.appendChild(track);
    conCard.appendChild(conLabels);
  }
  grid.appendChild(conCard);

  // 4. Reconstruction check card
  const recCard = document.createElement("div");
  recCard.className = "metric-card card";
  const recTitle = document.createElement("h4");
  recTitle.className = "metric-card-title";
  recTitle.textContent = "Reconstruction Check";

  const recBadge = metrics.reconstruction_check.passed
    ? createBadge("Passed", "success", "i-check")
    : createBadge("Failed", "error", "i-x");
  recBadge.classList.add("badge-lg");

  const recRule = document.createElement("p");
  recRule.className = "help-text";
  recRule.textContent = metrics.reconstruction_check.rule;

  recCard.appendChild(recTitle);
  recCard.appendChild(recBadge);
  recCard.appendChild(recRule);
  grid.appendChild(recCard);

  // 5. Timing card
  const timeCard = document.createElement("div");
  timeCard.className = "metric-card card";
  const timeTitle = document.createElement("h4");
  timeTitle.className = "metric-card-title";
  timeTitle.textContent = "Timing";
  const timeP = document.createElement("p");
  timeP.className = "metric-detail";
  timeP.textContent = `Share generation ${formatNumber(metrics.processing_ms, 2)} ms · Total ${formatNumber(metrics.total_ms, 2)} ms (reported, not targeted)`;
  timeCard.appendChild(timeTitle);
  timeCard.appendChild(timeP);
  grid.appendChild(timeCard);

  container.appendChild(grid);

  // 6. Leakage Card (spans full width)
  const leakCard = document.createElement("div");
  leakCard.className = "card metric-leakage-card";

  const leakHeader = document.createElement("div");
  leakHeader.className = "metric-leakage-header";
  const leakTitle = document.createElement("h4");
  leakTitle.className = "metric-card-title";
  leakTitle.textContent = "Single-Share Leakage Analysis";
  leakHeader.appendChild(leakTitle);
  leakCard.appendChild(leakHeader);

  const tableWrapper = document.createElement("div");
  tableWrapper.className = "table-wrapper";

  const table = document.createElement("table");
  table.className = "leakage-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Share", "Black overall", "Black where secret is black", "Black where secret is white", "Max deviation (0 - 0.05)", "Result"].forEach((heading) => {
    const th = document.createElement("th");
    th.textContent = heading;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const sh of metrics.leakage.shares) {
    const tr = document.createElement("tr");

    const tdShare = document.createElement("td");
    tdShare.textContent = `Share ${sh.index}`;
    tr.appendChild(tdShare);

    const tdAll = document.createElement("td");
    tdAll.className = "font-mono";
    tdAll.textContent = formatNumber(sh.p_black_all, 4);
    tr.appendChild(tdAll);

    const tdBlack = document.createElement("td");
    tdBlack.className = "font-mono";
    tdBlack.textContent = sh.p_black_in_secret_black !== null ? formatNumber(sh.p_black_in_secret_black, 4) : "—";
    tr.appendChild(tdBlack);

    const tdWhite = document.createElement("td");
    tdWhite.className = "font-mono";
    tdWhite.textContent = sh.p_black_in_secret_white !== null ? formatNumber(sh.p_black_in_secret_white, 4) : "—";
    tr.appendChild(tdWhite);

    const tdDev = document.createElement("td");
    const devWrap = document.createElement("div");
    devWrap.className = "leak-dev-wrap";

    const devMono = document.createElement("span");
    devMono.className = "font-mono text-sm";
    devMono.textContent = formatNumber(sh.max_deviation, 4);
    devWrap.appendChild(devMono);

    const devTrack = document.createElement("div");
    devTrack.className = "metric-bar-track leak-bar-track";
    const devFill = document.createElement("div");
    devFill.className = "metric-bar-fill";
    const devPct = Math.min(100, Math.max(0, (sh.max_deviation / 0.05) * 100));
    devFill.style.width = `${devPct}%`;
    devTrack.appendChild(devFill);
    devWrap.appendChild(devTrack);

    tdDev.appendChild(devWrap);
    tr.appendChild(tdDev);

    const tdRes = document.createElement("td");
    const badge = sh.passed
      ? createBadge("Passed", "success", "i-check")
      : createBadge("Failed", "error", "i-x");
    tdRes.appendChild(badge);
    tr.appendChild(tdRes);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  tableWrapper.appendChild(table);
  leakCard.appendChild(tableWrapper);

  const leakFooter = document.createElement("div");
  leakFooter.className = "metric-leakage-footer";

  const tolText = document.createElement("p");
  tolText.className = "help-text";
  tolText.textContent = "Tolerance: max(0.02, 4·0.5/√m), m = subpixels in the region (project-chosen).";
  leakFooter.appendChild(tolText);

  const allPassedBadge = metrics.leakage.all_passed
    ? createBadge("All passed", "success", "i-check")
    : createBadge("Some failed", "error", "i-x");
  leakFooter.appendChild(allPassedBadge);

  leakCard.appendChild(leakFooter);
  container.appendChild(leakCard);

  return container;
}

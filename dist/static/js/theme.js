/**
 * Theme management module supporting OS preference and manual toggle.
 */

function getStoredTheme() {
  try {
    return localStorage.getItem("vc-theme");
  } catch (_) {
    return null;
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem("vc-theme", theme);
  } catch (_) {}
}

export function getCurrentTheme() {
  const stored = getStoredTheme();
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeButton(theme);
}

function updateThemeButton(theme) {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  btn.textContent = "";
  const iconId = theme === "dark" ? "i-sun" : "i-moon";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${iconId}`);
  svg.appendChild(use);

  btn.appendChild(svg);
}

export function initTheme() {
  const initialTheme = getCurrentTheme();
  applyTheme(initialTheme);

  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || getCurrentTheme();
      const next = current === "dark" ? "light" : "dark";
      setStoredTheme(next);
      applyTheme(next);
    });
  }

  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!getStoredTheme()) {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
  } catch (_) {}
}

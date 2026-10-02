/**
 * Main application entry point: tabs, logo slot, keyboard navigation, and module initialization.
 */
import { el } from "./ui.js";
import { init as initGenerate } from "./generate.js";
import { init as initReconstruct } from "./reconstruct.js";
import { init as initCompare } from "./compare.js";
import { init as initAbout } from "./about.js";

const TABS = [
  { id: "tab-generate", panelId: "panel-generate", hash: "#generate" },
  { id: "tab-reconstruct", panelId: "panel-reconstruct", hash: "#reconstruct" },
  { id: "tab-compare", panelId: "panel-compare", hash: "#compare" },
  { id: "tab-about", panelId: "panel-about", hash: "#about" },
];

function initLogoSlot() {
  const logoSlot = document.getElementById("logo-slot");
  if (!logoSlot) return;

  logoSlot.textContent = "";

  const img = el("img", {
    src: "/static/img/sspu-logo.png",
    alt: "SSPU logo",
  });

  img.addEventListener("error", () => {
    logoSlot.textContent = "";
    const placeholder = el(
      "div",
      { className: "logo-placeholder" },
      "Space reserved for the official SSPU logo"
    );
    logoSlot.appendChild(placeholder);
  });

  img.addEventListener("load", () => {
    logoSlot.textContent = "";
    logoSlot.appendChild(img);
  });
}

function initTabs() {
  const tabElements = TABS.map((t) => document.getElementById(t.id)).filter(Boolean);

  function activateTab(index, updateHash = true) {
    TABS.forEach((t, i) => {
      const tabBtn = document.getElementById(t.id);
      const panel = document.getElementById(t.panelId);
      const isActive = i === index;

      if (tabBtn) {
        tabBtn.setAttribute("aria-selected", String(isActive));
        tabBtn.tabIndex = isActive ? 0 : -1;
      }
      if (panel) {
        panel.hidden = !isActive;
      }
    });

    if (updateHash && TABS[index]) {
      if (window.location.hash !== TABS[index].hash) {
        window.history.replaceState(null, "", TABS[index].hash);
      }
    }
  }

  // Keyboard navigation on tablist
  tabElements.forEach((tabBtn, index) => {
    tabBtn.addEventListener("click", () => {
      activateTab(index);
    });

    tabBtn.addEventListener("keydown", (e) => {
      let newIndex = null;
      if (e.key === "ArrowRight") {
        newIndex = (index + 1) % tabElements.length;
      } else if (e.key === "ArrowLeft") {
        newIndex = (index - 1 + tabElements.length) % tabElements.length;
      } else if (e.key === "Home") {
        newIndex = 0;
      } else if (e.key === "End") {
        newIndex = tabElements.length - 1;
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activateTab(index);
        return;
      }

      if (newIndex !== null) {
        e.preventDefault();
        tabElements[newIndex].focus();
        activateTab(newIndex);
      }
    });
  });

  // Listen to hash change
  function syncFromHash() {
    const hash = window.location.hash || "#generate";
    const foundIndex = TABS.findIndex((t) => t.hash === hash);
    if (foundIndex !== -1) {
      activateTab(foundIndex, false);
    } else {
      activateTab(0, true);
    }
  }

  window.addEventListener("hashchange", syncFromHash);
  syncFromHash();
}

document.addEventListener("DOMContentLoaded", () => {
  initLogoSlot();
  initTabs();

  initGenerate();
  initReconstruct();
  initCompare();
  initAbout();
});

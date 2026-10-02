/**
 * Toast notifications module with auto-dismiss and maximum 3 visible.
 */

export function showToast(message, iconId = "i-check", type = "info") {
  const region = document.getElementById("toast-region");
  if (!region) return;

  while (region.children.length >= 3) {
    region.removeChild(region.firstElementChild);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${iconId}`);
  svg.appendChild(use);

  const textSpan = document.createElement("span");
  textSpan.textContent = message;

  toast.appendChild(svg);
  toast.appendChild(textSpan);
  region.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3500);
}

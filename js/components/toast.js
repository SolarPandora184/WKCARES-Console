// js/components/toast.js
// Minimal toast system. Call showToast() from any page after importing this
// module; it lazily creates its own container so no HTML boilerplate is needed
// on every page.

let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement("div");
  container.className = "toast-container";
  container.setAttribute("aria-live", "polite");
  document.body.appendChild(container);
  return container;
}

/**
 * @param {string} message
 * @param {"success"|"error"|"info"} type
 * @param {number} durationMs
 */
export function showToast(message, type = "info", durationMs = 3500) {
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.setAttribute("role", "status");

  const icon = { success: "check_circle", error: "error", info: "info" }[type] || "info";
  el.innerHTML = `<span class="material-icons toast__icon">${icon}</span><span class="toast__msg"></span>`;
  el.querySelector(".toast__msg").textContent = message; // textContent avoids HTML injection

  ensureContainer().appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast--visible"));

  setTimeout(() => {
    el.classList.remove("toast--visible");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
  }, durationMs);
}

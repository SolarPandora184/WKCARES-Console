// js/pages/reset-password.js
import { requestPasswordReset, setNewPassword, onAuthReady } from "../firebase/auth.js";
import { isStrongPassword, passwordRequirementsText } from "../utils/validation.js";

const params = new URLSearchParams(window.location.search);
const isForced = params.get("forced") === "1";

document.getElementById("password-hint").textContent = passwordRequirementsText();

if (isForced) {
  // Only show the "set new password" view once we've confirmed a session exists;
  // otherwise send the user back to sign in.
  onAuthReady((user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    document.getElementById("request-view").style.display = "none";
    document.getElementById("forced-view").style.display = "block";
  });

  document.getElementById("forced-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = document.getElementById("new-password").value;
    if (!isStrongPassword(pw)) return showError("forced-error", passwordRequirementsText());
    try {
      await setNewPassword(pw);
      window.location.href = "index.html";
    } catch (err) {
      showError("forced-error", err.message || "Unable to set new password.");
    }
  });
} else {
  document.getElementById("request-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("request-email").value.trim();
    try {
      await requestPasswordReset(email);
      const form = document.getElementById("request-form");
      form.innerHTML = `<p style="color:var(--color-success); font-size:0.9rem;">
        If an account exists for that email, a reset link has been sent.</p>`;
    } catch (err) {
      showError("request-error", err.message || "Unable to send reset email.");
    }
  });
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add("auth-card__error--visible");
}

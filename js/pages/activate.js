// js/pages/activate.js
import { activateAccount } from "../firebase/auth.js";
import { isValidEmail, isStrongPassword, passwordRequirementsText } from "../utils/validation.js";

const form = document.getElementById("activate-form");
const errorBox = document.getElementById("error-box");
const submitBtn = document.getElementById("submit-btn");

document.getElementById("password-hint").textContent = passwordRequirementsText();

// Pre-fill from an invitation link (admin.html generates activate.html?code=...&email=...)
// so the invitee only has to set a password, not retype the code by hand.
const params = new URLSearchParams(window.location.search);
if (params.get("code")) document.getElementById("code").value = params.get("code").toUpperCase();
if (params.get("email")) document.getElementById("email").value = params.get("email");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const code = document.getElementById("code").value.trim().toUpperCase();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  if (!isValidEmail(email)) return showError("Enter a valid email address.");
  if (!isStrongPassword(password)) return showError(passwordRequirementsText());
  if (password !== confirmPassword) return showError("Passwords do not match.");

  submitBtn.disabled = true;
  submitBtn.textContent = "Activating…";

  try {
    await activateAccount(code, email, password);
    window.location.href = "index.html";
  } catch (err) {
    showError(err.message || "Unable to activate account.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Activate account";
  }
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add("auth-card__error--visible");
}

function hideError() {
  errorBox.classList.remove("auth-card__error--visible");
}

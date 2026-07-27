// js/pages/login.js
import { login } from "../firebase/auth.js";

const form = document.getElementById("login-form");
const errorBox = document.getElementById("error-box");
const submitBtn = document.getElementById("submit-btn");

// Surface why the user landed back on the login page, if applicable.
const params = new URLSearchParams(window.location.search);
if (params.get("reason") === "timeout") {
  showError("You were signed out after a period of inactivity.");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  submitBtn.disabled = true;
  submitBtn.textContent = "Signing in…";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const { mustResetPassword } = await login(email, password);
    window.location.href = mustResetPassword ? "reset-password.html?forced=1" : "index.html";
  } catch (err) {
    showError(friendlyMessage(err));
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign in";
  }
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add("auth-card__error--visible");
}

function hideError() {
  errorBox.classList.remove("auth-card__error--visible");
}

function friendlyMessage(err) {
  const code = err.code || "";
  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Incorrect email or password.";
  }
  if (code.includes("too-many-requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return err.message || "Unable to sign in. Please try again.";
}

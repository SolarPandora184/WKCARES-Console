// js/utils/validation.js

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidCallsign(callsign) {
  // Loose US amateur callsign pattern: 1-2 letter prefix, digit, 1-3 letter suffix.
  return /^[A-Z]{1,2}[0-9][A-Z]{1,3}$/i.test(callsign.trim());
}

/** Minimum 10 chars, at least one letter and one number — adjust to org policy. */
export function isStrongPassword(password) {
  return password.length >= 10 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

export function passwordRequirementsText() {
  return "At least 10 characters, including a letter and a number.";
}

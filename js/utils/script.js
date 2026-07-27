// js/utils/script.js
// Net Script text can contain the placeholder "(ID)" (case-insensitive, so
// "(id)", "(Id)", "(ID)" all work) anywhere in the wording. When the script
// is displayed on the Weekly Net Form, that placeholder is swapped out for
// the net's callsign automatically — so admins can write a script once,
// e.g. "This is (ID), net control for tonight's net," and it fills itself
// in for whoever is actually running the net that week.

const ID_PLACEHOLDER = /\(id\)/gi;

/**
 * @param {string} text - raw script text, possibly containing "(ID)"
 * @param {string} callsign - the current net's callsign (may be blank if not entered yet)
 * @returns {string} text with every "(ID)" replaced
 */
export function applyScriptTemplate(text, callsign) {
  if (!text) return "";
  const trimmed = (callsign ?? "").trim();
  const value = trimmed ? trimmed.toUpperCase() : "(your callsign)";
  return text.replace(ID_PLACEHOLDER, value);
}

/* ---------------------------------------------------------------------- */
/* Form-layout key helpers                                                 */
/* ---------------------------------------------------------------------- */
// Script sections are placed on the Weekly Net Form purely by hand, via the
// Form Layout tab — there's no default position for any of them. A layout
// order entry like "script:abc123" means "show script section abc123 here."
// ("custom:abc123" is also recognized, since that was this prefix's name
// before every script became hand-made rather than a mix of built-in/custom.)

export function makeScriptKey(sectionId) {
  return `script:${sectionId}`;
}

export function isScriptKey(key) {
  return key.startsWith("script:") || key.startsWith("custom:");
}

export function scriptIdFromKey(key) {
  if (key.startsWith("script:")) return key.slice("script:".length);
  if (key.startsWith("custom:")) return key.slice("custom:".length);
  return null;
}

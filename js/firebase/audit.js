// js/firebase/audit.js
// Single write path for the audit log so every privileged action is recorded
// the same way. Never delete from /auditLog client-side — security rules
// should make it append-only.

import { ref, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db, auth } from "./config.js";

/**
 * @param {string} action - short machine-readable event name, e.g. "net_created"
 * @param {object} details - arbitrary JSON-serializable context for the event
 */
export async function logAudit(action, details = {}) {
  try {
    await push(ref(db, "auditLog"), {
      action,
      details,
      actorUid: auth.currentUser?.uid ?? null,
      actorEmail: auth.currentUser?.email ?? null,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    // Audit logging must never block the primary action from completing.
    console.error("Audit log write failed:", action, err);
  }
}

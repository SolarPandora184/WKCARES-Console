// js/firebase/auth.js
// Wraps Firebase Authentication with the app's invitation-only registration model,
// role loading, and an inactivity-based session timeout.

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updatePassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  ref,
  get,
  set,
  update,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, db } from "./config.js";
import { logAudit } from "./audit.js";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min inactivity -> auto sign-out
let inactivityTimer = null;
let currentProfile = null; // cached /users/{uid} record for the signed-in user

/* ---------------------------------------------------------------------- */
/* Session state                                                          */
/* ---------------------------------------------------------------------- */

export function onAuthReady(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        currentProfile = await fetchUserProfile(user.uid);
      } catch (err) {
        // Surfaced with a distinct prefix so it's impossible to miss in the
        // console — a failed profile read used to fail silently here.
        console.error("[wkcares-debug] fetchUserProfile threw:", err);
        currentProfile = null;
      }
      startInactivityWatch();
    } else {
      currentProfile = null;
      stopInactivityWatch();
    }
    callback(user, currentProfile);
  });
}

export function getCurrentProfile() {
  return currentProfile;
}

export function hasRole(...roles) {
  if (!currentProfile?.role) return false;
  const stored = String(currentProfile.role).trim().toLowerCase();
  return roles.some((r) => String(r).trim().toLowerCase() === stored);
}

async function fetchUserProfile(uid) {
  const snap = await get(ref(db, `users/${uid}`));
  console.log("[wkcares-debug] fetchUserProfile", {
    queriedUid: uid,
    exists: snap.exists(),
    data: snap.val(),
    databaseURL: db.app.options.databaseURL,
  });
  return snap.exists() ? { uid, ...snap.val() } : null;
}

/* ---------------------------------------------------------------------- */
/* Login / logout                                                         */
/* ---------------------------------------------------------------------- */

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await fetchUserProfile(cred.user.uid);

  if (profile?.disabled) {
    await fbSignOut(auth);
    throw new Error("This account has been disabled. Contact an administrator.");
  }

  await update(ref(db, `users/${cred.user.uid}`), { lastLogin: serverTimestamp() });
  await logAudit("login", { uid: cred.user.uid, email });

  if (profile?.forcePasswordReset) {
    // Caller (login page) should redirect to a "set new password" screen.
    return { user: cred.user, profile, mustResetPassword: true };
  }
  return { user: cred.user, profile, mustResetPassword: false };
}

export async function logout() {
  const uid = auth.currentUser?.uid;
  if (uid) await logAudit("logout", { uid });
  stopInactivityWatch();
  await fbSignOut(auth);
}

export async function requestPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
  await logAudit("password_reset_requested", { email });
}

export async function setNewPassword(newPassword) {
  if (!auth.currentUser) throw new Error("Not signed in.");
  await updatePassword(auth.currentUser, newPassword);
  await update(ref(db, `users/${auth.currentUser.uid}`), { forcePasswordReset: false });
  await logAudit("password_reset_completed", { uid: auth.currentUser.uid });
}

/* Admin-triggered: mark a user so they must set a new password on next login. */
export async function forcePasswordReset(targetUid, actingUid) {
  await update(ref(db, `users/${targetUid}`), { forcePasswordReset: true });
  await logAudit("permission_change", {
    actor: actingUid,
    target: targetUid,
    action: "force_password_reset",
  });
}

/* ---------------------------------------------------------------------- */
/* Own-profile preferences (display settings, etc.)                       */
/* ---------------------------------------------------------------------- */

/**
 * Merges `patch` into the signed-in user's own /users/{uid}/preferences node
 * and updates the cached profile in memory so hasRole()/getCurrentProfile()
 * and any already-rendered UI reflect the change without a page reload.
 */
export async function updateOwnPreferences(patch) {
  if (!auth.currentUser) throw new Error("Not signed in.");
  await update(ref(db, `users/${auth.currentUser.uid}/preferences`), patch);
  if (currentProfile) {
    currentProfile = { ...currentProfile, preferences: { ...currentProfile.preferences, ...patch } };
  }
}

/* ---------------------------------------------------------------------- */
/* Invitation-based account activation                                    */
/* ---------------------------------------------------------------------- */

/**
 * Validates an invitation code against /invitations/{code} and returns the
 * invitation record if it is valid, unused, and unexpired. Throws otherwise.
 */
export async function validateInvitation(code, email) {
  const snap = await get(ref(db, `invitations/${code}`));
  if (!snap.exists()) throw new Error("Invalid activation code.");

  const invite = snap.val();
  if (invite.used) throw new Error("This activation code has already been used.");
  if (invite.revoked) throw new Error("This activation code has been revoked.");
  if (Date.now() > invite.expiresAt) throw new Error("This activation code has expired.");
  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error("Email does not match the invitation.");
  }
  return invite;
}

/**
 * Completes activation: creates the Firebase Auth account, writes the user
 * profile with the invited role, and permanently marks the invitation used.
 * This is the only way a new account can be created (no public sign-up).
 */
export async function activateAccount(code, email, password) {
  const invite = await validateInvitation(code, email);

  const cred = await createUserWithEmailAndPassword(auth, email, password);

  await set(ref(db, `users/${cred.user.uid}`), {
    name: invite.name,
    email,
    callsign: invite.callsign,
    role: invite.role,
    status: "active",
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    forcePasswordReset: false,
    disabled: false,
  });

  // Mark invitation permanently used — never reusable, even if activation
  // is somehow retried, because this write includes usedByUid + timestamp.
  await update(ref(db, `invitations/${code}`), {
    used: true,
    usedAt: serverTimestamp(),
    usedByUid: cred.user.uid,
  });

  await logAudit("invitation_used", { code, uid: cred.user.uid, email });
  return cred.user;
}

/* ---------------------------------------------------------------------- */
/* Inactivity-based session timeout                                       */
/* ---------------------------------------------------------------------- */

function startInactivityWatch() {
  const reset = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
      await logout();
      window.location.href = "/login.html?reason=timeout";
    }, SESSION_TIMEOUT_MS);
  };
  ["mousemove", "keydown", "click", "touchstart", "scroll"].forEach((evt) =>
    window.addEventListener(evt, reset, { passive: true })
  );
  reset();
}

function stopInactivityWatch() {
  clearTimeout(inactivityTimer);
  inactivityTimer = null;
}

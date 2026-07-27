// js/utils/permissions.js
// Single source of truth for "what can this signed-in user do." Admin has
// three tiers (admin_1 < admin_2 < admin_3), each a superset of the one
// below it. Everything else in the app (admin.js UI gating, net-form.js
// form-layout editing) should call these functions rather than checking
// role strings directly, so the permission rules only live in one place.
//
// NOTE: these checks control the UI only. The real security boundary is
// firebase-rules.json — keep that file's role checks in sync with this one.

import { hasRole } from "../firebase/auth.js";

/** 0 = not an admin, 1/2/3 = admin tier. */
export function adminLevel() {
  if (hasRole("admin_3")) return 3;
  if (hasRole("admin_2")) return 2;
  if (hasRole("admin_1")) return 1;
  return 0;
}

export function isAdmin() {
  return adminLevel() >= 1;
}

/* ---------------------------------------------------------------------- */
/* Level 1+ (every admin tier)                                            */
/* ---------------------------------------------------------------------- */

/** Level 1 admins can create invitations, but not revoke/regenerate them. */
export function canCreateInvitations() {
  return adminLevel() >= 1;
}

export function canViewBackups() {
  return adminLevel() >= 1;
}

export function canViewAuditLog() {
  return adminLevel() >= 1;
}

/* ---------------------------------------------------------------------- */
/* Level 2+                                                                */
/* ---------------------------------------------------------------------- */

/** Editing the Staff / Areas / Bands rosters. */
export function canEditRoster() {
  return adminLevel() >= 2;
}

/** Changing a user's role. */
export function canEditUserRoles() {
  return adminLevel() >= 2;
}

/** Disabling/re-enabling a login, and forcing a password reset. */
export function canRevokeLogins() {
  return adminLevel() >= 2;
}

/** Revoking or regenerating an already-created invitation (creating one is Level 1+). */
export function canManageInvitations() {
  return adminLevel() >= 2;
}

/* ---------------------------------------------------------------------- */
/* Level 3 only                                                           */
/* ---------------------------------------------------------------------- */

/** Editing the wording of the Net Script (and adding/removing custom script sections). */
export function canEditScript() {
  return adminLevel() >= 3;
}

/** Rearranging the Weekly Net Form's cards and inserting script sections into it. */
export function canEditFormLayout() {
  return adminLevel() >= 3;
}

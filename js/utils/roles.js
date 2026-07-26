// js/utils/roles.js
// Single source of truth for the app's role list. Only the "admin" value is
// meaningful to firebase-rules.json today — the others are enforced at the UI
// layer (nav visibility, page guards) rather than the database layer. If a
// role needs its own database-level permissions later, add a matching clause
// to firebase-rules.json and republish it; adding a role here alone does not
// change what that role can read or write in the database.

export const ROLES = [
  {
    value: "admin",
    label: "Admin",
    description:
      "Full access: manage users, staff, areas, bands, invitations, and view the full audit log. Can edit and delete any net.",
  },
  {
    value: "net_control",
    label: "Net Control",
    description: "Runs weekly nets: create, finalize, and edit net records. No access to the Admin Panel.",
  },
  {
    value: "staff",
    label: "Staff",
    description: "ARES staff member. Can view the dashboard and past nets. No access to the Admin Panel.",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access to the dashboard and net history. Cannot create or edit nets.",
  },
];

export function roleLabel(value) {
  return ROLES.find((r) => r.value === value)?.label ?? value ?? "—";
}

export function roleOptionsHtml(selected) {
  return ROLES.map((r) => `<option value="${r.value}" ${r.value === selected ? "selected" : ""}>${r.label}</option>`).join("");
}

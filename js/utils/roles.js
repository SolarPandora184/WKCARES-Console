// js/utils/roles.js
// Single source of truth for the app's role list. Admin is split into three
// tiers (admin_1 < admin_2 < admin_3, each a superset of the one below —
// see js/utils/permissions.js for exactly what each tier can do). The other
// roles are enforced at the UI layer (nav visibility, page guards) rather
// than the database layer. If a role needs its own database-level
// permissions, add a matching clause to firebase-rules.json and republish it
// — adding a role here alone does not change what it can read/write.

export const ROLES = [
  {
    value: "admin_3",
    label: "Admin — Level 3",
    description:
      "Full control. Everything Level 2 can do, plus editing the Net Script wording and the Weekly Net Form layout — reordering cards and adding new script sections.",
  },
  {
    value: "admin_2",
    label: "Admin — Level 2",
    description:
      "Can edit users' roles, the Staff/Areas/Bands rosters, and invitations, and can disable or re-enable logins. Cannot edit the Net Script or the Net Form layout.",
  },
  {
    value: "admin_1",
    label: "Admin — Level 1",
    description:
      "Can create invitations and view every Admin tab, plus export backups and view the audit log. Cannot edit rosters, user roles, invitations, scripts, or the form layout.",
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

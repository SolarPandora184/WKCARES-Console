// js/pages/admin.js
import { onAuthReady, hasRole, forcePasswordReset } from "../firebase/auth.js";
import { renderShell } from "../components/navbar.js";
import { showToast } from "../components/toast.js";
import { DynamicTable } from "../components/dynamic-table.js";
import { timeAgo } from "../utils/date.js";
import { isValidEmail, isValidCallsign } from "../utils/validation.js";
import { ROLES, roleLabel, roleOptionsHtml } from "../utils/roles.js";
import {
  watchUsers,
  updateUserRole,
  setUserDisabled,
  watchInvitations,
  createInvitation,
  revokeInvitation,
  watchStaff,
  saveStaffMember,
  deleteStaffMember,
  watchAreas,
  saveArea,
  deleteArea,
  watchBands,
  saveBand,
  deleteBand,
  watchRecentAuditLog,
  exportFullBackup,
} from "../firebase/db.js";

let currentProfile = null;

// Latest snapshots from each watcher, kept around so search/filter re-renders
// don't need a fresh Firebase read.
let usersData = [];
let invitationsData = [];
let auditData = [];

onAuthReady((user, profile) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (!hasRole("admin")) {
    window.location.href = "index.html";
    return;
  }
  currentProfile = profile;
  renderShell("admin.html", profile);
  init();
});

function init() {
  initTabs();
  initUsersTab();
  initInvitationsTab();
  initStaffTab();
  initAreasTab();
  initBandsTab();
  initRolesTab();
  initAuditTab();
  initBackupsTab();
}

/* ---------------------------------------------------------------------- */
/* Tabs                                                                    */
/* ---------------------------------------------------------------------- */

function initTabs() {
  const tabs = document.querySelectorAll(".admin-tab");
  const panels = document.querySelectorAll(".admin-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.remove("admin-tab--active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("admin-tab--active");
      tab.setAttribute("aria-selected", "true");
      panels.forEach((p) => p.classList.toggle("admin-panel--active", p.dataset.panel === tab.dataset.tab));
    });
  });
}

/* ---------------------------------------------------------------------- */
/* Users                                                                    */
/* ---------------------------------------------------------------------- */

function initUsersTab() {
  watchUsers((users) => {
    usersData = users.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    renderUsersTable();
  });

  document.getElementById("users-search").addEventListener("input", renderUsersTable);
}

function renderUsersTable() {
  const term = document.getElementById("users-search").value.trim().toLowerCase();
  const filtered = usersData.filter((u) =>
    !term ||
    (u.name ?? "").toLowerCase().includes(term) ||
    (u.callsign ?? "").toLowerCase().includes(term) ||
    (u.email ?? "").toLowerCase().includes(term)
  );

  document.getElementById("users-count").textContent = `${filtered.length} of ${usersData.length} users`;

  const container = document.getElementById("users-table");
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">No users match your search.</div>`;
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th><th>Callsign</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${filtered
          .map(
            (u) => `
          <tr class="${u.disabled ? "is-muted-row" : ""}" data-uid="${u.id}">
            <td>${escapeHtml(u.name ?? "—")}</td>
            <td>${escapeHtml(u.callsign ?? "—")}</td>
            <td>${escapeHtml(u.email ?? "—")}</td>
            <td>
              <select class="user-role-select" data-uid="${u.id}" ${u.id === currentProfile?.uid ? "disabled title=\"You can't change your own role\"" : ""}>
                ${roleOptionsHtml(u.role)}
              </select>
            </td>
            <td>
              ${
                u.disabled
                  ? `<span class="badge badge--danger">Disabled</span>`
                  : u.forcePasswordReset
                  ? `<span class="badge badge--warning">Reset pending</span>`
                  : `<span class="badge badge--success">Active</span>`
              }
            </td>
            <td>${u.lastLogin ? timeAgo(u.lastLogin) : "Never"}</td>
            <td>
              <div class="row-actions">
                <button type="button" class="btn btn--secondary user-reset-btn" data-uid="${u.id}" title="Force password reset">
                  <span class="material-icons" aria-hidden="true">lock_reset</span>
                </button>
                <button type="button" class="btn btn--secondary user-toggle-btn" data-uid="${u.id}" data-disabled="${!!u.disabled}"
                  ${u.id === currentProfile?.uid ? "disabled title=\"You can't disable your own account\"" : ""}>
                  <span class="material-icons" aria-hidden="true">${u.disabled ? "check_circle" : "block"}</span>
                </button>
              </div>
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  container.querySelectorAll(".user-role-select").forEach((sel) => {
    sel.addEventListener("change", async () => {
      try {
        await updateUserRole(sel.dataset.uid, sel.value);
        showToast("Role updated.", "success");
      } catch (err) {
        showToast(err.message || "Failed to update role.", "error");
      }
    });
  });

  container.querySelectorAll(".user-reset-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await forcePasswordReset(btn.dataset.uid, currentProfile?.uid);
        showToast("User will be prompted to set a new password on next login.", "success");
      } catch (err) {
        showToast(err.message || "Failed to force a password reset.", "error");
      }
    });
  });

  container.querySelectorAll(".user-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nowDisabled = btn.dataset.disabled === "true";
      const confirmMsg = nowDisabled ? "Re-enable this account?" : "Disable this account? They will be signed out and unable to log back in.";
      if (!window.confirm(confirmMsg)) return;
      try {
        await setUserDisabled(btn.dataset.uid, !nowDisabled);
        showToast(nowDisabled ? "Account re-enabled." : "Account disabled.", "success");
      } catch (err) {
        showToast(err.message || "Failed to update account status.", "error");
      }
    });
  });
}

/* ---------------------------------------------------------------------- */
/* Invitations                                                             */
/* ---------------------------------------------------------------------- */

function initInvitationsTab() {
  watchInvitations((invites) => {
    invitationsData = invites.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    renderInvitationsTable();
  });

  document.getElementById("invitations-search").addEventListener("input", renderInvitationsTable);

  const modal = document.getElementById("invitation-modal");
  const form = document.getElementById("invitation-form");
  const roleSelect = document.getElementById("invite-role");
  roleSelect.innerHTML = roleOptionsHtml("staff");

  document.getElementById("new-invitation-btn").addEventListener("click", () => openModal(modal));
  document.getElementById("invitation-modal-close").addEventListener("click", () => closeModal(modal));
  document.getElementById("invitation-cancel-btn").addEventListener("click", () => closeModal(modal));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("invite-name").value.trim();
    const callsign = document.getElementById("invite-callsign").value.trim().toUpperCase();
    const email = document.getElementById("invite-email").value.trim();
    const role = roleSelect.value;
    const expiresInDays = Number(document.getElementById("invite-expires").value) || 7;

    if (!name) return showToast("Enter a name.", "error");
    if (!isValidCallsign(callsign)) return showToast("Enter a valid amateur radio callsign.", "error");
    if (!isValidEmail(email)) return showToast("Enter a valid email address.", "error");

    const submitBtn = document.getElementById("invitation-submit-btn");
    submitBtn.disabled = true;
    try {
      const code = await createInvitation({ name, email, callsign, role, expiresInDays });
      closeModal(modal);
      form.reset();
      roleSelect.innerHTML = roleOptionsHtml("staff");
      showInvitationLink(code, email);
      showToast("Invitation created.", "success");
    } catch (err) {
      showToast(err.message || "Failed to create invitation.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  const linkModal = document.getElementById("invitation-link-modal");
  document.getElementById("invitation-link-close").addEventListener("click", () => closeModal(linkModal));
  document.getElementById("invitation-link-done-btn").addEventListener("click", () => closeModal(linkModal));
  document.getElementById("invitation-copy-link-btn").addEventListener("click", async () => {
    const input = document.getElementById("invitation-link-url");
    await copyToClipboard(input.value);
    showToast("Link copied.", "success");
  });
  document.getElementById("invitation-mail-btn").addEventListener("click", () => {
    const link = document.getElementById("invitation-link-url").value;
    const code = document.getElementById("invitation-link-code").value;
    const subject = encodeURIComponent("WKCARES Console — Account Activation");
    const body = encodeURIComponent(
      `You've been invited to WKCARES Console.\n\nActivate your account here:\n${link}\n\nOr enter this code manually: ${code}\n\nThis invitation expires automatically, so please activate soon.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  });
}

function showInvitationLink(code, email) {
  const url = `${window.location.origin}${window.location.pathname.replace(/admin\.html$/, "")}activate.html?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`;
  document.getElementById("invitation-link-url").value = url;
  document.getElementById("invitation-link-code").value = code;
  openModal(document.getElementById("invitation-link-modal"));
}

function invitationStatus(invite) {
  if (invite.used) return { label: "Used", cls: "badge--muted" };
  if (invite.revoked) return { label: "Revoked", cls: "badge--danger" };
  if (invite.expiresAt && Date.now() > invite.expiresAt) return { label: "Expired", cls: "badge--warning" };
  return { label: "Pending", cls: "badge--success" };
}

function renderInvitationsTable() {
  const term = document.getElementById("invitations-search").value.trim().toLowerCase();
  const filtered = invitationsData.filter((i) =>
    !term ||
    (i.name ?? "").toLowerCase().includes(term) ||
    (i.callsign ?? "").toLowerCase().includes(term) ||
    (i.email ?? "").toLowerCase().includes(term)
  );

  const container = document.getElementById("invitations-table");
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">No invitations match your search.</div>`;
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th><th>Callsign</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${filtered
          .map((i) => {
            const status = invitationStatus(i);
            const actionable = status.label === "Pending";
            return `
          <tr>
            <td>${escapeHtml(i.name ?? "—")}</td>
            <td>${escapeHtml(i.callsign ?? "—")}</td>
            <td>${escapeHtml(i.email ?? "—")}</td>
            <td>${roleLabel(i.role)}</td>
            <td><span class="badge ${status.cls}">${status.label}</span></td>
            <td>${i.createdAt ? timeAgo(i.createdAt) : "—"}</td>
            <td>
              <div class="row-actions">
                ${
                  actionable
                    ? `
                <button type="button" class="btn btn--secondary invite-copy-btn" data-code="${escapeAttr(i.code)}" data-email="${escapeAttr(i.email)}" title="Copy link">
                  <span class="material-icons" aria-hidden="true">link</span>
                </button>
                <button type="button" class="btn btn--secondary invite-revoke-btn" data-code="${escapeAttr(i.code)}" title="Revoke">
                  <span class="material-icons" aria-hidden="true">block</span>
                </button>`
                    : ""
                }
                ${
                  status.label === "Revoked" || status.label === "Expired"
                    ? `
                <button type="button" class="btn btn--secondary invite-regen-btn"
                  data-name="${escapeAttr(i.name)}" data-email="${escapeAttr(i.email)}"
                  data-callsign="${escapeAttr(i.callsign)}" data-role="${escapeAttr(i.role)}" title="Regenerate">
                  <span class="material-icons" aria-hidden="true">refresh</span>
                </button>`
                    : ""
                }
              </div>
            </td>
          </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  `;

  container.querySelectorAll(".invite-copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => showInvitationLink(btn.dataset.code, btn.dataset.email));
  });

  container.querySelectorAll(".invite-revoke-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Revoke this invitation? It can be regenerated later if needed.")) return;
      try {
        await revokeInvitation(btn.dataset.code);
        showToast("Invitation revoked.", "success");
      } catch (err) {
        showToast(err.message || "Failed to revoke invitation.", "error");
      }
    });
  });

  container.querySelectorAll(".invite-regen-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const code = await createInvitation({
          name: btn.dataset.name,
          email: btn.dataset.email,
          callsign: btn.dataset.callsign,
          role: btn.dataset.role,
          expiresInDays: 7,
        });
        showInvitationLink(code, btn.dataset.email);
        showToast("New invitation created.", "success");
      } catch (err) {
        showToast(err.message || "Failed to regenerate invitation.", "error");
      }
    });
  });
}

/* ---------------------------------------------------------------------- */
/* Staff roster (spreadsheet-style editable table, explicit Save)          */
/* ---------------------------------------------------------------------- */

let staffTable = null;
let staffOriginalIds = new Set();

function initStaffTab() {
  watchStaff((rows) => {
    staffOriginalIds = new Set(rows.map((r) => r.id));
    const columns = [
      { key: "name", label: "Name", type: "text" },
      { key: "callsign", label: "Callsign", type: "text" },
      { key: "position", label: "Position", type: "text" },
      { key: "active", label: "Active", type: "checkbox" },
    ];
    const initialRows = rows.map((r) => ({ id: r.id, name: r.name ?? "", callsign: r.callsign ?? "", position: r.position ?? "", active: r.active !== false }));
    staffTable = new DynamicTable(document.getElementById("staff-table"), columns, initialRows, () => setUnsaved("staff"), {
      addLabel: "Add staff member",
      emptyRow: { name: "", callsign: "", position: "", active: true },
    });
    setSaved("staff", `${rows.length} staff members`);
  });

  document.getElementById("staff-save-btn").addEventListener("click", async () => {
    await saveRosterTable(staffTable, staffOriginalIds, saveStaffMember, deleteStaffMember, "staff");
  });
}

/* ---------------------------------------------------------------------- */
/* Areas (Mountain / Metro)                                                */
/* ---------------------------------------------------------------------- */

let mountainTable = null;
let metroTable = null;
let mountainOriginalIds = new Set();
let metroOriginalIds = new Set();

function initAreasTab() {
  const columns = [
    { key: "name", label: "Area name", type: "text" },
    { key: "callsign", label: "Controller callsign", type: "text" },
    { key: "active", label: "Active", type: "checkbox" },
  ];
  const emptyRow = { name: "", callsign: "", active: true };

  watchAreas("mountain", (rows) => {
    mountainOriginalIds = new Set(rows.map((r) => r.id));
    const initialRows = rows.map((r) => ({ id: r.id, name: r.name ?? "", callsign: r.callsign ?? "", active: r.active !== false }));
    mountainTable = new DynamicTable(document.getElementById("mountain-areas-table"), columns, initialRows, () => setUnsaved("areas"), {
      addLabel: "Add mountain area",
      emptyRow,
    });
  });

  watchAreas("metro", (rows) => {
    metroOriginalIds = new Set(rows.map((r) => r.id));
    const initialRows = rows.map((r) => ({ id: r.id, name: r.name ?? "", callsign: r.callsign ?? "", active: r.active !== false }));
    metroTable = new DynamicTable(document.getElementById("metro-areas-table"), columns, initialRows, () => setUnsaved("areas"), {
      addLabel: "Add metro area",
      emptyRow,
    });
    setSaved("areas", "Areas loaded");
  });

  document.getElementById("areas-save-btn").addEventListener("click", async () => {
    setSaving("areas");
    try {
      await Promise.all([
        saveRosterTable(mountainTable, mountainOriginalIds, (id, data) => saveArea("mountain", id, data), (id) => deleteArea("mountain", id), null),
        saveRosterTable(metroTable, metroOriginalIds, (id, data) => saveArea("metro", id, data), (id) => deleteArea("metro", id), null),
      ]);
      setSaved("areas", "All changes saved");
      showToast("Areas saved.", "success");
    } catch {
      // Individual failures already surfaced their own toast in saveRosterTable.
      setSaved("areas", "Save failed — see error");
    }
  });
}

/* ---------------------------------------------------------------------- */
/* Bands                                                                    */
/* ---------------------------------------------------------------------- */

let bandsTable = null;
let bandsOriginalIds = new Set();

function initBandsTab() {
  const columns = [
    { key: "band", label: "Band", type: "text" },
    { key: "frequency", label: "Frequency", type: "text" },
    { key: "mode", label: "Mode", type: "select", options: ["Voice", "Digital", "CW"] },
    { key: "active", label: "Active", type: "checkbox" },
  ];
  watchBands((rows) => {
    bandsOriginalIds = new Set(rows.map((r) => r.id));
    const initialRows = rows.map((r) => ({
      id: r.id,
      band: r.band ?? "",
      frequency: r.frequency ?? "",
      mode: r.mode ?? "Voice",
      active: r.active !== false,
    }));
    bandsTable = new DynamicTable(document.getElementById("bands-table"), columns, initialRows, () => setUnsaved("bands"), {
      addLabel: "Add band",
      emptyRow: { band: "", frequency: "", mode: "Voice", active: true },
    });
    setSaved("bands", `${rows.length} bands configured`);
  });

  document.getElementById("bands-save-btn").addEventListener("click", async () => {
    await saveRosterTable(bandsTable, bandsOriginalIds, saveBand, deleteBand, "bands");
  });
}

/* Shared diff-and-save routine for the Staff/Areas/Bands DynamicTables:
   rows with no id are new (create), rows with an id are updates, and any
   id present in the original snapshot but missing from the current rows
   was deleted by the user. statusKey is optional — areas saves its own
   status message once both grids have been persisted. */
async function saveRosterTable(table, originalIds, saveFn, deleteFn, statusKey) {
  if (!table) return;
  if (statusKey) setSaving(statusKey);
  const currentIds = new Set(table.rows.filter((r) => r.id && originalIds.has(r.id)).map((r) => r.id));
  const removedIds = [...originalIds].filter((id) => !currentIds.has(id));

  try {
    for (const row of table.rows) {
      const { id, ...data } = row;
      const persistedId = id && originalIds.has(id) ? id : null;
      await saveFn(persistedId, data);
    }
    for (const id of removedIds) {
      await deleteFn(id);
    }
    if (statusKey) {
      setSaved(statusKey, "All changes saved");
      showToast("Saved.", "success");
    }
  } catch (err) {
    if (statusKey) setSaved(statusKey, "Save failed — see error");
    showToast(err.message || "Failed to save changes.", "error");
    throw err;
  }
}

function setUnsaved(key) {
  const el = document.getElementById(`${key}-save-status`);
  if (el) el.textContent = "Unsaved changes";
}

function setSaving(key) {
  const el = document.getElementById(`${key}-save-status`);
  if (el) el.textContent = "Saving…";
}

function setSaved(key, msg) {
  const el = document.getElementById(`${key}-save-status`);
  if (el) el.textContent = msg;
}

/* ---------------------------------------------------------------------- */
/* Roles reference                                                         */
/* ---------------------------------------------------------------------- */

function initRolesTab() {
  document.getElementById("role-cards").innerHTML = ROLES.map(
    (r) => `
    <div class="role-card">
      <div class="role-card__title">${r.label}</div>
      <div class="role-card__desc">${r.description}</div>
    </div>`
  ).join("");
}

/* ---------------------------------------------------------------------- */
/* Audit log                                                                */
/* ---------------------------------------------------------------------- */

function initAuditTab() {
  watchRecentAuditLog(500, (entries) => {
    auditData = entries;
    renderAuditTable();
  });
  document.getElementById("audit-search").addEventListener("input", renderAuditTable);
}

function renderAuditTable() {
  const term = document.getElementById("audit-search").value.trim().toLowerCase();
  const filtered = auditData.filter(
    (e) => !term || e.action.toLowerCase().includes(term) || (e.actorEmail ?? "").toLowerCase().includes(term)
  );

  document.getElementById("audit-count").textContent = `${filtered.length} of ${auditData.length} entries`;

  const container = document.getElementById("audit-table");
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">No audit log entries match your search.</div>`;
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
      <tbody>
        ${filtered
          .map(
            (e) => `
          <tr>
            <td style="white-space:nowrap;">${e.timestamp ? timeAgo(e.timestamp) : "—"}</td>
            <td>${escapeHtml(e.actorEmail ?? "—")}</td>
            <td><span class="badge badge--muted">${escapeHtml(e.action)}</span></td>
            <td class="audit-details">${escapeHtml(safeJson(e.details))}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function safeJson(details) {
  try {
    return JSON.stringify(details ?? {});
  } catch {
    return "";
  }
}

/* ---------------------------------------------------------------------- */
/* Backups                                                                  */
/* ---------------------------------------------------------------------- */

function initBackupsTab() {
  document.getElementById("export-backup-btn").addEventListener("click", async () => {
    const status = document.getElementById("backup-status");
    status.textContent = "Exporting…";
    try {
      const backup = await exportFullBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `wkcares-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      status.textContent = `Last export: ${new Date().toLocaleString()}`;
      showToast("Backup downloaded.", "success");
    } catch (err) {
      status.textContent = "Export failed.";
      showToast(err.message || "Failed to export backup.", "error");
    }
  });
}

/* ---------------------------------------------------------------------- */
/* Modal helpers                                                           */
/* ---------------------------------------------------------------------- */

function openModal(modal) {
  modal.hidden = false;
}

function closeModal(modal) {
  modal.hidden = true;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers/contexts without Clipboard API permission.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

/* ---------------------------------------------------------------------- */
/* Shared helpers                                                          */
/* ---------------------------------------------------------------------- */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function escapeAttr(val) {
  return String(val ?? "").replace(/"/g, "&quot;");
}

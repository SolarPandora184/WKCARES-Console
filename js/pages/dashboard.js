// js/pages/dashboard.js
import { onAuthReady } from "../firebase/auth.js";
import { renderShell } from "../components/navbar.js";
import { formatClock, formatLongDate, timeAgo } from "../utils/date.js";
import {
  watchRecentNets,
  watchRecentAuditLog,
  watchOpenEmergencyTraffic,
} from "../firebase/db.js";
import { totalStaffPresent, totalBandCheckins, totalGuests, gridTotals, mountainMetroColumns } from "../utils/calc.js";

onAuthReady((user, profile) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  renderShell("index.html", profile);
  document.getElementById("welcome-heading").textContent = `Welcome, ${profile?.name ?? ""}`;
  init();
});

function init() {
  startClock();
  watchRecentNets(10, renderRecentNetsAndStats);
  watchRecentAuditLog(8, renderActivity);
  watchOpenEmergencyTraffic(renderAlerts);

  document.getElementById("quick-create-btn").addEventListener("click", () => {
    window.location.href = "new-net.html";
  });
}

function startClock() {
  const clockEl = document.getElementById("current-clock");
  const dateEl = document.getElementById("current-date");
  const tick = () => {
    const now = new Date();
    clockEl.textContent = formatClock(now);
    dateEl.textContent = formatLongDate(now);
  };
  tick();
  setInterval(tick, 1000);
}

let chartInstance = null;

function renderRecentNetsAndStats(nets) {
  // --- Quick stats row ---
  const totalNets = nets.length;
  const avgAttendance = totalNets
    ? Math.round(nets.reduce((sum, n) => sum + (n.grandTotal || 0), 0) / totalNets)
    : 0;
  const lastNet = nets[0];

  document.getElementById("quick-stats").innerHTML = `
    <div class="stat"><div class="stat__value">${totalNets}</div><div class="stat__label">Nets logged (recent)</div></div>
    <div class="stat"><div class="stat__value">${avgAttendance}</div><div class="stat__label">Avg. attendance</div></div>
    <div class="stat"><div class="stat__value">${lastNet ? lastNet.grandTotal ?? 0 : "—"}</div><div class="stat__label">Last net total</div></div>
    <div class="stat"><div class="stat__value">${lastNet ? lastNet.date : "—"}</div><div class="stat__label">Last net date</div></div>
  `;

  // --- Current net (a draft with today's date, if any) ---
  const today = new Date().toISOString().slice(0, 10);
  const draft = nets.find((n) => n.status === "draft" && n.date === today);
  const currentNetBox = document.getElementById("current-net-box");
  if (draft) {
    currentNetBox.className = "";
    currentNetBox.innerHTML = `
      <p><strong>${escapeHtml(draft.netController ?? "Unassigned")}</strong> — in progress</p>
      <a class="btn btn--secondary" href="new-net.html?id=${draft.id}">Resume net</a>
    `;
  } else {
    currentNetBox.className = "empty-state";
    currentNetBox.textContent = "No net currently in progress.";
  }

  // --- Recent nets list ---
  const list = document.getElementById("recent-nets-list");
  list.innerHTML = nets.length
    ? nets
        .slice(0, 6)
        .map(
          (n) => `
      <div class="recent-net-row">
        <div>
          <div>${escapeHtml(n.netController ?? "—")} <span class="badge badge--muted">${escapeHtml(n.callsign ?? "")}</span></div>
          <div class="recent-net-row__meta">${n.date}</div>
        </div>
        <div><strong>${n.grandTotal ?? 0}</strong> checked in</div>
      </div>`
        )
        .join("")
    : `<div class="empty-state">No nets logged yet.</div>`;

  // --- Attendance chart ---
  const ctx = document.getElementById("attendance-chart");
  const ordered = [...nets].reverse(); // oldest first for a left-to-right timeline
  const data = {
    labels: ordered.map((n) => n.date),
    datasets: [
      {
        label: "Total check-ins",
        data: ordered.map((n) => n.grandTotal ?? 0),
        borderColor: "#1b3a5c",
        backgroundColor: "rgba(27, 58, 92, 0.12)",
        tension: 0.3,
        fill: true,
      },
    ],
  };
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "line",
    data,
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });
}

function renderActivity(entries) {
  const list = document.getElementById("activity-list");
  list.innerHTML = entries.length
    ? entries
        .map(
          (e) => `
      <div class="activity-item">
        <span class="activity-item__time">${e.timestamp ? timeAgo(e.timestamp) : ""}</span>
        <span>${escapeHtml(describeAction(e))}</span>
      </div>`
        )
        .join("")
    : `<div class="empty-state">No recent activity.</div>`;
}

function renderAlerts(openItems) {
  const list = document.getElementById("alerts-list");
  list.innerHTML = openItems.length
    ? openItems
        .map(
          (i) => `
      <div class="alert-item">
        <span class="material-icons" aria-hidden="true">warning</span>
        <div>
          <div><strong>${escapeHtml(i.priority ?? "Traffic")}</strong> — ${escapeHtml(i.location ?? "")}</div>
          <div class="recent-net-row__meta">${escapeHtml(i.description ?? "")} · Net ${i.netDate}</div>
        </div>
      </div>`
        )
        .join("")
    : `<div class="empty-state">No open alerts.</div>`;
}

function describeAction(entry) {
  const who = entry.actorEmail ?? "Someone";
  const map = {
    login: `${who} signed in`,
    logout: `${who} signed out`,
    net_created: `${who} created a net`,
    net_edited: `${who} edited a net`,
    net_deleted: `${who} deleted a net`,
    invitation_created: `${who} sent an invitation`,
    invitation_used: `${who} activated their account`,
    invitation_revoked: `${who} revoked an invitation`,
    password_reset_requested: `${who} requested a password reset`,
    password_reset_completed: `${who} reset their password`,
    permission_change: `${who} changed a permission`,
    user_disabled: `${who} disabled a user account`,
    user_enabled: `${who} re-enabled a user account`,
    staff_edit: `${who} updated the staff roster`,
    staff_delete: `${who} removed a staff member`,
    area_edit: `${who} updated an area controller`,
    area_delete: `${who} removed an area controller`,
    band_edit: `${who} updated a band/frequency`,
    band_delete: `${who} removed a band/frequency`,
    backup_exported: `${who} exported a backup`,
    net_script_edit: `${who} updated the net script text`,
  };
  return map[entry.action] ?? `${who} — ${entry.action}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

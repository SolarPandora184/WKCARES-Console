// js/pages/net-form.js
import { onAuthReady, getCurrentProfile } from "../firebase/auth.js";
import { renderShell } from "../components/navbar.js";
import { DynamicTable } from "../components/dynamic-table.js";
import { showToast } from "../components/toast.js";
import {
  watchStaff,
  watchAreas,
  autosaveNetDraft,
  updateNet,
  getNet,
  watchNetScript,
  watchNetFormLayout,
} from "../firebase/db.js";
import { toISODateInput } from "../utils/date.js";
import { applyScriptTemplate } from "../utils/script.js";
import {
  totalStaffPresent,
  totalBandCheckins,
  gridTotals,
  mountainMetroColumns,
  totalGuests,
} from "../utils/calc.js";

const params = new URLSearchParams(window.location.search);
const existingNetId = params.get("id");
let netId = existingNetId || null;

// In-memory model for the whole form. Every section writes into this object;
// recomputeTotals() and scheduleAutosave() run after every change.
const state = {
  netController: "",
  callsign: "",
  date: toISODateInput(),
  comments: "",
  staff: [], // [{ id, name, callsign, present }]
  bands: [], // DynamicTable rows: band, operator, callsign, frequency, count, notes
  mountain: [], // [{ area, green, yellow, red, black }] — one row per controller area
  metro: [],
  guests: [], // DynamicTable rows: name, callsign, location, notes
  emergencyTraffic: [], // DynamicTable rows: priority, location, description, resolved
  noEmergency: false,
};

let bandsTable, guestsTable, emergencyTable;
let autosaveTimer = null;

onAuthReady(async (user, profile) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  renderShell("new-net.html", profile);
  await bootstrap(profile);
});

async function bootstrap(profile) {
  // 1. If resuming a draft, load its saved data first.
  if (existingNetId) {
    const existing = await getNet(existingNetId);
    if (existing) Object.assign(state, existing);
  } else {
    // Brand-new net: default Net Controller / Callsign to whoever is signed
    // in and running this session. Still editable — someone else may be
    // taking over control for this particular net.
    state.netController = profile?.name ?? "";
    state.callsign = profile?.callsign ?? "";
  }

  // 2. Wire up static header fields.
  document.getElementById("net-controller").value = state.netController;
  document.getElementById("net-callsign").value = state.callsign;
  document.getElementById("net-date").value = state.date;
  document.getElementById("net-comments").value = state.comments;
  ["net-controller", "net-callsign", "net-date", "net-comments"].forEach((id) => {
    document.getElementById(id).addEventListener("input", onHeaderFieldChange);
  });

  // 3. Staff: merge live roster with any saved attendance for this net.
  watchStaff((rosterRows) => {
    const savedById = Object.fromEntries((state.staff || []).map((s) => [s.id, s]));
    state.staff = rosterRows.map((r) => ({ id: r.id, name: r.name, callsign: r.callsign, present: savedById[r.id]?.present ?? false }));
    renderStaffTable();
    recomputeTotals();
  });

  // 4. Mountain / Metro grids: rows come from admin-managed area controllers.
  watchAreas("mountain", (rows) => {
    state.mountain = mergeAreaRows(rows, state.mountain);
    renderAreaGrid("mountain-table", state.mountain, "mountain");
    recomputeTotals();
  });
  watchAreas("metro", (rows) => {
    state.metro = mergeAreaRows(rows, state.metro);
    renderAreaGrid("metro-table", state.metro, "metro");
    recomputeTotals();
  });

  // 5. Alternate bands — free-form dynamic table.
  bandsTable = new DynamicTable(
    document.getElementById("bands-table"),
    [
      { key: "band", label: "Band", type: "text" },
      { key: "operator", label: "Operator", type: "text" },
      { key: "callsign", label: "Callsign", type: "text" },
      { key: "frequency", label: "Frequency", type: "text" },
      { key: "count", label: "Count", type: "number" },
      { key: "notes", label: "Notes", type: "text" },
    ],
    state.bands,
    (rows) => {
      state.bands = rows;
      recomputeTotals();
    },
    { addLabel: "Add band" }
  );

  // 6. Guest check-ins — unlimited dynamic rows.
  guestsTable = new DynamicTable(
    document.getElementById("guests-table"),
    [
      { key: "name", label: "Name", type: "text" },
      { key: "callsign", label: "Callsign", type: "text" },
      { key: "location", label: "Location", type: "text" },
      { key: "notes", label: "Notes", type: "text" },
    ],
    state.guests,
    (rows) => {
      state.guests = rows;
      recomputeTotals();
    },
    { addLabel: "Add guest" }
  );

  // 7. Emergency traffic — gated by the "No emergency" checkbox.
  emergencyTable = new DynamicTable(
    document.getElementById("emergency-table"),
    [
      { key: "priority", label: "Priority", type: "select", options: ["Routine", "Priority", "Emergency"] },
      { key: "location", label: "Location", type: "text" },
      { key: "description", label: "Description", type: "text" },
      { key: "resolved", label: "Resolved", type: "checkbox" },
    ],
    state.emergencyTraffic,
    (rows) => {
      state.emergencyTraffic = rows.map((r) => ({ ...r, timestamp: r.timestamp ?? Date.now() }));
      recomputeTotals();
    },
    { addLabel: "Add emergency traffic entry" }
  );

  const noEmergencyBox = document.getElementById("no-emergency");
  noEmergencyBox.checked = !!state.noEmergency;
  toggleEmergencySection(noEmergencyBox.checked);
  noEmergencyBox.addEventListener("change", () => {
    state.noEmergency = noEmergencyBox.checked;
    toggleEmergencySection(noEmergencyBox.checked);
    recomputeTotals();
  });

  document.getElementById("finalize-btn").addEventListener("click", finalizeNet);

  // Net script text (admin-editable, from Admin Panel → Script) and the
  // Level-3-controlled card order (Admin Panel → Form Layout). Both are
  // re-applied whenever either changes, or whenever the net's own Callsign
  // field changes — since script text can contain "(ID)", which is swapped
  // for the current net's callsign every time any of that updates.
  watchNetScript((script) => {
    latestScript = script;
    renderScriptTexts(); // creates/fills custom banners, then reorders
  });
  watchNetFormLayout((layout) => {
    latestLayoutOrder = layout.order;
    renderScriptTexts(); // re-run so any newly-ordered custom banners exist before reordering
  });

  recomputeTotals();
}

/* ---------------------------------------------------------------------- */
/* Net Script text + Form Layout (see Admin Panel → Script / Form Layout)  */
/* ---------------------------------------------------------------------- */

let latestScript = null;
let latestLayoutOrder = [];

/** Fills in the two built-in script banners, substituting "(ID)" with the
 *  net's callsign. Called both when the script text changes and whenever
 *  the Callsign field changes, so the banners always reflect who's on. */
function renderScriptTexts() {
  if (latestScript) {
    const callsign = state.callsign || getCurrentProfile()?.callsign || "";
    const emergencyText = applyScriptTemplate(latestScript.emergencyPrompt, callsign);
    document.getElementById("script-emergency-1").textContent = emergencyText;
    document.getElementById("script-emergency-2").textContent = emergencyText;
    document.getElementById("script-id-yourself").textContent = applyScriptTemplate(latestScript.idYourself, callsign);
    renderCustomScriptBanners(callsign);
  }
  applyFormLayout();
}

/** Ensures every custom script section referenced in the layout order has a
 *  DOM banner element (creating any that don't exist yet), and fills in its
 *  text with the (ID) substitution applied. */
function renderCustomScriptBanners(callsign) {
  const container = document.getElementById("net-form-cards");
  const customSections = latestScript?.customSections || {};

  for (const key of latestLayoutOrder) {
    if (!key.startsWith("custom:")) continue;
    const id = key.slice("custom:".length);
    const section = customSections[id];
    if (!section) continue; // section was deleted but layout wasn't updated yet

    let el = container.querySelector(`[data-card-key="${cssEscape(key)}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "script-banner";
      el.dataset.cardKey = key;
      el.innerHTML = `
        <span class="material-icons" aria-hidden="true">campaign</span>
        <div>
          <div class="script-banner__label">Read aloud</div>
          <div class="script-banner__text"></div>
        </div>`;
      container.appendChild(el);
    }
    el.querySelector(".script-banner__text").textContent = applyScriptTemplate(section.text, callsign);
  }
}

/** Reorders the DOM children of #net-form-cards to match latestLayoutOrder.
 *  Moving an already-attached node with appendChild removes it from its old
 *  position automatically, so this is safe to re-run on every update. */
function applyFormLayout() {
  if (!latestLayoutOrder.length) return;
  const container = document.getElementById("net-form-cards");
  for (const key of latestLayoutOrder) {
    const el = container.querySelector(`[data-card-key="${cssEscape(key)}"]`);
    if (el) container.appendChild(el);
  }
}

function cssEscape(str) {
  return window.CSS && CSS.escape ? CSS.escape(str) : str.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function mergeAreaRows(adminRows, savedRows) {
  const savedByArea = Object.fromEntries((savedRows || []).map((r) => [r.area, r]));
  return adminRows.map((r) => ({
    area: r.name ?? r.area,
    green: savedByArea[r.name]?.green ?? 0,
    yellow: savedByArea[r.name]?.yellow ?? 0,
    red: savedByArea[r.name]?.red ?? 0,
    black: savedByArea[r.name]?.black ?? 0,
  }));
}

function onHeaderFieldChange() {
  state.netController = document.getElementById("net-controller").value;
  state.callsign = document.getElementById("net-callsign").value.toUpperCase();
  state.date = document.getElementById("net-date").value;
  state.comments = document.getElementById("net-comments").value;
  renderScriptTexts(); // callsign may have changed — refresh any "(ID)" placeholders
  scheduleAutosave();
}

function renderStaffTable() {
  const container = document.getElementById("staff-table");
  if (!state.staff.length) {
    container.innerHTML = `<div class="empty-state">No staff on roster yet. Add staff in Admin &rarr; Staff.</div>`;
    return;
  }
  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Present</th><th>Name</th><th>Callsign</th></tr></thead>
      <tbody>
        ${state.staff
          .map(
            (s, i) => `
          <tr>
            <td><input type="checkbox" data-staff-idx="${i}" ${s.present ? "checked" : ""} /></td>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.callsign ?? "")}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
  container.querySelectorAll("[data-staff-idx]").forEach((box) => {
    box.addEventListener("change", () => {
      state.staff[Number(box.dataset.staffIdx)].present = box.checked;
      recomputeTotals();
    });
  });
}

/** Renders a Mountain/Metro grid: rows = area controllers, columns = Green/Yellow/Red/Black,
 *  with live row totals, column totals, and a grand total footer. */
function renderAreaGrid(containerId, rows, stateKey) {
  const cols = mountainMetroColumns();
  const container = document.getElementById(containerId);

  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">No area controllers configured yet. Add them in Admin &rarr; Areas.</div>`;
    return;
  }

  const { rowTotals, colTotals, grandTotal } = gridTotals(rows, cols);

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Area</th>${cols.map((c) => `<th>${capitalize(c)}</th>`).join("")}<th>Row total</th></tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
          <tr data-row="${i}">
            <td>${escapeHtml(r.area)}</td>
            ${cols
              .map(
                (c) => `<td><input type="number" min="0" step="1" data-col="${c}" value="${r[c] || 0}" /></td>`
              )
              .join("")}
            <td><strong>${rowTotals[r.area] ?? 0}</strong></td>
          </tr>`
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td>Column total</td>
          ${cols.map((c) => `<td>${colTotals[c]}</td>`).join("")}
          <td>${grandTotal}</td>
        </tr>
      </tfoot>
    </table>
  `;

  container.querySelectorAll("input[data-col]").forEach((input) => {
    input.addEventListener("input", () => {
      const rowIdx = Number(input.closest("tr").dataset.row);
      state[stateKey][rowIdx][input.dataset.col] = Number(input.value) || 0;
      renderAreaGrid(containerId, state[stateKey], stateKey); // re-render to refresh totals
      recomputeTotals();
    });
  });
}

function toggleEmergencySection(disabled) {
  const table = document.getElementById("emergency-table");
  table.style.opacity = disabled ? 0.4 : 1;
  table.style.pointerEvents = disabled ? "none" : "auto";
}

function recomputeTotals() {
  const staffTotal = totalStaffPresent(state.staff);
  const bandsTotal = totalBandCheckins(state.bands);
  const mountainTotal = gridTotals(state.mountain, mountainMetroColumns()).grandTotal;
  const metroTotal = gridTotals(state.metro, mountainMetroColumns()).grandTotal;
  const guestsTotalCount = totalGuests(state.guests);
  const emergencyCount = state.noEmergency ? 0 : state.emergencyTraffic.length;

  document.getElementById("staff-total").textContent = staffTotal;
  document.getElementById("bands-total").textContent = bandsTotal;
  document.getElementById("mountain-total").textContent = mountainTotal;
  document.getElementById("metro-total").textContent = metroTotal;
  document.getElementById("guests-total").textContent = guestsTotalCount;
  document.getElementById("emergency-total").textContent = emergencyCount;

  const grandTotal = staffTotal + bandsTotal + mountainTotal + metroTotal + guestsTotalCount;
  document.getElementById("grand-total").textContent = grandTotal;
  state.grandTotal = grandTotal;

  scheduleAutosave();
}

function scheduleAutosave() {
  setAutosaveStatus("saving");
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    try {
      netId = await autosaveNetDraft(netId, { ...state });
      // Reflect the assigned id in the URL so a page refresh resumes the same draft.
      if (existingNetId !== netId) {
        window.history.replaceState({}, "", `new-net.html?id=${netId}`);
      }
      setAutosaveStatus("saved");
    } catch (err) {
      console.error("Autosave failed:", err);
      setAutosaveStatus("error");
    }
  }, 800);
}

function setAutosaveStatus(status) {
  const icon = document.querySelector("#autosave-indicator .material-icons");
  const text = document.getElementById("autosave-text");
  if (status === "saving") {
    icon.textContent = "cloud_sync";
    text.textContent = "Saving…";
  } else if (status === "saved") {
    icon.textContent = "cloud_done";
    text.textContent = "All changes saved";
  } else {
    icon.textContent = "cloud_off";
    text.textContent = "Save failed — check your connection";
  }
}

async function finalizeNet() {
  if (!state.netController || !state.callsign || !state.date) {
    showToast("Net Controller, Callsign, and Date are required to finalize.", "error");
    return;
  }
  try {
    netId = await autosaveNetDraft(netId, { ...state });
    await updateNet(netId, { status: "final", finalizedAt: Date.now() });
    showToast("Net finalized and saved.", "success");
    setTimeout(() => (window.location.href = "index.html"), 900);
  } catch (err) {
    console.error(err);
    showToast("Unable to finalize net. Please try again.", "error");
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

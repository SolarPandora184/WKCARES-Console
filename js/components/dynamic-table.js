// js/components/dynamic-table.js
// A small, dependency-free "add/remove row" table controller. Given a container
// element, a column schema, and initial rows, it renders an editable table body,
// wires up add/remove buttons, and calls onChange(rows) any time a cell or the
// row count changes — the caller owns totals/validation/autosave.

/**
 * @typedef {Object} ColumnDef
 * @property {string} key
 * @property {string} label
 * @property {"text"|"number"|"checkbox"|"select"} type
 * @property {string[]} [options] - for type "select"
 */

export class DynamicTable {
  /**
   * @param {HTMLElement} container - element to render <table> into
   * @param {ColumnDef[]} columns
   * @param {Array<Object>} initialRows
   * @param {(rows: Array<Object>) => void} onChange
   * @param {{addLabel?: string, emptyRow?: Object}} [opts]
   */
  constructor(container, columns, initialRows, onChange, opts = {}) {
    this.container = container;
    this.columns = columns;
    this.rows = initialRows.map((r) => ({ ...r }));
    this.onChange = onChange;
    this.addLabel = opts.addLabel ?? "Add row";
    this.emptyRow = opts.emptyRow ?? Object.fromEntries(columns.map((c) => [c.key, c.type === "checkbox" ? false : ""]));
    this.render();
  }

  addRow() {
    this.rows.push({ ...this.emptyRow, id: cryptoId() });
    this.render();
    this.emitChange();
  }

  removeRow(index) {
    this.rows.splice(index, 1);
    this.render();
    this.emitChange();
  }

  emitChange() {
    this.onChange(this.rows);
  }

  render() {
    const theadCells = this.columns.map((c) => `<th>${c.label}</th>`).join("") + "<th></th>";
    const bodyRows = this.rows
      .map(
        (row, i) => `
      <tr data-row="${i}">
        ${this.columns.map((c) => `<td>${this.renderCell(row, c, i)}</td>`).join("")}
        <td><button type="button" class="btn btn--icon dt-remove" data-row="${i}" aria-label="Remove row">
          <span class="material-icons">delete_outline</span></button></td>
      </tr>`
      )
      .join("");

    this.container.innerHTML = `
      <table class="data-table">
        <thead><tr>${theadCells}</tr></thead>
        <tbody>${bodyRows || `<tr><td colspan="${this.columns.length + 1}" class="empty-state">No rows yet.</td></tr>`}</tbody>
      </table>
      <button type="button" class="btn btn--secondary dt-add" style="margin-top:10px;">
        <span class="material-icons" aria-hidden="true">add</span> ${this.addLabel}
      </button>
    `;

    this.container.querySelectorAll(".dt-remove").forEach((btn) =>
      btn.addEventListener("click", () => this.removeRow(Number(btn.dataset.row)))
    );
    this.container.querySelector(".dt-add").addEventListener("click", () => this.addRow());

    this.container.querySelectorAll("[data-field]").forEach((input) => {
      const evt = input.type === "checkbox" ? "change" : "input";
      input.addEventListener(evt, () => {
        const rowIdx = Number(input.closest("tr").dataset.row);
        const key = input.dataset.field;
        this.rows[rowIdx][key] = input.type === "checkbox" ? input.checked : input.value;
        this.emitChange();
      });
    });
  }

  renderCell(row, col, rowIndex) {
    const val = row[col.key] ?? "";
    if (col.type === "checkbox") {
      return `<input type="checkbox" data-field="${col.key}" ${val ? "checked" : ""} />`;
    }
    if (col.type === "select") {
      const opts = (col.options || [])
        .map((o) => `<option value="${o}" ${o === val ? "selected" : ""}>${o}</option>`)
        .join("");
      return `<select data-field="${col.key}">${opts}</select>`;
    }
    return `<input type="${col.type}" data-field="${col.key}" value="${escapeAttr(val)}" ${col.type === "number" ? 'min="0" step="1"' : ""} />`;
  }
}

function cryptoId() {
  return crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}-${Math.random()}`;
}

function escapeAttr(val) {
  return String(val).replace(/"/g, "&quot;");
}

// js/utils/calc.js
// Pure functions that compute every total on the Weekly Net Form. Kept separate
// from DOM code so the math can be unit tested and reused by Reports/Statistics.

/** Sum of `count` across alternate band rows. */
export function totalBandCheckins(bandRows) {
  return bandRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
}

/** Staff attendance = number of staff rows marked present. */
export function totalStaffPresent(staffRows) {
  return staffRows.filter((row) => row.present).length;
}

/**
 * Mountain/Metro area grid: rows are areas (Green/Yellow/Red/Black or controllers),
 * columns are check-in categories. Returns row totals, column totals, and the
 * grand total in one pass.
 * @param {Array<Object>} rows - each row: { area: string, [colKey]: number, ... }
 * @param {Array<string>} colKeys - which keys on each row are numeric columns
 */
export function gridTotals(rows, colKeys) {
  const rowTotals = {};
  const colTotals = Object.fromEntries(colKeys.map((k) => [k, 0]));
  let grandTotal = 0;

  for (const row of rows) {
    let rowSum = 0;
    for (const key of colKeys) {
      const val = Number(row[key]) || 0;
      rowSum += val;
      colTotals[key] += val;
    }
    rowTotals[row.area ?? row.id] = rowSum;
    grandTotal += rowSum;
  }

  return { rowTotals, colTotals, grandTotal };
}

/** Guest check-ins is just row count (unlimited dynamic rows). */
export function totalGuests(guestRows) {
  return guestRows.length;
}

/** Emergency traffic count, split by resolved/unresolved for quick display. */
export function emergencyTrafficSummary(rows) {
  const total = rows.length;
  const resolved = rows.filter((r) => r.resolved).length;
  return { total, resolved, unresolved: total - resolved };
}

/**
 * Grand total for the whole net: staff + bands + mountain + metro + guests.
 * Emergency traffic is tracked but intentionally excluded from the headcount
 * total (it's an incident log, not an attendance category).
 */
export function netGrandTotal({ staff, bands, mountain, metro, guests }) {
  return (
    totalStaffPresent(staff) +
    totalBandCheckins(bands) +
    gridTotals(mountain, mountainMetroColumns()).grandTotal +
    gridTotals(metro, mountainMetroColumns()).grandTotal +
    totalGuests(guests)
  );
}

/** Standard column set shared by Mountain and Metro area grids. */
export function mountainMetroColumns() {
  return ["green", "yellow", "red", "black"];
}

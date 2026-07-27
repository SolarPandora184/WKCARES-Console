// js/utils/date.js

/** "Friday, July 24, 2026" style long date for dashboard header. */
export function formatLongDate(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "6:42:11 PM" — updated every second by the dashboard clock. */
export function formatClock(date = new Date()) {
  return date.toLocaleTimeString(undefined, { hour12: true });
}

/** "2026-07-24" for <input type="date"> and Firebase keys/sorting. */
export function toISODateInput(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Human-relative time for audit log / recent activity feeds. */
export function timeAgo(timestamp) {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

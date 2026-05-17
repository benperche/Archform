// Shared utilities for side-panel components.
// All five item panels (Sections, Labels, TimeSigs, Repeats, Fermatas) use
// these helpers — they live here so there is exactly one definition of each.

export { formatBar } from './layout';

// Validate a bar-number string against the current diagram range.
// Returns a human-readable warning string, or null when the value is valid.
export function barWarning(barStr, rows) {
  const b = parseFloat(barStr);
  if (isNaN(b) || !rows || rows.length === 0) return null;
  const firstBar = rows[0].phrases[0].startBar;
  const lastRow = rows[rows.length - 1];
  const lastPhrase = lastRow.phrases[lastRow.phrases.length - 1];
  const lastBar = lastPhrase.startBar + lastPhrase.length;
  if (b < firstBar || b > lastBar)
    return `Bar ${b} is outside the diagram (${firstBar}–${lastBar})`;
  return null;
}

// Find the layout row that contains a given bar number.
// Bars sitting exactly on a row boundary map to the *next* row, matching the
// priority used by barToPosition in layout.js.
export function rowForBar(bar, rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const first = row.phrases[0].startBar;
    const last = row.phrases[row.phrases.length - 1];
    const end = last.startBar + last.length;
    const isLast = i === rows.length - 1;
    if (bar >= first && (isLast ? bar <= end : bar < end)) return row;
  }
  return rows[rows.length - 1] ?? null;
}

// Group a sorted item array by layout row for multi-system panel display.
// Returns [{row, items[]}] or null when there is only one row (no dividers needed).
export function groupItems(items, barKey, rows) {
  if (!rows || rows.length <= 1) return null;
  const map = new Map(rows.map(r => [r.rowIndex, { row: r, items: [] }]));
  for (const item of items) {
    const row = rowForBar(item[barKey], rows);
    if (row) map.get(row.rowIndex)?.items.push(item);
  }
  return [...map.values()].filter(g => g.items.length > 0);
}

// Row separator shown in panel lists when the diagram has multiple systems.
export function SystemDivider({ row, first }) {
  const firstBar = row.phrases[0].startBar;
  const last = row.phrases[row.phrases.length - 1];
  const lastBar = last.startBar + last.length;
  return (
    <div
      className="panel-system-divider"
      style={first ? { borderTop: 'none', marginTop: 0, paddingTop: 0 } : {}}
    >
      <span>System {row.rowIndex + 1}</span>
      <span className="panel-system-bars">bars {firstBar}–{lastBar}</span>
    </div>
  );
}

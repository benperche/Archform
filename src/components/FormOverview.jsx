import { getBarRange } from '../utils/layout';

// Miniature map of the whole piece, driven by sections. Rendered as HTML above
// the diagram (outside the exported SVG), so it never appears in SVG/PNG
// exports or print. Clicking a block scrolls to that bar. When sections exist
// at several levels (broad / mid / fine), each level gets its own stacked row.
export default function FormOverview({ sections, layoutRows, onNavigate }) {
  const range = getBarRange(layoutRows);
  if (!range || sections.length === 0) return null;

  const { firstBar, lastBar } = range;
  const clamp = bar => Math.max(firstBar, Math.min(lastBar, bar));

  // Turn one level's sections into a list of blocks + gaps spanning the piece.
  // Resolve each section's extent: explicit endBar, else the next section's
  // start, else the end of the piece.
  const buildBlocks = levelSections => {
    const shown = levelSections.slice().sort((a, b) => a.startBar - b.startBar);
    const blocks = [];
    let cursor = firstBar;
    shown.forEach((s, i) => {
      const start = clamp(s.startBar);
      const end = clamp(s.endBar ?? shown[i + 1]?.startBar ?? lastBar);
      if (start > cursor) blocks.push({ key: `gap-${i}`, span: start - cursor, gap: true });
      if (end > start) {
        blocks.push({ key: s.id, span: end - start, label: s.label, color: s.color || '#1a1a1a', start, end });
        cursor = Math.max(cursor, end);
      }
    });
    if (cursor < lastBar) blocks.push({ key: 'gap-tail', span: lastBar - cursor, gap: true });
    return blocks;
  };

  // One row per populated level, broad (0) at the top down to fine.
  const levels = [...new Set(sections.map(s => s.level ?? 0))].sort((a, b) => a - b);
  const rows = levels
    .map(level => ({ level, blocks: buildBlocks(sections.filter(s => (s.level ?? 0) === level)) }))
    .filter(r => r.blocks.some(b => !b.gap));

  if (rows.length === 0) return null;

  return (
    <div className="form-overview" role="navigation" aria-label="Form overview">
      {rows.map(row => (
        <div key={row.level} className="form-overview-row">
          {row.blocks.map(b => b.gap ? (
            <div key={b.key} className="form-overview-gap" style={{ flexGrow: b.span }} />
          ) : (
            <button
              key={b.key}
              className="form-overview-block"
              style={{
                flexGrow: b.span,
                background: `color-mix(in srgb, ${b.color} 16%, white)`,
                borderColor: `color-mix(in srgb, ${b.color} 35%, white)`,
                color: b.color,
              }}
              title={`${b.label} · bars ${b.start}–${b.end}`}
              onClick={() => onNavigate(b.start)}
            >
              <span className="form-overview-label">{b.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

import { getBarRange } from '../utils/layout';

// Miniature map of the whole piece, driven by sections. Rendered as HTML above
// the diagram (outside the exported SVG), so it never appears in SVG/PNG
// exports or print. Clicking a block scrolls to that bar. When sections exist
// at several levels (broad / mid / fine), each level gets its own stacked row.
//
// Blocks are positioned by absolute percentage of the piece rather than by
// flex growth: every row then maps bar -> x identically, so levels line up
// vertically. (Flex sizing let a block widen to fit its label, which shifted
// everything after it and broke alignment between rows.)
export default function FormOverview({ sections, layoutRows, onNavigate }) {
  const range = getBarRange(layoutRows);
  if (!range || sections.length === 0) return null;

  const { firstBar, lastBar } = range;
  const span = lastBar - firstBar;
  if (span <= 0) return null;

  const clamp = bar => Math.max(firstBar, Math.min(lastBar, bar));
  const pct = bar => ((clamp(bar) - firstBar) / span) * 100;

  // One row per populated level, broad (0) at the top down to fine.
  const levels = [...new Set(sections.map(s => s.level ?? 0))].sort((a, b) => a - b);
  const rows = levels
    .map(level => {
      const shown = sections
        .filter(s => (s.level ?? 0) === level)
        .slice()
        .sort((a, b) => a.startBar - b.startBar);
      // Resolve each section's extent: explicit endBar, else the next
      // section's start, else the end of the piece.
      const blocks = shown
        .map((s, i) => {
          const start = clamp(s.startBar);
          const end = clamp(s.endBar ?? shown[i + 1]?.startBar ?? lastBar);
          if (end <= start) return null;
          const left = pct(start);
          return {
            id: s.id,
            label: s.label,
            color: s.color || '#1a1a1a',
            start,
            end,
            left,
            width: pct(end) - left,
          };
        })
        .filter(Boolean);
      return { level, blocks };
    })
    .filter(r => r.blocks.length > 0);

  if (rows.length === 0) return null;

  return (
    <div className="form-overview" role="navigation" aria-label="Form overview">
      {rows.map(row => (
        <div key={row.level} className="form-overview-row">
          {row.blocks.map(b => (
            <button
              key={b.id}
              className="form-overview-block"
              style={{
                left: `${b.left}%`,
                width: `${b.width}%`,
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

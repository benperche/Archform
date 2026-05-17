import { useState, useEffect, useRef } from 'react';

const LEVEL_LABELS = ['Broad', 'Mid', 'Fine'];

const COLORS = [
  '#1a1a1a',
  '#2563eb',
  '#c0392b',
  '#16a34a',
  '#7c3aed',
  '#d97706',
];

function ColorPicker({ value, onChange }) {
  return (
    <div className="color-picker">
      {COLORS.map(c => (
        <button
          key={c}
          className={`color-swatch${value === c ? ' color-swatch--active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          title={c}
        />
      ))}
    </div>
  );
}

const fmtBar = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function rowForBar(bar, rows) {
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

function groupItems(items, barKey, rows) {
  // Returns [{row, items[]}] sorted by row, or null when ≤1 row.
  if (!rows || rows.length <= 1) return null;
  const map = new Map(rows.map(r => [r.rowIndex, { row: r, items: [] }]));
  for (const item of items) {
    const row = rowForBar(item[barKey], rows);
    if (row) map.get(row.rowIndex)?.items.push(item);
  }
  return [...map.values()].filter(g => g.items.length > 0);
}

function SystemDivider({ row, first }) {
  const firstBar = row.phrases[0].startBar;
  const last = row.phrases[row.phrases.length - 1];
  const lastBar = last.startBar + last.length;
  return (
    <div className="panel-system-divider" style={first ? { borderTop: 'none', marginTop: 0, paddingTop: 0 } : {}}>
      <span>System {row.rowIndex + 1}</span>
      <span className="panel-system-bars">bars {fmtBar(firstBar)}–{fmtBar(lastBar)}</span>
    </div>
  );
}

export default function SectionPanel({
  onClose,
  sections,
  onAdd,
  onRemove,
  onUpdate,
  onBarFieldFocus,
  pickedBar,
  layoutRows = [],
}) {
  const [label, setLabel] = useState('');
  const [startBar, setStartBar] = useState('');
  const [endBar, setEndBar] = useState('');
  const [level, setLevel] = useState(0);
  const [color, setColor] = useState(COLORS[0]);

  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});

  const focusedField = useRef(null);

  useEffect(() => {
    if (!pickedBar) return;
    const val = String(pickedBar.value);
    if (pickedBar.field === 'startBar') setStartBar(val);
    else if (pickedBar.field === 'endBar') setEndBar(val);
    else if (pickedBar.field === 'editStartBar') setEditFields(f => ({ ...f, startBar: val }));
    else if (pickedBar.field === 'editEndBar') setEditFields(f => ({ ...f, endBar: val }));
  }, [pickedBar]);

  const handleFocus = field => { focusedField.current = field; onBarFieldFocus?.(field); };
  const handleBlur = () => { setTimeout(() => { focusedField.current = null; onBarFieldFocus?.(null); }, 150); };

  const canAdd = label.trim() && startBar.trim() && !isNaN(parseFloat(startBar));

  const handleAdd = () => {
    if (!canAdd) return;
    const sb = parseFloat(startBar);
    const eb = endBar.trim() ? parseFloat(endBar) : null;
    onAdd({ label: label.trim(), startBar: sb, endBar: isNaN(eb) ? null : eb, level, color });
    setLabel(''); setStartBar(''); setEndBar(''); setLevel(0); setColor(COLORS[0]);
  };

  const startEdit = s => {
    setEditingId(s.id);
    setEditFields({
      label: s.label,
      startBar: String(s.startBar),
      endBar: s.endBar != null ? String(s.endBar) : '',
      level: s.level ?? 0,
      color: s.color || COLORS[0],
    });
  };

  const ef = v => setEditFields(f => ({ ...f, ...v }));

  const saveEdit = () => {
    const sb = parseFloat(editFields.startBar);
    if (isNaN(sb) || !editFields.label.trim()) return;
    const eb = editFields.endBar?.trim() ? parseFloat(editFields.endBar) : null;
    onUpdate(editingId, {
      label: editFields.label.trim(),
      startBar: sb,
      endBar: isNaN(eb) ? null : eb,
      level: editFields.level,
      color: editFields.color,
    });
    setEditingId(null); setEditFields({});
  };

  const cancelEdit = () => { setEditingId(null); setEditFields({}); };

  const handleKey = e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') cancelEdit(); };
  const handleEditKey = e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); };

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <span>Sections</span>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      <div className="side-panel-body">
        <div className="panel-form">
          <label className="panel-label">Label</label>
          <input className="panel-input" value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={handleKey} placeholder="Exposition" autoFocus />

          <div className="panel-row">
            <div style={{ flex: 1 }}>
              <label className="panel-label">Start bar<span className="panel-click-hint"> — click diagram</span></label>
              <input className="panel-input" type="number" value={startBar}
                onChange={e => setStartBar(e.target.value)}
                onFocus={() => handleFocus('startBar')} onBlur={handleBlur}
                onKeyDown={handleKey} placeholder="1" min="1" step="0.5" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="panel-label">End bar<span className="panel-optional"> (opt.)</span><span className="panel-click-hint"> — click</span></label>
              <input className="panel-input" type="number" value={endBar}
                onChange={e => setEndBar(e.target.value)}
                onFocus={() => handleFocus('endBar')} onBlur={handleBlur}
                onKeyDown={handleKey} placeholder="open" min="1" step="0.5" />
            </div>
          </div>

          <label className="panel-label">Level</label>
          <div className="level-picker">
            {LEVEL_LABELS.map((lbl, i) => (
              <button key={i} className={`level-btn ${level === i ? 'active' : ''}`} onClick={() => setLevel(i)}>{lbl}</button>
            ))}
          </div>

          <label className="panel-label">Colour</label>
          <ColorPicker value={color} onChange={setColor} />

          <button className="btn btn-primary panel-add-btn" onClick={handleAdd} disabled={!canAdd}>
            Add section
          </button>
        </div>

        <div className="panel-list">
          {sections.length === 0 ? (
            <p className="panel-empty">No sections yet</p>
          ) : (() => {
            const sorted = [...sections].sort((a, b) => (a.startBar ?? 0) - (b.startBar ?? 0));
            const groups = groupItems(sorted, 'startBar', layoutRows);

            const renderSection = s => (
              editingId === s.id ? (
                <div key={s.id} className="panel-item panel-item--editing">
                  <input className="panel-input" value={editFields.label}
                    onChange={e => ef({ label: e.target.value })} onKeyDown={handleEditKey} />
                  <div className="panel-row" style={{ marginTop: 6 }}>
                    <input className="panel-input" type="number" value={editFields.startBar}
                      onChange={e => ef({ startBar: e.target.value })}
                      onFocus={() => handleFocus('editStartBar')} onBlur={handleBlur}
                      onKeyDown={handleEditKey} placeholder="Start" step="0.5" />
                    <input className="panel-input" type="number" value={editFields.endBar}
                      onChange={e => ef({ endBar: e.target.value })}
                      onFocus={() => handleFocus('editEndBar')} onBlur={handleBlur}
                      onKeyDown={handleEditKey} placeholder="End (opt.)" step="0.5" />
                  </div>
                  <div className="level-picker" style={{ marginTop: 6 }}>
                    {LEVEL_LABELS.map((lbl, i) => (
                      <button key={i} className={`level-btn ${editFields.level === i ? 'active' : ''}`}
                        onClick={() => ef({ level: i })}>{lbl}</button>
                    ))}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <ColorPicker value={editFields.color || COLORS[0]} onChange={c => ef({ color: c })} />
                  </div>
                  <div className="panel-edit-actions">
                    <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                    <button className="btn" onClick={cancelEdit}>Cancel</button>
                    <button className="item-delete" onClick={() => { onRemove(s.id); cancelEdit(); }}>✕</button>
                  </div>
                </div>
              ) : (
                <div key={s.id} className="panel-item panel-item--clickable" onClick={() => startEdit(s)}>
                  <div className="section-color-dot" style={{ background: s.color || COLORS[0] }} />
                  <div className="panel-item-info">
                    <span className="panel-item-label">{s.label}</span>
                    <span className="panel-item-meta">{s.startBar}–{s.endBar != null ? s.endBar : '…'} · {LEVEL_LABELS[s.level] || 'Broad'}</span>
                  </div>
                  <button className="item-delete" onClick={e => { e.stopPropagation(); onRemove(s.id); }}>✕</button>
                </div>
              )
            );

            if (groups) {
              return groups.map((g, gi) => (
                <div key={g.row.rowIndex}>
                  <SystemDivider row={g.row} first={gi === 0} />
                  {g.items.map(renderSection)}
                </div>
              ));
            }
            return sorted.map(renderSection);
          })()}
        </div>
      </div>
    </div>
  );
}

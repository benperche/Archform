import { useState, useEffect, useRef } from 'react';
import { TrashIcon } from './Icons';

const TYPE_OPTIONS = [
  { value: 'start',  label: '||:  Start repeat' },
  { value: 'end',    label: ':||  End repeat' },
  { value: 'double', label: '||   Double barline' },
  { value: 'final',  label: '=|   Final barline' },
];

const fmtBar = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function barWarning(barStr, rows) {
  const b = parseFloat(barStr);
  if (isNaN(b) || !rows || rows.length === 0) return null;
  const firstBar = rows[0].phrases[0].startBar;
  const lastRow = rows[rows.length - 1];
  const lastPhrase = lastRow.phrases[lastRow.phrases.length - 1];
  const lastBar = lastPhrase.startBar + lastPhrase.length;
  if (b < firstBar || b > lastBar) return `Bar ${b} is outside the diagram (${fmtBar(firstBar)}–${fmtBar(lastBar)})`;
  return null;
}

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

function typeLabel(type) {
  return TYPE_OPTIONS.find(o => o.value === type)?.label ?? type;
}

export default function RepeatsPanel({
  onClose,
  repeats,
  onAdd,
  onRemove,
  onUpdate,
  onBarFieldFocus,
  pickedBar,
  layoutRows = [],
  requestEditId,
  onEditChange,
}) {
  const [bar, setBar] = useState('');
  const [type, setType] = useState('start');
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});
  const focusedField = useRef(null);

  // Open editor when canvas click targets a specific item
  useEffect(() => {
    if (!requestEditId) return;
    const item = repeats.find(r => r.id === requestEditId);
    if (item) { setEditingId(item.id); setEditFields({ bar: String(item.bar), type: item.type }); }
  }, [requestEditId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onEditChange?.(editingId); }, [editingId, onEditChange]);

  useEffect(() => {
    if (!pickedBar) return;
    const val = String(pickedBar.value);
    if (pickedBar.field === 'repeatBar') setBar(val);
    else if (pickedBar.field === 'editRepeatBar') setEditFields(f => ({ ...f, bar: val }));
  }, [pickedBar]);

  const handleFocus = field => { focusedField.current = field; onBarFieldFocus?.(field); };
  const handleBlur = () => { setTimeout(() => { focusedField.current = null; onBarFieldFocus?.(null); }, 150); };

  const canAdd = bar.trim() && !isNaN(parseFloat(bar));

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ bar: parseFloat(bar), type });
    setBar('');
  };

  const startEdit = r => {
    setEditingId(r.id);
    setEditFields({ bar: String(r.bar), type: r.type });
  };

  const ef = v => setEditFields(f => ({ ...f, ...v }));

  const saveEdit = () => {
    const b = parseFloat(editFields.bar);
    if (isNaN(b)) return;
    onUpdate(editingId, { bar: b, type: editFields.type });
    setEditingId(null); setEditFields({});
  };

  const cancelEdit = () => { setEditingId(null); setEditFields({}); };

  const handleKey = e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') cancelEdit(); };
  const handleEditKey = e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); };

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <span>Barlines &amp; Repeats</span>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      <div className="side-panel-body">
        <div className="panel-form">
          <div className="panel-row" style={{ alignItems: 'flex-end', gap: 8 }}>
            <div style={{ flex: '0 0 76px' }}>
              <label className="panel-label">Bar <span className="panel-click-hint">— click</span></label>
              <input className="panel-input" type="number" value={bar}
                onChange={e => setBar(e.target.value)}
                onFocus={() => handleFocus('repeatBar')} onBlur={handleBlur}
                onKeyDown={handleKey} placeholder="1" min="1" step="0.5" autoFocus />
            </div>
            <div style={{ flex: 1 }}>
              <label className="panel-label">Type</label>
              <select className="panel-input" value={type} onChange={e => setType(e.target.value)}
                style={{ cursor: 'pointer' }}>
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {barWarning(bar, layoutRows) && (
            <p className="panel-bar-warning">⚠ {barWarning(bar, layoutRows)}</p>
          )}
          <button className="btn btn-primary panel-add-btn" onClick={handleAdd} disabled={!canAdd}>
            Add barline
          </button>
        </div>

        <div className="panel-list">
          {repeats.length === 0 ? (
            <p className="panel-empty">No barlines yet</p>
          ) : (() => {
            const sorted = [...repeats].sort((a, b) => (a.bar ?? 0) - (b.bar ?? 0));
            const groups = groupItems(sorted, 'bar', layoutRows);

            const renderRepeat = r => (
              editingId === r.id ? (
                <div key={r.id} className="panel-item panel-item--editing">
                  <div className="panel-row" style={{ gap: 8 }}>
                    <input className="panel-input" type="number" value={editFields.bar}
                      onChange={e => ef({ bar: e.target.value })}
                      onFocus={() => handleFocus('editRepeatBar')} onBlur={handleBlur}
                      onKeyDown={handleEditKey} placeholder="Bar" step="0.5"
                      style={{ flex: '0 0 72px' }} />
                    <select className="panel-input" value={editFields.type}
                      onChange={e => ef({ type: e.target.value })} style={{ flex: 1, cursor: 'pointer' }}>
                      {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  {barWarning(editFields.bar, layoutRows) && (
                    <p className="panel-bar-warning">⚠ {barWarning(editFields.bar, layoutRows)}</p>
                  )}
                  <div className="panel-edit-actions">
                    <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                    <button className="btn" onClick={cancelEdit}>Cancel</button>
                    <button className="item-delete" title="Delete" onClick={() => { onRemove(r.id); cancelEdit(); }}><TrashIcon /></button>
                  </div>
                </div>
              ) : (
                <div key={r.id} className="panel-item panel-item--clickable" onClick={() => startEdit(r)}>
                  <div className="panel-item-info">
                    <span className="panel-item-label">{typeLabel(r.type)}</span>
                    <span className="panel-item-meta">bar {fmtBar(r.bar)}</span>
                  </div>
                  <button className="item-delete" title="Delete" onClick={e => { e.stopPropagation(); onRemove(r.id); }}><TrashIcon /></button>
                </div>
              )
            );

            if (groups) {
              return groups.map((g, gi) => (
                <div key={g.row.rowIndex}>
                  <SystemDivider row={g.row} first={gi === 0} />
                  {g.items.map(renderRepeat)}
                </div>
              ));
            }
            return sorted.map(renderRepeat);
          })()}
        </div>
      </div>
    </div>
  );
}

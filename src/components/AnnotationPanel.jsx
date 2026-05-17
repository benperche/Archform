import { useState, useEffect, useRef } from 'react';
import { TrashIcon } from './Icons';

const fmtBar = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function rowForBar(bar, rows) {
  // Use strict < on the end boundary so a bar sitting exactly at a row
  // boundary (end of row N = start of row N+1) maps to the *next* row,
  // matching the same priority logic as barToPosition in layout.js.
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

export default function AnnotationPanel({
  onClose,
  annotations,
  onAddAnnotation,
  onRemoveAnnotation,
  onUpdateAnnotation,
  onBarFieldFocus,
  pickedBar,
  layoutRows = [],
  requestEditId,
  onEditChange,
  prefillBar,
}) {
  const [annBar, setAnnBar] = useState('');
  const [annText, setAnnText] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});

  const focusedField = useRef(null);

  // Pre-fill bar field when "Add Annotation Here" is triggered from a phrase popover.
  // prefillBar is a { bar, ts } object; ts changes every time so the effect always fires.
  useEffect(() => {
    if (prefillBar != null) { setAnnBar(String(prefillBar.bar)); setEditingId(null); }
  }, [prefillBar]);

  // Open the editor for a specific annotation when requested from the canvas.
  useEffect(() => {
    if (!requestEditId) return;
    const item = annotations.find(a => a.id === requestEditId);
    if (item) { setEditingId(item.id); setEditFields({ bar: String(item.bar), text: item.text }); }
  }, [requestEditId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Report editing id changes back to App so the canvas can highlight the active annotation.
  useEffect(() => { onEditChange?.(editingId); }, [editingId, onEditChange]);

  useEffect(() => {
    if (!pickedBar) return;
    const val = String(pickedBar.value);
    if (pickedBar.field === 'annotationBar') setAnnBar(val);
    else if (pickedBar.field === 'editAnnotationBar') setEditFields(f => ({ ...f, bar: val }));
  }, [pickedBar]);

  const handleFocus = field => { focusedField.current = field; onBarFieldFocus?.(field); };
  const handleBlur = () => { setTimeout(() => { focusedField.current = null; onBarFieldFocus?.(null); }, 150); };

  const canAdd = annBar.trim() && !isNaN(parseFloat(annBar)) && annText.trim();

  const handleAdd = () => {
    if (!canAdd) return;
    onAddAnnotation({ bar: parseFloat(annBar), text: annText.trim() });
    setAnnBar(''); setAnnText('');
  };

  const startEdit = a => {
    setEditingId(a.id);
    setEditFields({ bar: String(a.bar), text: a.text });
  };

  const ef = v => setEditFields(f => ({ ...f, ...v }));

  const saveEdit = () => {
    const b = parseFloat(editFields.bar);
    if (isNaN(b) || !editFields.text?.trim()) return;
    onUpdateAnnotation(editingId, { bar: b, text: editFields.text.trim() });
    setEditingId(null); setEditFields({});
  };

  const cancelEdit = () => { setEditingId(null); setEditFields({}); };

  const handleKey = e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') cancelEdit(); };
  const handleEditKey = e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); };

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <span>Annotations</span>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      <div className="side-panel-body">
        <div className="panel-form">
          <div className="panel-row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 80px' }}>
              <label className="panel-label">
                Bar <span className="panel-click-hint">— click diagram</span>
              </label>
              <input className="panel-input" type="number" value={annBar}
                onChange={e => setAnnBar(e.target.value)}
                onFocus={() => handleFocus('annotationBar')} onBlur={handleBlur}
                onKeyDown={handleKey} placeholder="1" min="1" step="0.5" autoFocus />
            </div>
            <div style={{ flex: 1 }}>
              <label className="panel-label">Text</label>
              <input className="panel-input" value={annText}
                onChange={e => setAnnText(e.target.value)}
                onKeyDown={handleKey} placeholder="Clarinet" />
            </div>
          </div>
          <button className="btn btn-primary panel-add-btn" onClick={handleAdd} disabled={!canAdd}>
            Add annotation
          </button>
        </div>

        <div className="panel-list">
          {annotations.length === 0 ? (
            <p className="panel-empty">No annotations yet</p>
          ) : (() => {
            const sorted = [...annotations].sort((a, b) => (a.bar ?? 0) - (b.bar ?? 0));
            const groups = groupItems(sorted, 'bar', layoutRows);

            const renderAnnotation = a => (
              editingId === a.id ? (
                <div key={a.id} className="panel-item panel-item--editing">
                  <div className="panel-row">
                    <input className="panel-input" type="number" value={editFields.bar}
                      onChange={e => ef({ bar: e.target.value })}
                      onFocus={() => handleFocus('editAnnotationBar')} onBlur={handleBlur}
                      onKeyDown={handleEditKey} placeholder="Bar" step="0.5"
                      style={{ flex: '0 0 72px' }} />
                    <input className="panel-input" value={editFields.text}
                      onChange={e => ef({ text: e.target.value })}
                      onKeyDown={handleEditKey} placeholder="Text" />
                  </div>
                  <div className="panel-edit-actions">
                    <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                    <button className="btn" onClick={cancelEdit}>Cancel</button>
                    <button className="item-delete" title="Delete" onClick={() => { onRemoveAnnotation(a.id); cancelEdit(); }}><TrashIcon /></button>
                  </div>
                </div>
              ) : (
                <div key={a.id} className="panel-item panel-item--clickable" onClick={() => startEdit(a)}>
                  <div className="panel-item-info">
                    <span className="panel-item-label" style={{ fontStyle: 'italic' }}>{a.text}</span>
                    <span className="panel-item-meta">bar {a.bar}</span>
                  </div>
                  <button className="item-delete" title="Delete" onClick={e => { e.stopPropagation(); onRemoveAnnotation(a.id); }}><TrashIcon /></button>
                </div>
              )
            );

            if (groups) {
              return groups.map((g, gi) => (
                <div key={g.row.rowIndex}>
                  <SystemDivider row={g.row} first={gi === 0} />
                  {g.items.map(renderAnnotation)}
                </div>
              ));
            }
            return sorted.map(renderAnnotation);
          })()}
        </div>
      </div>
    </div>
  );
}

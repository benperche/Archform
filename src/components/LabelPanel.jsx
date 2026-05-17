import { useState, useEffect, useRef } from 'react';
import { TrashIcon } from './Icons';
import { barWarning, groupItems, SystemDivider } from '../utils/panelUtils';

export default function LabelPanel({
  onClose,
  labels,
  onAddLabel,
  onRemoveLabel,
  onUpdateLabel,
  onBarFieldFocus,
  pickedBar,
  layoutRows = [],
  requestEditId,
  onEditChange,
  prefillBar,
}) {
  const [labelBar, setLabelBar] = useState('');
  const [labelText, setLabelText] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});

  const focusedField = useRef(null);

  // Pre-fill bar field when "Add Label Here" is triggered from a phrase popover.
  useEffect(() => {
    if (prefillBar != null) { setLabelBar(String(prefillBar.bar)); setEditingId(null); }
  }, [prefillBar]);

  // Open the editor for a specific label when requested from the canvas.
  useEffect(() => {
    if (!requestEditId) return;
    const item = labels.find(a => a.id === requestEditId);
    if (item) { setEditingId(item.id); setEditFields({ bar: String(item.bar), text: item.text }); }
  }, [requestEditId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Report editing id changes back to App so the canvas can highlight the active label.
  useEffect(() => { onEditChange?.(editingId); }, [editingId, onEditChange]);

  useEffect(() => {
    if (!pickedBar) return;
    const val = String(pickedBar.value);
    if (pickedBar.field === 'labelBar') setLabelBar(val);
    else if (pickedBar.field === 'editLabelBar') setEditFields(f => ({ ...f, bar: val }));
  }, [pickedBar]);

  const handleFocus = field => { focusedField.current = field; onBarFieldFocus?.(field); };
  const handleBlur = () => { setTimeout(() => { focusedField.current = null; onBarFieldFocus?.(null); }, 150); };

  const canAdd = labelBar.trim() && !isNaN(parseFloat(labelBar)) && labelText.trim();

  const handleAdd = () => {
    if (!canAdd) return;
    onAddLabel({ bar: parseFloat(labelBar), text: labelText.trim() });
    setLabelBar(''); setLabelText('');
  };

  const startEdit = a => {
    setEditingId(a.id);
    setEditFields({ bar: String(a.bar), text: a.text });
  };

  const ef = v => setEditFields(f => ({ ...f, ...v }));

  const saveEdit = () => {
    const b = parseFloat(editFields.bar);
    if (isNaN(b) || !editFields.text?.trim()) return;
    onUpdateLabel(editingId, { bar: b, text: editFields.text.trim() });
    setEditingId(null); setEditFields({});
  };

  const cancelEdit = () => { setEditingId(null); setEditFields({}); };

  const handleKey = e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') cancelEdit(); };
  const handleEditKey = e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); };

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <span>Labels</span>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      <div className="side-panel-body">
        <div className="panel-form">
          <div className="panel-row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 80px' }}>
              <label className="panel-label">
                Bar <span className="panel-click-hint">— click diagram</span>
              </label>
              <input className="panel-input" type="number" value={labelBar}
                onChange={e => setLabelBar(e.target.value)}
                onFocus={() => handleFocus('labelBar')} onBlur={handleBlur}
                onKeyDown={handleKey} placeholder="1" min="1" step="0.5" autoFocus />
            </div>
            <div style={{ flex: 1 }}>
              <label className="panel-label">Text</label>
              <input className="panel-input" value={labelText}
                onChange={e => setLabelText(e.target.value)}
                onKeyDown={handleKey} placeholder="Clarinet" />
            </div>
          </div>
          {barWarning(labelBar, layoutRows) && (
            <p className="panel-bar-warning">⚠ {barWarning(labelBar, layoutRows)}</p>
          )}
          <p className="panel-glyph-hint">
            Tip: type <code>q</code>, <code>h</code>, <code>e</code> etc. in the text to insert note symbols — see ? for full list.
          </p>
          <button className="btn btn-primary panel-add-btn" onClick={handleAdd} disabled={!canAdd}>
            Add label
          </button>
        </div>

        <div className="panel-list">
          {labels.length === 0 ? (
            <p className="panel-empty">No labels yet</p>
          ) : (() => {
            const sorted = [...labels].sort((a, b) => (a.bar ?? 0) - (b.bar ?? 0));
            const groups = groupItems(sorted, 'bar', layoutRows);

            const renderLabel = a => (
              editingId === a.id ? (
                <div key={a.id} className="panel-item panel-item--editing">
                  <div className="panel-row">
                    <input className="panel-input" type="number" value={editFields.bar}
                      onChange={e => ef({ bar: e.target.value })}
                      onFocus={() => handleFocus('editLabelBar')} onBlur={handleBlur}
                      onKeyDown={handleEditKey} placeholder="Bar" step="0.5"
                      style={{ flex: '0 0 72px' }} />
                    <input className="panel-input" value={editFields.text}
                      onChange={e => ef({ text: e.target.value })}
                      onKeyDown={handleEditKey} placeholder="Text" />
                  </div>
                  {barWarning(editFields.bar, layoutRows) && (
                    <p className="panel-bar-warning">⚠ {barWarning(editFields.bar, layoutRows)}</p>
                  )}
                  <div className="panel-edit-actions">
                    <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                    <button className="btn" onClick={cancelEdit}>Cancel</button>
                    <button className="item-delete" title="Delete" onClick={() => { onRemoveLabel(a.id); cancelEdit(); }}><TrashIcon /></button>
                  </div>
                </div>
              ) : (
                <div key={a.id} className="panel-item panel-item--clickable" onClick={() => startEdit(a)}>
                  <div className="panel-item-info">
                    <span className="panel-item-label" style={{ fontStyle: 'italic' }}>{a.text}</span>
                    <span className="panel-item-meta">bar {a.bar}</span>
                  </div>
                  <button className="item-delete" title="Delete" onClick={e => { e.stopPropagation(); onRemoveLabel(a.id); }}><TrashIcon /></button>
                </div>
              )
            );

            if (groups) {
              return groups.map((g, gi) => (
                <div key={g.row.rowIndex}>
                  <SystemDivider row={g.row} first={gi === 0} />
                  {g.items.map(renderLabel)}
                </div>
              ));
            }
            return sorted.map(renderLabel);
          })()}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { TrashIcon } from './Icons';
import { barWarning, groupItems, SystemDivider, formatBar } from '../utils/panelUtils';

export default function KeyPanel({
  onClose,
  keyChanges,
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
  const [label, setLabel] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editBar, setEditBar] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const focusedField = useRef(null);

  // Open editor when canvas click targets a specific item
  useEffect(() => {
    if (!requestEditId) return;
    const item = keyChanges.find(k => k.id === requestEditId);
    if (item) { setEditingId(item.id); setEditBar(String(item.bar)); setEditLabel(item.label ?? ''); }
  }, [requestEditId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onEditChange?.(editingId); }, [editingId, onEditChange]);

  useEffect(() => {
    if (!pickedBar) return;
    const val = String(pickedBar.value);
    if (pickedBar.field === 'keyBar') setBar(val);
    else if (pickedBar.field === 'editKeyBar') setEditBar(val);
  }, [pickedBar]);

  const handleFocus = field => { focusedField.current = field; onBarFieldFocus?.(field); };
  const handleBlur = () => { setTimeout(() => { focusedField.current = null; onBarFieldFocus?.(null); }, 150); };

  const canAdd = bar.trim() && !isNaN(parseFloat(bar)) && label.trim();

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ bar: parseFloat(bar), label: label.trim() });
    setBar(''); setLabel('');
  };

  const startEdit = k => { setEditingId(k.id); setEditBar(String(k.bar)); setEditLabel(k.label ?? ''); };
  const saveEdit = () => {
    const b = parseFloat(editBar);
    if (isNaN(b) || !editLabel.trim()) return;
    onUpdate(editingId, { bar: b, label: editLabel.trim() });
    setEditingId(null); setEditBar(''); setEditLabel('');
  };
  const cancelEdit = () => { setEditingId(null); setEditBar(''); setEditLabel(''); };

  const handleKey = e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape' && editingId) { e.stopPropagation(); cancelEdit(); } };
  const handleEditKey = e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { e.stopPropagation(); cancelEdit(); } };

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <span>Keys</span>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      <div className="side-panel-body">
        <div className="panel-form">
          <div className="panel-row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 80px' }}>
              <label className="panel-label">
                Bar <span className="panel-click-hint">— click diagram</span>
              </label>
              <input className="panel-input" type="number" value={bar}
                onChange={e => setBar(e.target.value)}
                onFocus={() => handleFocus('keyBar')} onBlur={handleBlur}
                onKeyDown={handleKey} placeholder="1" min="1" step="0.5" autoFocus />
            </div>
            <div style={{ flex: 1 }}>
              <label className="panel-label">Label</label>
              <input className="panel-input" value={label}
                onChange={e => setLabel(e.target.value)}
                onKeyDown={handleKey} placeholder="C major" />
            </div>
          </div>
          {barWarning(bar, layoutRows) && (
            <p className="panel-bar-warning">⚠ {barWarning(bar, layoutRows)}</p>
          )}
          <button className="btn btn-primary panel-add-btn" onClick={handleAdd} disabled={!canAdd}>
            Add key change
          </button>
        </div>

        <div className="panel-list">
          {keyChanges.length === 0 ? (
            <p className="panel-empty">No key changes yet</p>
          ) : (() => {
            const sorted = [...keyChanges].sort((a, b) => (a.bar ?? 0) - (b.bar ?? 0));
            const groups = groupItems(sorted, 'bar', layoutRows);

            const renderKey = k => (
              editingId === k.id ? (
                <div key={k.id} className="panel-item panel-item--editing">
                  <div className="panel-row">
                    <input className="panel-input" type="number" value={editBar}
                      onChange={e => setEditBar(e.target.value)}
                      onFocus={() => handleFocus('editKeyBar')} onBlur={handleBlur}
                      onKeyDown={handleEditKey} placeholder="Bar" step="0.5"
                      style={{ flex: '0 0 72px' }} />
                    <input className="panel-input" value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onKeyDown={handleEditKey} placeholder="Label" />
                  </div>
                  {barWarning(editBar, layoutRows) && (
                    <p className="panel-bar-warning">⚠ {barWarning(editBar, layoutRows)}</p>
                  )}
                  <div className="panel-edit-actions">
                    <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                    <button className="btn" onClick={cancelEdit}>Cancel</button>
                    <button className="item-delete" title="Delete" onClick={() => { onRemove(k.id); cancelEdit(); }}><TrashIcon /></button>
                  </div>
                </div>
              ) : (
                <div key={k.id} className="panel-item panel-item--clickable" onClick={() => startEdit(k)}>
                  <div className="panel-item-info">
                    <span className="panel-item-label">{k.label}</span>
                    <span className="panel-item-meta">from bar {formatBar(k.bar)}</span>
                  </div>
                  <button className="item-delete" title="Delete" onClick={e => { e.stopPropagation(); onRemove(k.id); }}><TrashIcon /></button>
                </div>
              )
            );

            if (groups) {
              return groups.map((g, gi) => (
                <div key={g.row.rowIndex}>
                  <SystemDivider row={g.row} first={gi === 0} />
                  {g.items.map(renderKey)}
                </div>
              ));
            }
            return sorted.map(renderKey);
          })()}
        </div>
      </div>
    </div>
  );
}

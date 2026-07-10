import { useState, useEffect, useRef } from 'react';
import { TrashIcon } from './Icons';
import { barWarning, groupItems, SystemDivider, formatBar } from '../utils/panelUtils';

const TYPE_OPTS = [
  { value: 'fermata', label: 'Fermata' },
  { value: 'caesura', label: 'Caesura //' },
  { value: 'breath',  label: "Breath mark '" },
];

function typeLabel(type) {
  return TYPE_OPTS.find(o => o.value === type)?.label ?? 'Fermata';
}

export default function FermataPanel({
  onClose,
  fermatas,
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
  const [type, setType] = useState('fermata');
  const [editingId, setEditingId] = useState(null);
  const [editBar, setEditBar] = useState('');
  const [editType, setEditType] = useState('fermata');
  const focusedField = useRef(null);

  // Open editor when canvas click targets a specific item
  useEffect(() => {
    if (!requestEditId) return;
    const item = fermatas.find(f => f.id === requestEditId);
    if (item) { setEditingId(item.id); setEditBar(String(item.bar)); setEditType(item.type ?? 'fermata'); }
  }, [requestEditId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onEditChange?.(editingId); }, [editingId, onEditChange]);

  useEffect(() => {
    if (!pickedBar) return;
    const val = String(pickedBar.value);
    if (pickedBar.field === 'fermataBar') setBar(val);
    else if (pickedBar.field === 'editFermataBar') setEditBar(val);
  }, [pickedBar]);

  const handleFocus = field => { focusedField.current = field; onBarFieldFocus?.(field); };
  const handleBlur = () => { setTimeout(() => { focusedField.current = null; onBarFieldFocus?.(null); }, 150); };

  const canAdd = bar.trim() && !isNaN(parseFloat(bar));

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ bar: parseFloat(bar), type });
    setBar('');
  };

  const startEdit = f => { setEditingId(f.id); setEditBar(String(f.bar)); setEditType(f.type ?? 'fermata'); };
  const saveEdit = () => {
    const b = parseFloat(editBar);
    if (isNaN(b)) return;
    onUpdate(editingId, { bar: b, type: editType });
    setEditingId(null); setEditBar(''); setEditType('fermata');
  };
  const cancelEdit = () => { setEditingId(null); setEditBar(''); setEditType('fermata'); };

  const handleKey = e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape' && editingId) { e.stopPropagation(); cancelEdit(); } };
  const handleEditKey = e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { e.stopPropagation(); cancelEdit(); } };

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <span>Fermatas &amp; breaks</span>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      <div className="side-panel-body">
        <div className="panel-form">
          <label className="panel-label">Type</label>
          <div className="fermata-type-group">
            {TYPE_OPTS.map(o => (
              <button key={o.value}
                className={`fermata-type-btn${type === o.value ? ' active' : ''}`}
                onClick={() => setType(o.value)}>
                {o.label}
              </button>
            ))}
          </div>

          <label className="panel-label" style={{ marginTop: 8 }}>
            Bar <span className="panel-click-hint">— click diagram</span>
          </label>
          <input className="panel-input" type="number" value={bar}
            onChange={e => setBar(e.target.value)}
            onFocus={() => handleFocus('fermataBar')} onBlur={handleBlur}
            onKeyDown={handleKey} placeholder="1" min="1" step="0.5" autoFocus />
          {barWarning(bar, layoutRows) && (
            <p className="panel-bar-warning">⚠ {barWarning(bar, layoutRows)}</p>
          )}
          <button className="btn btn-primary panel-add-btn" onClick={handleAdd} disabled={!canAdd}>
            Add {type === 'caesura' ? 'caesura' : type === 'breath' ? 'breath mark' : 'fermata'}
          </button>
        </div>

        <div className="panel-list">
          {fermatas.length === 0 ? (
            <p className="panel-empty">No fermatas or caesuras yet</p>
          ) : (() => {
            const sorted = [...fermatas].sort((a, b) => (a.bar ?? 0) - (b.bar ?? 0));
            const groups = groupItems(sorted, 'bar', layoutRows);

            const renderFermata = f => (
              editingId === f.id ? (
                <div key={f.id} className="panel-item panel-item--editing">
                  <div className="fermata-type-group" style={{ marginBottom: 6 }}>
                    {TYPE_OPTS.map(o => (
                      <button key={o.value}
                        className={`fermata-type-btn${editType === o.value ? ' active' : ''}`}
                        onClick={() => setEditType(o.value)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <input className="panel-input" type="number" value={editBar}
                    onChange={e => setEditBar(e.target.value)}
                    onFocus={() => handleFocus('editFermataBar')} onBlur={handleBlur}
                    onKeyDown={handleEditKey} placeholder="Bar" step="0.5" />
                  {barWarning(editBar, layoutRows) && (
                    <p className="panel-bar-warning">⚠ {barWarning(editBar, layoutRows)}</p>
                  )}
                  <div className="panel-edit-actions">
                    <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                    <button className="btn" onClick={cancelEdit}>Cancel</button>
                    <button className="item-delete" title="Delete" onClick={() => { onRemove(f.id); cancelEdit(); }}><TrashIcon /></button>
                  </div>
                </div>
              ) : (
                <div key={f.id} className="panel-item panel-item--clickable" onClick={() => startEdit(f)}>
                  <div className="panel-item-info">
                    <span className="panel-item-label">{typeLabel(f.type ?? 'fermata')}</span>
                    <span className="panel-item-meta">bar {formatBar(f.bar)}</span>
                  </div>
                  <button className="item-delete" title="Delete" onClick={e => { e.stopPropagation(); onRemove(f.id); }}><TrashIcon /></button>
                </div>
              )
            );

            if (groups) {
              return groups.map((g, gi) => (
                <div key={g.row.rowIndex}>
                  <SystemDivider row={g.row} first={gi === 0} />
                  {g.items.map(renderFermata)}
                </div>
              ));
            }
            return sorted.map(renderFermata);
          })()}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { barWarning } from '../utils/panelUtils';

const COMMON = [
  [4, 4], [3, 4], [2, 4], [2, 2],
  [6, 8], [9, 8], [12, 8], [3, 8],
  [5, 4], [7, 8], [5, 8], [7, 4],
];

export default function TimeSignaturePanel({
  onClose,
  timeSignatures,
  onAdd,
  onRemove,
  onUpdate,
  onBarFieldFocus,
  pickedBar,
  layoutRows = [],
  requestEditId,
  onEditChange,
}) {
  const [num, setNum] = useState('4');
  const [den, setDen] = useState('4');
  const [bar, setBar] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});

  const focusedField = useRef(null);

  // Open editor when canvas click targets a specific item
  useEffect(() => {
    if (!requestEditId) return;
    const item = timeSignatures.find(t => t.id === requestEditId);
    if (item) {
      setEditingId(item.id);
      setEditFields({ num: String(item.numerator), den: String(item.denominator), bar: String(item.bar) });
    }
  }, [requestEditId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onEditChange?.(editingId); }, [editingId, onEditChange]);

  useEffect(() => {
    if (!pickedBar) return;
    if (pickedBar.field === 'tsBar') setBar(String(pickedBar.value));
    else if (pickedBar.field === 'editTsBar') setEditFields(f => ({ ...f, bar: String(pickedBar.value) }));
  }, [pickedBar]);

  const handleFocus = field => { focusedField.current = field; onBarFieldFocus?.(field); };
  const handleBlur = () => { setTimeout(() => { focusedField.current = null; onBarFieldFocus?.(null); }, 150); };

  const canAdd = bar.trim() && !isNaN(parseFloat(bar)) &&
    num.trim() && !isNaN(parseInt(num)) && parseInt(num) > 0 &&
    den.trim() && !isNaN(parseInt(den)) && parseInt(den) > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ numerator: parseInt(num), denominator: parseInt(den), bar: parseFloat(bar) });
    setBar('');
  };

  const applyCommon = ([n, d]) => { setNum(String(n)); setDen(String(d)); };

  const startEdit = ts => {
    setEditingId(ts.id);
    setEditFields({ num: String(ts.numerator), den: String(ts.denominator), bar: String(ts.bar) });
  };

  const ef = v => setEditFields(f => ({ ...f, ...v }));

  const saveEdit = () => {
    const b = parseFloat(editFields.bar);
    const n = parseInt(editFields.num);
    const d = parseInt(editFields.den);
    if (isNaN(b) || isNaN(n) || n <= 0 || isNaN(d) || d <= 0) return;
    onUpdate(editingId, { bar: b, numerator: n, denominator: d });
    setEditingId(null); setEditFields({});
  };

  const cancelEdit = () => { setEditingId(null); setEditFields({}); };

  const handleKey = e => { if (e.key === 'Enter') handleAdd(); };
  const handleEditKey = e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { e.stopPropagation(); cancelEdit(); } };

  const sorted = [...timeSignatures].sort((a, b) => a.bar - b.bar);

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <span>Time signatures</span>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      <div className="side-panel-body">
        <div className="panel-form">
          <label className="panel-label">Common</label>
          <div className="ts-quick-grid">
            {COMMON.map(([n, d]) => (
              <button
                key={`${n}/${d}`}
                className={`ts-quick-btn${num === String(n) && den === String(d) ? ' active' : ''}`}
                onClick={() => applyCommon([n, d])}
              >
                <span className="ts-quick-num">{n}</span>
                <span className="ts-quick-den">{d}</span>
              </button>
            ))}
          </div>

          <label className="panel-label" style={{ marginTop: 10 }}>Custom</label>
          <div className="panel-row">
            <div style={{ flex: 1 }}>
              <label className="panel-label">Top</label>
              <input className="panel-input" type="number" min="1" value={num}
                onChange={e => setNum(e.target.value)} onKeyDown={handleKey} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="panel-label">Bottom</label>
              <input className="panel-input" type="number" min="1" value={den}
                onChange={e => setDen(e.target.value)} onKeyDown={handleKey} />
            </div>
          </div>

          <label className="panel-label">
            Bar position<span className="panel-click-hint"> — click diagram</span>
          </label>
          <input className="panel-input" type="number" min="1" step="0.5" value={bar}
            placeholder="1"
            onChange={e => setBar(e.target.value)}
            onFocus={() => handleFocus('tsBar')} onBlur={handleBlur}
            onKeyDown={handleKey} />

          {barWarning(bar, layoutRows) && (
            <p className="panel-bar-warning">⚠ {barWarning(bar, layoutRows)}</p>
          )}
          <button className="btn btn-primary panel-add-btn" onClick={handleAdd} disabled={!canAdd}>
            Add time signature
          </button>
        </div>

        <div className="panel-list">
          {sorted.length === 0 ? (
            <p className="panel-empty">No time signatures yet</p>
          ) : sorted.map(ts => (
            editingId === ts.id ? (
              <div key={ts.id} className="panel-item panel-item--editing">
                <div className="panel-row">
                  <div style={{ flex: 1 }}>
                    <label className="panel-label">Top</label>
                    <input className="panel-input" type="number" min="1" value={editFields.num}
                      onChange={e => ef({ num: e.target.value })} onKeyDown={handleEditKey} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="panel-label">Bottom</label>
                    <input className="panel-input" type="number" min="1" value={editFields.den}
                      onChange={e => ef({ den: e.target.value })} onKeyDown={handleEditKey} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="panel-label">Bar<span className="panel-click-hint"> — click</span></label>
                    <input className="panel-input" type="number" min="1" step="0.5" value={editFields.bar}
                      onChange={e => ef({ bar: e.target.value })}
                      onFocus={() => handleFocus('editTsBar')} onBlur={handleBlur}
                      onKeyDown={handleEditKey} />
                  </div>
                </div>
                {barWarning(editFields.bar, layoutRows) && (
                  <p className="panel-bar-warning">⚠ {barWarning(editFields.bar, layoutRows)}</p>
                )}
                <div className="panel-edit-actions">
                  <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                  <button className="btn" onClick={cancelEdit}>Cancel</button>
                  <button className="item-delete" onClick={() => { onRemove(ts.id); cancelEdit(); }}>✕</button>
                </div>
              </div>
            ) : (
              <div key={ts.id} className="panel-item panel-item--clickable" onClick={() => startEdit(ts)}>
                <div className="ts-list-glyph">
                  <span>{ts.numerator}</span>
                  <span>{ts.denominator}</span>
                </div>
                <div className="panel-item-info">
                  <span className="panel-item-label">{ts.numerator}/{ts.denominator}</span>
                  <span className="panel-item-meta">bar {ts.bar}</span>
                </div>
                <button className="item-delete" onClick={e => { e.stopPropagation(); onRemove(ts.id); }}>✕</button>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

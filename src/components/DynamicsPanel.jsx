import { useState, useEffect, useRef } from 'react';
import { TrashIcon } from './Icons';
import { barWarning, groupItems, SystemDivider, formatBar } from '../utils/panelUtils';

const TYPE_OPTS = [
  { value: 'cresc', label: 'Crescendo' },
  { value: 'dim',   label: 'Diminuendo' },
];

function typeLabel(type) {
  return TYPE_OPTS.find(o => o.value === type)?.label ?? 'Crescendo';
}

// Small wedge preview so the buttons read at a glance
function Wedge({ type, active }) {
  const stroke = active ? 'white' : '#6b6558';
  const open = type !== 'dim';
  return (
    <svg width={30} height={10} viewBox="0 0 30 10" style={{ display: 'block' }}>
      <line x1={1} y1={open ? 5 : 1} x2={29} y2={open ? 1 : 5} stroke={stroke} strokeWidth={1.2} strokeLinecap="round" />
      <line x1={1} y1={open ? 5 : 9} x2={29} y2={open ? 9 : 5} stroke={stroke} strokeWidth={1.2} strokeLinecap="round" />
    </svg>
  );
}

export default function DynamicsPanel({
  onClose,
  hairpins,
  onAdd,
  onRemove,
  onUpdate,
  onBarFieldFocus,
  pickedBar,
  layoutRows = [],
  requestEditId,
  onEditChange,
}) {
  const [startBar, setStartBar] = useState('');
  const [endBar, setEndBar] = useState('');
  const [type, setType] = useState('cresc');

  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});
  const focusedField = useRef(null);

  useEffect(() => {
    if (!requestEditId) return;
    const item = hairpins.find(h => h.id === requestEditId);
    if (item) {
      setEditingId(item.id);
      setEditFields({ startBar: String(item.startBar), endBar: String(item.endBar), type: item.type ?? 'cresc' });
    }
  }, [requestEditId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onEditChange?.(editingId); }, [editingId, onEditChange]);

  useEffect(() => {
    if (!pickedBar) return;
    const val = String(pickedBar.value);
    if (pickedBar.field === 'hairpinStart') setStartBar(val);
    else if (pickedBar.field === 'hairpinEnd') setEndBar(val);
    else if (pickedBar.field === 'editHairpinStart') setEditFields(f => ({ ...f, startBar: val }));
    else if (pickedBar.field === 'editHairpinEnd') setEditFields(f => ({ ...f, endBar: val }));
  }, [pickedBar]);

  const handleFocus = field => { focusedField.current = field; onBarFieldFocus?.(field); };
  const handleBlur = () => { setTimeout(() => { focusedField.current = null; onBarFieldFocus?.(null); }, 150); };

  const canAdd = startBar.trim() && endBar.trim() &&
    !isNaN(parseFloat(startBar)) && !isNaN(parseFloat(endBar)) &&
    parseFloat(endBar) !== parseFloat(startBar);

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ startBar: parseFloat(startBar), endBar: parseFloat(endBar), type });
    setStartBar(''); setEndBar('');
  };

  const startEdit = h => {
    setEditingId(h.id);
    setEditFields({ startBar: String(h.startBar), endBar: String(h.endBar), type: h.type ?? 'cresc' });
  };
  const ef = v => setEditFields(f => ({ ...f, ...v }));

  const saveEdit = () => {
    const sb = parseFloat(editFields.startBar), eb = parseFloat(editFields.endBar);
    if (isNaN(sb) || isNaN(eb) || sb === eb) return;
    onUpdate(editingId, { startBar: sb, endBar: eb, type: editFields.type });
    setEditingId(null); setEditFields({});
  };
  const cancelEdit = () => { setEditingId(null); setEditFields({}); };

  const handleKey = e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape' && editingId) { e.stopPropagation(); cancelEdit(); } };
  const handleEditKey = e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { e.stopPropagation(); cancelEdit(); } };

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <span>Dynamics</span>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      <div className="side-panel-body">
        <div className="panel-form">
          <label className="panel-label">Type</label>
          <div className="fermata-type-group">
            {TYPE_OPTS.map(o => (
              <button key={o.value}
                className={`fermata-type-btn${type === o.value ? ' active' : ''}`}
                onClick={() => setType(o.value)}
                title={o.label}>
                <Wedge type={o.value} active={type === o.value} />
              </button>
            ))}
          </div>

          <div className="panel-row" style={{ marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="panel-label">Start bar<span className="panel-click-hint"> — click</span></label>
              <input className="panel-input" type="number" value={startBar}
                onChange={e => setStartBar(e.target.value)}
                onFocus={() => handleFocus('hairpinStart')} onBlur={handleBlur}
                onKeyDown={handleKey} placeholder="1" step="0.5" autoFocus />
            </div>
            <div style={{ flex: 1 }}>
              <label className="panel-label">End bar<span className="panel-click-hint"> — click</span></label>
              <input className="panel-input" type="number" value={endBar}
                onChange={e => setEndBar(e.target.value)}
                onFocus={() => handleFocus('hairpinEnd')} onBlur={handleBlur}
                onKeyDown={handleKey} placeholder="5" step="0.5" />
            </div>
          </div>
          {barWarning(startBar, layoutRows) && (
            <p className="panel-bar-warning">⚠ {barWarning(startBar, layoutRows)}</p>
          )}
          {endBar.trim() && barWarning(endBar, layoutRows) && (
            <p className="panel-bar-warning">⚠ End: {barWarning(endBar, layoutRows)}</p>
          )}
          <p className="panel-glyph-hint">
            Tip: for text dynamics (<code>f</code>, <code>pp</code>, <code>sfz</code>…) add a
            Label — they render in the bold italic style automatically.
          </p>
          <button className="btn btn-primary panel-add-btn" onClick={handleAdd} disabled={!canAdd}>
            Add {type === 'dim' ? 'diminuendo' : 'crescendo'}
          </button>
        </div>

        <div className="panel-list">
          {hairpins.length === 0 ? (
            <p className="panel-empty">No dynamics yet</p>
          ) : (() => {
            const sorted = [...hairpins].sort((a, b) => (a.startBar ?? 0) - (b.startBar ?? 0));
            const groups = groupItems(sorted, 'startBar', layoutRows);

            const renderHairpin = h => (
              editingId === h.id ? (
                <div key={h.id} className="panel-item panel-item--editing">
                  <div className="fermata-type-group" style={{ marginBottom: 6 }}>
                    {TYPE_OPTS.map(o => (
                      <button key={o.value}
                        className={`fermata-type-btn${editFields.type === o.value ? ' active' : ''}`}
                        onClick={() => ef({ type: o.value })} title={o.label}>
                        <Wedge type={o.value} active={editFields.type === o.value} />
                      </button>
                    ))}
                  </div>
                  <div className="panel-row">
                    <input className="panel-input" type="number" value={editFields.startBar}
                      onChange={e => ef({ startBar: e.target.value })}
                      onFocus={() => handleFocus('editHairpinStart')} onBlur={handleBlur}
                      onKeyDown={handleEditKey} placeholder="Start" step="0.5" />
                    <input className="panel-input" type="number" value={editFields.endBar}
                      onChange={e => ef({ endBar: e.target.value })}
                      onFocus={() => handleFocus('editHairpinEnd')} onBlur={handleBlur}
                      onKeyDown={handleEditKey} placeholder="End" step="0.5" />
                  </div>
                  <div className="panel-edit-actions">
                    <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                    <button className="btn" onClick={cancelEdit}>Cancel</button>
                    <button className="item-delete" title="Delete" onClick={() => { onRemove(h.id); cancelEdit(); }}><TrashIcon /></button>
                  </div>
                </div>
              ) : (
                <div key={h.id} className="panel-item panel-item--clickable" onClick={() => startEdit(h)}>
                  <div className="panel-item-info">
                    <span className="panel-item-label">{typeLabel(h.type ?? 'cresc')}</span>
                    <span className="panel-item-meta">bars {formatBar(h.startBar)}–{formatBar(h.endBar)}</span>
                  </div>
                  <button className="item-delete" title="Delete" onClick={e => { e.stopPropagation(); onRemove(h.id); }}><TrashIcon /></button>
                </div>
              )
            );

            if (groups) {
              return groups.map((g, gi) => (
                <div key={g.row.rowIndex}>
                  <SystemDivider row={g.row} first={gi === 0} />
                  {g.items.map(renderHairpin)}
                </div>
              ));
            }
            return sorted.map(renderHairpin);
          })()}
        </div>
      </div>
    </div>
  );
}

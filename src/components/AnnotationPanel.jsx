import { useState, useEffect, useRef } from 'react';

export default function AnnotationPanel({
  onClose,
  annotations,
  onAddAnnotation,
  onRemoveAnnotation,
  onUpdateAnnotation,
  onBarFieldFocus,
  pickedBar,
}) {
  const [annBar, setAnnBar] = useState('');
  const [annText, setAnnText] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});

  const focusedField = useRef(null);

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
          <div className="panel-row">
            <div style={{ flex: '0 0 80px' }}>
              <label className="panel-label">Bar<span className="panel-click-hint"> — click diagram</span></label>
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
          ) : [...annotations].sort((a, b) => (a.bar ?? 0) - (b.bar ?? 0)).map(a => (
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
                  <button className="item-delete" onClick={() => { onRemoveAnnotation(a.id); cancelEdit(); }}>✕</button>
                </div>
              </div>
            ) : (
              <div key={a.id} className="panel-item panel-item--clickable" onClick={() => startEdit(a)}>
                <div className="panel-item-info">
                  <span className="panel-item-label" style={{ fontStyle: 'italic' }}>{a.text}</span>
                  <span className="panel-item-meta">bar {a.bar}</span>
                </div>
                <button className="item-delete" onClick={e => { e.stopPropagation(); onRemoveAnnotation(a.id); }}>✕</button>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

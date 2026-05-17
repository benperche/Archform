import { useState } from 'react';
import { relabelMarks } from '../utils/marks';

const MARK_STYLES = [
  { value: 'letters', label: 'Letters' },
  { value: 'numbers', label: 'Numbers' },
  { value: 'roman', label: 'Roman' },
  { value: 'bars', label: 'Bar nos.' },
];

export default function RehearsalMarksPanel({
  rehearsalMarks,
  rehearsalMarkStyle,
  onClose,
  onStyleChange,
  onAddManualMark,
  onRemoveMark,
}) {
  const [manualBar, setManualBar] = useState('');

  const canAdd = manualBar.trim() && !isNaN(parseFloat(manualBar));

  const handleAdd = () => {
    const b = parseFloat(manualBar);
    if (!isNaN(b)) { onAddManualMark(b); setManualBar(''); }
  };

  const sorted = [...rehearsalMarks].sort((a, b) => a.bar - b.bar);

  return (
    <div className="reh-marks-panel">
      <div className="reh-marks-top">
        <div className="reh-marks-title-row">
          <span className="reh-marks-title">Rehearsal marks</span>
          <span className="reh-marks-hint">Click a slur's start on the diagram to place or remove a mark</span>
          <button className="panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="reh-marks-controls">
          <div className="reh-style-group">
            {MARK_STYLES.map(({ value, label }) => (
              <button
                key={value}
                className={`reh-style-btn${rehearsalMarkStyle === value ? ' active' : ''}`}
                onClick={() => onStyleChange(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="reh-manual-add">
            <input
              className="reh-bar-input"
              type="number"
              placeholder="Bar"
              min="1"
              step="0.5"
              value={manualBar}
              onChange={e => setManualBar(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canAdd) handleAdd(); }}
            />
            <button className="btn" disabled={!canAdd} onClick={handleAdd}>
              Add mark
            </button>
          </div>
        </div>
      </div>

      <div className="reh-marks-list">
        {sorted.length === 0 ? (
          <span className="reh-marks-empty">No marks yet — click a phrase start on the diagram</span>
        ) : sorted.map(m => (
          <div key={m.id} className="reh-mark-chip">
            <span className="reh-mark-label">{m.label}</span>
            <span className="reh-mark-bar">bar {m.bar}</span>
            <button className="reh-mark-remove" title="Remove" onClick={() => onRemoveMark(m.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

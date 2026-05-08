import { useState, useEffect, useRef } from 'react';

export default function OverlapPopover({ startBar, value, position, onClose, onChange }) {
  const [input, setInput] = useState(String(value || 0));
  const inputRef = useRef();

  // Sync input when value changes externally
  useEffect(() => { setInput(String(value || 0)); }, [value]);

  // Focus input on open
  useEffect(() => { inputRef.current?.select(); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const commit = (raw) => {
    const n = parseFloat(raw);
    const v = isNaN(n) || n < 0 ? 0 : Math.round(n * 2) / 2; // snap to 0.5
    onChange(startBar, v);
    setInput(String(v));
  };

  const step = (delta) => {
    const current = parseFloat(input) || 0;
    const next = Math.max(0, Math.round((current + delta) * 2) / 2);
    setInput(String(next));
    onChange(startBar, next);
  };

  if (!position) return null;

  return (
    <>
      {/* click-away backdrop */}
      <div className="overlap-backdrop" onClick={onClose} />
      <div
        className="overlap-popover"
        style={{ left: position.x, top: position.y }}
      >
        <div className="overlap-popover-header">
          <span>Phrase overlap</span>
          <button className="help-close" onClick={onClose}>✕</button>
        </div>
        <div className="overlap-popover-body">
          <span className="overlap-label">Shift start back by</span>
          <div className="overlap-stepper">
            <button className="overlap-step-btn" onClick={() => step(-0.5)}>−</button>
            <input
              ref={inputRef}
              className="overlap-input"
              type="number"
              min="0"
              step="0.5"
              value={input}
              onChange={e => setInput(e.target.value)}
              onBlur={e => commit(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { commit(input); onClose(); } }}
            />
            <button className="overlap-step-btn" onClick={() => step(0.5)}>+</button>
          </div>
          <span className="overlap-unit">beats</span>
        </div>
        {(parseFloat(input) || 0) > 0 && (
          <button className="overlap-clear" onClick={() => { onChange(startBar, 0); onClose(); }}>
            Remove overlap
          </button>
        )}
      </div>
    </>
  );
}

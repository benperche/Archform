import { useRef, useEffect } from 'react';
import { formatBar } from '../utils/layout';

export default function QuickEntry({ text, onChange, phrases, textSelection }) {
  const textareaRef = useRef(null);

  const lastPhrase = phrases[phrases.length - 1];
  const totalBars = lastPhrase
    ? Math.ceil(lastPhrase.startBar + lastPhrase.length - 1)
    : 0;

  useEffect(() => {
    if (!textSelection || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(textSelection.start, textSelection.end);
  }, [textSelection]);

  // Sub-phrase groups whose parts don't add up to the parent, e.g. 8(4+3)
  const mismatches = phrases.filter(p => p.subMismatch != null);

  return (
    <div className="quick-entry">
      <div className="quick-entry-header">
        <span className="quick-entry-label">Phrases</span>
        <span className="quick-entry-hint">
          Lengths separated by spaces or commas · new line = new row · 7(4+3) = sub-phrases · decimals for sub-beats
        </span>
        {phrases.length > 0 && (
          <span className="quick-entry-stats">
            {phrases.length} phrase{phrases.length !== 1 ? 's' : ''} · {totalBars} bars
          </span>
        )}
      </div>
      {mismatches.length > 0 && (
        <p className="quick-entry-warning">
          ⚠ Sub-phrases don't add up —{' '}
          {mismatches.map((p, i) => (
            <span key={p.id}>
              {i > 0 && '; '}
              bar {formatBar(p.startBar)}: {p.subPhrases.join('+')} = {formatBar(p.subTotal)},
              not {formatBar(p.length)}
            </span>
          ))}
          . They are drawn at their true length, so the gap is visible on the diagram.
        </p>
      )}
      <textarea
        ref={textareaRef}
        className="quick-entry-textarea"
        value={text}
        onChange={e => onChange(e.target.value)}
        placeholder={'6 6 2 7\n4 4 8\n6 6 4 2'}
        spellCheck={false}
        rows={3}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}

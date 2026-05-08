import { useRef, useEffect } from 'react';

export default function QuickEntry({ text, onChange, phrases, selectedPhraseIndex }) {
  const textareaRef = useRef(null);

  const lastPhrase = phrases[phrases.length - 1];
  const totalBars = lastPhrase
    ? Math.ceil(lastPhrase.startBar + lastPhrase.length - 1)
    : 0;

  // When a phrase is selected in the diagram, highlight its token in the textarea
  useEffect(() => {
    if (selectedPhraseIndex == null || !textareaRef.current) return;
    const phrase = phrases[selectedPhraseIndex];
    if (!phrase || phrase.textStart == null) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(phrase.textStart, phrase.textEnd);
  }, [selectedPhraseIndex, phrases]);

  return (
    <div className="quick-entry">
      <div className="quick-entry-header">
        <span className="quick-entry-label">Phrases</span>
        <span className="quick-entry-hint">
          Lengths separated by spaces or commas · new line = new row · decimals for sub-beats
        </span>
        {phrases.length > 0 && (
          <span className="quick-entry-stats">
            {phrases.length} phrase{phrases.length !== 1 ? 's' : ''} · {totalBars} bars
          </span>
        )}
      </div>
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

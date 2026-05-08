import { useRef } from 'react';
import FileMenu from './FileMenu';

const MARK_STYLES = [
  { value: 'letters', label: 'Letters' },
  { value: 'numbers', label: 'Numbers' },
  { value: 'bars', label: 'Bar numbers' },
];

export default function Toolbar({
  state,
  setState,
  fileIndex,
  onNewFile,
  onSwitchFile,
  onDeleteFile,
  onShowHelp,
  onExport,
  onImport,
  onToggleSectionPanel,
  onToggleAnnotationPanel,
  sectionPanelOpen,
  annotationPanelOpen,
}) {
  const fileInputRef = useRef();

  const inMarkMode = state.editMode === 'rehearsalMarks';

  const enterMarkMode = () =>
    setState(s => ({ ...s, editMode: 'rehearsalMarks', selectedPhraseIndex: null }));

  const exitMarkMode = () =>
    setState(s => ({ ...s, editMode: null }));

  const handleFileChange = e => {
    const file = e.target.files?.[0];
    if (file) { onImport(file); e.target.value = ''; }
  };

  return (
    <div className={`toolbar ${inMarkMode ? 'toolbar--mark-mode' : ''}`}>
      {/* Left: file menu + help + title + composer */}
      <FileMenu
        files={fileIndex.files}
        currentId={fileIndex.currentId}
        onNew={onNewFile}
        onSwitch={onSwitchFile}
        onDelete={onDeleteFile}
      />
      <button className="btn" onClick={onShowHelp} title="How to use Phrase Diagrams">?</button>
      <div className="toolbar-meta">
        <input
          className="title-input"
          value={state.title}
          onChange={e => setState(s => ({ ...s, title: e.target.value }))}
          placeholder="Piece title"
        />
        <input
          className="composer-input"
          value={state.composer}
          onChange={e => setState(s => ({ ...s, composer: e.target.value }))}
          placeholder="Composer"
        />
      </div>

      {/* Centre: rehearsal mark mode controls */}
      {inMarkMode ? (
        <div className="mark-mode-bar">
          <span className="mark-mode-hint">Click a slur start to place a mark · Esc to exit</span>
          <div className="mark-style-group">
            {MARK_STYLES.map(({ value, label }) => (
              <label key={value} className={`mark-style-radio ${state.rehearsalMarkStyle === value ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="markStyle"
                  value={value}
                  checked={state.rehearsalMarkStyle === value}
                  onChange={() => setState(s => ({ ...s, rehearsalMarkStyle: value }))}
                />
                {label}
              </label>
            ))}
          </div>
          <button className="btn btn-cancel" onClick={exitMarkMode}>Exit</button>
        </div>
      ) : (
        <div className="toolbar-actions">
          <button
            className={`btn ${sectionPanelOpen ? 'btn-active' : ''}`}
            onClick={onToggleSectionPanel}
          >
            Sections
          </button>
          <button
            className={`btn ${annotationPanelOpen ? 'btn-active' : ''}`}
            onClick={onToggleAnnotationPanel}
          >
            Annotations
          </button>
          <button className="btn" onClick={enterMarkMode}>
            Rehearsal marks
          </button>
          <div className="toolbar-sep" />
          <button className="btn" onClick={() => fileInputRef.current?.click()}>Import</button>
          <button className="btn" onClick={onExport}>Export</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Print / PDF</button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}

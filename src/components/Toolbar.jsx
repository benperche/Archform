import { useRef, useState } from 'react';
import FileMenu from './FileMenu';

const MARK_STYLES = [
  { value: 'letters', label: 'Letters' },
  { value: 'numbers', label: 'Numbers' },
  { value: 'bars', label: 'Bar numbers' },
];

function ExportMenu({ onExportJSON, onExportSVG, onExportPNG }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Close on outside click
  const handleBlur = e => {
    if (!ref.current?.contains(e.relatedTarget)) setOpen(false);
  };

  return (
    <div className="file-menu" ref={ref} onBlur={handleBlur}>
      <button className={`btn ${open ? 'btn-active' : ''}`} onClick={() => setOpen(o => !o)}>
        Export ▾
      </button>
      {open && (
        <div className="file-dropdown">
          <button className="export-option" onClick={() => { onExportJSON(); setOpen(false); }}>
            JSON <span className="export-option-hint">for re-importing</span>
          </button>
          <button className="export-option" onClick={() => { onExportSVG(); setOpen(false); }}>
            SVG <span className="export-option-hint">vector graphic</span>
          </button>
          <button className="export-option" onClick={() => { onExportPNG(); setOpen(false); }}>
            PNG <span className="export-option-hint">high-res image</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function Toolbar({
  state,
  setState,
  fileIndex,
  onNewFile,
  onSwitchFile,
  onDeleteFile,
  onShowHelp,
  onUndo,
  onRedo,
  onExportJSON,
  onExportSVG,
  onExportPNG,
  onImport,
  onShare,
  shareCopied,
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
      {/* Left: file menu + help + undo/redo + title + composer */}
      <FileMenu
        files={fileIndex.files}
        currentId={fileIndex.currentId}
        onNew={onNewFile}
        onSwitch={onSwitchFile}
        onDelete={onDeleteFile}
      />
      <button className="btn" onClick={onShowHelp} title="How to use Archform">?</button>
      <div className="toolbar-sep" />
      <button className="btn toolbar-icon-btn" onClick={onUndo} title="Undo (⌘Z)">↩</button>
      <button className="btn toolbar-icon-btn" onClick={onRedo} title="Redo (⌘⇧Z)">↪</button>
      <div className="toolbar-sep" />
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

      {/* Right: panel + mark mode + export + share */}
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
          <ExportMenu onExportJSON={onExportJSON} onExportSVG={onExportSVG} onExportPNG={onExportPNG} />
          <button className="btn" onClick={onShare}>
            {shareCopied ? 'Copied!' : 'Share'}
          </button>
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

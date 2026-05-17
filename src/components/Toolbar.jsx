import { useRef } from 'react';

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
  sidebarOpen,
  onToggleSidebar,
  onShowHelp,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExportJSON,
  onExportSVG,
  onExportPNG,
  onImport,
  onShare,
  shareCopied,
}) {
  const fileInputRef = useRef();

  const handleFileChange = e => {
    const file = e.target.files?.[0];
    if (file) { onImport(file); e.target.value = ''; }
  };

  return (
    <div className="toolbar">
      <button
        className={`btn ${sidebarOpen ? 'btn-active' : ''}`}
        onClick={onToggleSidebar}
        title="Toggle file browser"
      >
        Files
      </button>
      <button className="btn" onClick={onShowHelp} title="How to use Archform">?</button>
      <div className="toolbar-sep" />
      <button className="btn toolbar-icon-btn" onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">↩</button>
      <button className="btn toolbar-icon-btn" onClick={onRedo} disabled={!canRedo} title="Redo (⌘⇧Z)">↪</button>
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

      <div className="toolbar-actions">
        <button className="btn" onClick={() => fileInputRef.current?.click()}>Import</button>
        <ExportMenu onExportJSON={onExportJSON} onExportSVG={onExportSVG} onExportPNG={onExportPNG} />
        <button className="btn" onClick={onShare}>
          {shareCopied ? 'Copied!' : 'Share'}
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>Print / PDF</button>
      </div>

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

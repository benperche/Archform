import { useState, useEffect, useRef } from 'react';

export default function FileMenu({ files, currentId, onNew, onSwitch, onDelete }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef();

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    const keyHandler = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  return (
    <div className="file-menu" ref={containerRef}>
      <button className={`btn ${open ? 'btn-active' : ''}`} onClick={() => setOpen(o => !o)}>
        Files ▾
      </button>

      {open && (
        <div className="file-dropdown">
          <button
            className="file-new-btn"
            onClick={() => { onNew(); setOpen(false); }}
          >
            + New diagram
          </button>

          {files.length > 0 && (
            <div className="file-list">
              {[...files].reverse().map(f => (
                <div
                  key={f.id}
                  className={`file-item${f.id === currentId ? ' file-item--active' : ''}`}
                  onClick={() => { if (f.id !== currentId) { onSwitch(f.id); setOpen(false); } }}
                >
                  <span className="file-item-name">{f.name}</span>
                  {files.length > 1 && (
                    <button
                      className="file-item-delete"
                      title="Delete"
                      onClick={e => { e.stopPropagation(); onDelete(f.id); }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

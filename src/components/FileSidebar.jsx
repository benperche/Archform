import { useState, useRef, useEffect } from 'react';

export default function FileSidebar({
  fileIndex,
  onNew,
  onSwitch,
  onDelete,
  onAddFolder,
  onDeleteFolder,
  onRenameFolder,
  onMoveFile,
}) {
  const { files, folders = [] } = fileIndex;
  const currentId = fileIndex.currentId;

  // All folders expanded by default
  const [expandedFolders, setExpandedFolders] = useState(() => {
    const s = new Set(folders.map(f => f.id));
    s.add('__ungrouped__');
    return s;
  });

  // Keep expanded set in sync when new folders are added
  useEffect(() => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      for (const f of folders) next.add(f.id);
      return next;
    });
  }, [folders]);

  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [dragFileId, setDragFileId] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);

  const renameInputRef = useRef(null);
  const newFolderInputRef = useRef(null);

  const toggleFolder = (id) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startRename = (folder) => {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
    setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select(); }, 0);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) onRenameFolder(renamingId, renameValue.trim());
    setRenamingId(null);
  };

  const startAddFolder = () => {
    setAddingFolder(true);
    setNewFolderName('');
    setTimeout(() => newFolderInputRef.current?.focus(), 0);
  };

  const commitAddFolder = () => {
    if (newFolderName.trim()) onAddFolder(newFolderName.trim());
    setAddingFolder(false);
    setNewFolderName('');
  };

  // Drag and drop
  const handleDragStart = (e, fileId) => {
    setDragFileId(fileId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(targetId);
  };

  const handleDrop = (e, targetFolderId) => {
    e.preventDefault();
    if (dragFileId) {
      const folderId = targetFolderId === '__ungrouped__' ? null : targetFolderId;
      onMoveFile(dragFileId, folderId);
    }
    setDragFileId(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDragFileId(null);
    setDragOverTarget(null);
  };

  // Group files
  const filesByFolder = {};
  for (const folder of folders) {
    filesByFolder[folder.id] = [...files]
      .filter(f => f.folderId === folder.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const ungroupedFiles = [...files]
    .filter(f => !f.folderId)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const renderFile = (file) => (
    <div
      key={file.id}
      className={`sb-file${file.id === currentId ? ' sb-file--active' : ''}${dragFileId === file.id ? ' sb-file--dragging' : ''}`}
      draggable
      onDragStart={e => handleDragStart(e, file.id)}
      onDragEnd={handleDragEnd}
      onClick={() => { if (file.id !== currentId) onSwitch(file.id); }}
    >
      <span className="sb-file-name">{file.name}</span>
      {files.length > 1 && (
        <button
          className="sb-file-delete"
          title="Delete"
          onClick={e => { e.stopPropagation(); onDelete(file.id); }}
        >✕</button>
      )}
    </div>
  );

  const noFolders = folders.length === 0;

  return (
    <div className="file-sidebar">
      <div className="sb-header">
        <span className="sb-title">Files</span>
        <button className="sb-new-btn" onClick={onNew}>+ New</button>
      </div>

      <div className="sb-body">
        {/* Named folders */}
        {folders.map(folder => {
          const folderFiles = filesByFolder[folder.id] || [];
          const isExpanded = expandedFolders.has(folder.id);
          const isDragOver = dragOverTarget === folder.id;

          return (
            <div
              key={folder.id}
              className={`sb-folder${isDragOver ? ' sb-folder--drag-over' : ''}`}
              onDragOver={e => handleDragOver(e, folder.id)}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTarget(null); }}
              onDrop={e => handleDrop(e, folder.id)}
            >
              <div className="sb-folder-row">
                <button className="sb-folder-toggle" onClick={() => toggleFolder(folder.id)}>
                  {isExpanded ? '▾' : '▸'}
                </button>
                {renamingId === folder.id ? (
                  <input
                    ref={renameInputRef}
                    className="sb-folder-rename"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                  />
                ) : (
                  <span className="sb-folder-name" onDoubleClick={() => startRename(folder)}>
                    {folder.name}
                  </span>
                )}
                <span className="sb-folder-count">{folderFiles.length}</span>
                <button
                  className="sb-folder-delete"
                  title="Delete folder (files move to Ungrouped)"
                  onClick={() => onDeleteFolder(folder.id)}
                >✕</button>
              </div>
              {isExpanded && (
                <div className="sb-folder-files">
                  {folderFiles.map(renderFile)}
                  {folderFiles.length === 0 && (
                    <div className="sb-folder-empty">Empty — drag files here</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped / flat list */}
        {noFolders ? (
          /* No folders yet: just list all files without a section header */
          <div className="sb-folder-files sb-folder-files--flat">
            {ungroupedFiles.map(renderFile)}
          </div>
        ) : (
          /* Has folders: show Ungrouped section if there are any ungrouped files */
          ungroupedFiles.length > 0 && (
            <div
              className={`sb-folder${dragOverTarget === '__ungrouped__' ? ' sb-folder--drag-over' : ''}`}
              onDragOver={e => handleDragOver(e, '__ungrouped__')}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTarget(null); }}
              onDrop={e => handleDrop(e, '__ungrouped__')}
            >
              <div className="sb-folder-row">
                <button className="sb-folder-toggle" onClick={() => toggleFolder('__ungrouped__')}>
                  {expandedFolders.has('__ungrouped__') ? '▾' : '▸'}
                </button>
                <span className="sb-folder-name sb-folder-name--muted">Ungrouped</span>
                <span className="sb-folder-count">{ungroupedFiles.length}</span>
              </div>
              {expandedFolders.has('__ungrouped__') && (
                <div className="sb-folder-files">
                  {ungroupedFiles.map(renderFile)}
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="sb-footer">
        {addingFolder ? (
          <input
            ref={newFolderInputRef}
            className="sb-new-folder-input"
            placeholder="Folder name…"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onBlur={commitAddFolder}
            onKeyDown={e => {
              if (e.key === 'Enter') commitAddFolder();
              if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName(''); }
            }}
          />
        ) : (
          <button className="sb-add-folder-btn" onClick={startAddFolder}>
            + New folder
          </button>
        )}
      </div>
    </div>
  );
}

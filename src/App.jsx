import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import DiagramCanvas from './components/DiagramCanvas';
import QuickEntry from './components/QuickEntry';
import Toolbar from './components/Toolbar';
import SectionPanel from './components/SectionPanel';
import AnnotationPanel from './components/AnnotationPanel';
import HelpModal from './components/HelpModal';
import { parseQuickEntry } from './utils/layout';
import {
  loadIndex, saveIndex, loadFile, saveFile, deleteFile,
  migrateLegacy, genId, fileName,
} from './utils/files';

// ── Sharing helpers ───────────────────────────────────────────

function encodeShare(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeShare(encoded) {
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

// ── State shape ───────────────────────────────────────────────

const defaultDiagramState = {
  title: '',
  composer: '',
  quickEntryText: '',
  rehearsalMarks: [],
  rehearsalMarkStyle: 'letters',
  rehearsalMarkCounter: 0,
  structuralMarkers: [],
  annotations: [],
};

const defaultTransient = {
  selectedPhraseIndex: null,
  selectedTextRange: null,
  editMode: null,
  activePanel: null,
  barPickField: null,
  pickedBar: null,
};

const defaultState = { ...defaultDiagramState, ...defaultTransient };

function getDiagramSnapshot(s) {
  // eslint-disable-next-line no-unused-vars
  const { selectedPhraseIndex, selectedTextRange, editMode, activePanel, barPickField, pickedBar, ...data } = s;
  return data;
}

// ── File init singleton ───────────────────────────────────────

let _appInit = null;
function getAppInit() {
  if (_appInit) return _appInit;

  // Check for shared diagram in URL hash
  const hash = window.location.hash;
  if (hash.startsWith('#share=')) {
    window.history.replaceState(null, '', window.location.pathname);
    const data = decodeShare(hash.slice(7));
    if (data) {
      let index = loadIndex();
      if (!index) {
        const baseId = genId();
        index = { currentId: baseId, files: [{ id: baseId, name: 'Untitled', updatedAt: Date.now() }] };
        saveFile(baseId, defaultDiagramState);
      }
      const id = genId();
      const name = fileName(data.title, data.composer);
      const diagram = { ...defaultDiagramState, ...data };
      saveFile(id, diagram);
      const newIndex = { ...index, currentId: id, files: [...index.files, { id, name, updatedAt: Date.now() }] };
      saveIndex(newIndex);
      return (_appInit = { index: newIndex, diagram });
    }
  }

  const index = loadIndex();
  if (index?.currentId) {
    const data = loadFile(index.currentId) ?? defaultDiagramState;
    _appInit = { index, diagram: data };
    return _appInit;
  }
  const migrated = migrateLegacy();
  if (migrated) {
    _appInit = { index: migrated.index, diagram: migrated.data };
    return _appInit;
  }
  const id = genId();
  const newIndex = { currentId: id, files: [{ id, name: 'Untitled', updatedAt: Date.now() }] };
  saveIndex(newIndex);
  saveFile(id, defaultDiagramState);
  _appInit = { index: newIndex, diagram: defaultDiagramState };
  return _appInit;
}

const HELP_SEEN_KEY = 'pd_help_seen';

function counterToLetter(n) {
  let result = '';
  n = n + 1;
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

export default function App() {
  const [fileIndex, setFileIndex] = useState(() => getAppInit().index);
  const [state, setState] = useState(() => ({ ...defaultState, ...getAppInit().diagram }));
  const currentIdRef = useRef(getAppInit().index.currentId);
  const [showHelp, setShowHelp] = useState(() => !localStorage.getItem(HELP_SEEN_KEY));

  // ── History (undo/redo) ─────────────────────────────────────
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const historyRef = useRef({ stack: [], index: -1 });

  // Capture initial snapshot once mounted
  useEffect(() => {
    const snap = getDiagramSnapshot(stateRef.current);
    historyRef.current = { stack: [snap], index: 0 };
  }, []); // eslint-disable-line

  const recordHistory = useCallback(() => {
    const snap = getDiagramSnapshot(stateRef.current);
    const h = historyRef.current;
    if (h.index >= 0 && JSON.stringify(h.stack[h.index]) === JSON.stringify(snap)) return;
    const newStack = [...h.stack.slice(0, h.index + 1), snap].slice(-50);
    historyRef.current = { stack: newStack, index: newStack.length - 1 };
  }, []);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.index <= 0) return;
    const newIndex = h.index - 1;
    historyRef.current = { ...h, index: newIndex };
    setState(s => ({ ...s, ...h.stack[newIndex] }));
  }, []);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    const newIndex = h.index + 1;
    historyRef.current = { ...h, index: newIndex };
    setState(s => ({ ...s, ...h.stack[newIndex] }));
  }, []);

  // Debounce history recording for text field changes
  const textHistoryTimer = useRef(null);
  const textHistoryPending = useRef(false);

  const recordHistoryDebounced = useCallback(() => {
    if (!textHistoryPending.current) {
      recordHistory();
      textHistoryPending.current = true;
    }
    clearTimeout(textHistoryTimer.current);
    textHistoryTimer.current = setTimeout(() => {
      textHistoryPending.current = false;
      recordHistory();
    }, 1500);
  }, [recordHistory]);

  // ── SVG export ref ──────────────────────────────────────────
  const svgRef = useRef(null);

  // ── Auto-save + file name sync ──────────────────────────────
  useEffect(() => {
    const id = currentIdRef.current;
    const toSave = getDiagramSnapshot(state);
    saveFile(id, toSave);
    const name = fileName(state.title, state.composer);
    setFileIndex(prev => {
      const currentFile = prev.files.find(f => f.id === id);
      if (!currentFile || currentFile.name === name) return prev;
      const updated = {
        ...prev,
        files: prev.files.map(f => f.id === id ? { ...f, name, updatedAt: Date.now() } : f),
      };
      saveIndex(updated);
      return updated;
    });
  }, [state]);

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape' && state.editMode) {
        setState(s => ({ ...s, editMode: null }));
      }
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.editMode, undo, redo]);

  const { phrases, lineBreakIndices } = useMemo(
    () => parseQuickEntry(state.quickEntryText),
    [state.quickEntryText]
  );

  // Derive textarea selection from selected phrase or sub-phrase
  const textSelection = useMemo(() => {
    if (state.selectedPhraseIndex == null) return null;
    if (state.selectedTextRange) return state.selectedTextRange;
    const phrase = phrases[state.selectedPhraseIndex];
    if (!phrase || phrase.textStart == null) return null;
    return { start: phrase.textStart, end: phrase.textEnd };
  }, [state.selectedPhraseIndex, state.selectedTextRange, phrases]);

  // ── Panel helpers ───────────────────────────────────────────
  const closePanel = useCallback(() => {
    setState(s => ({ ...s, activePanel: null, barPickField: null, pickedBar: null }));
  }, []);

  const togglePanel = useCallback((name) => {
    setState(s => ({
      ...s,
      activePanel: s.activePanel === name ? null : name,
      barPickField: null,
      pickedBar: null,
    }));
  }, []);

  // ── File handlers ───────────────────────────────────────────
  const handleNewFile = useCallback(() => {
    const id = genId();
    saveFile(id, defaultDiagramState);
    currentIdRef.current = id;
    historyRef.current = { stack: [getDiagramSnapshot({ ...defaultState })], index: 0 };
    setFileIndex(prev => {
      const updated = {
        ...prev,
        currentId: id,
        files: [...prev.files, { id, name: 'Untitled', updatedAt: Date.now() }],
      };
      saveIndex(updated);
      return updated;
    });
    setState({ ...defaultState });
  }, []);

  const handleSwitchFile = useCallback((id) => {
    const data = loadFile(id) ?? defaultDiagramState;
    currentIdRef.current = id;
    historyRef.current = { stack: [getDiagramSnapshot({ ...defaultState, ...data })], index: 0 };
    setFileIndex(prev => {
      const updated = { ...prev, currentId: id };
      saveIndex(updated);
      return updated;
    });
    setState({ ...defaultState, ...data });
  }, []);

  const handleDeleteFile = useCallback((id) => {
    deleteFile(id);
    setFileIndex(prev => {
      const remaining = prev.files.filter(f => f.id !== id);
      const wasActive = prev.currentId === id;
      let newCurrentId = prev.currentId;
      if (wasActive && remaining.length > 0) {
        newCurrentId = remaining[remaining.length - 1].id;
        currentIdRef.current = newCurrentId;
        const data = loadFile(newCurrentId) ?? defaultDiagramState;
        historyRef.current = { stack: [getDiagramSnapshot({ ...defaultState, ...data })], index: 0 };
        setState({ ...defaultState, ...data });
      }
      const updated = { ...prev, currentId: newCurrentId, files: remaining };
      saveIndex(updated);
      return updated;
    });
  }, []);

  // ── Diagram handlers ────────────────────────────────────────
  const handleSlurStartClick = useCallback((bar) => {
    recordHistory();
    setState(s => {
      const existing = s.rehearsalMarks.find(m => m.bar === bar);
      if (existing) {
        return { ...s, rehearsalMarks: s.rehearsalMarks.filter(m => m.bar !== bar) };
      }
      let label;
      if (s.rehearsalMarkStyle === 'letters') {
        label = counterToLetter(s.rehearsalMarkCounter);
      } else if (s.rehearsalMarkStyle === 'numbers') {
        label = String(s.rehearsalMarkCounter + 1);
      } else {
        label = Number.isInteger(bar) ? String(bar) : bar.toFixed(1);
      }
      return {
        ...s,
        rehearsalMarks: [...s.rehearsalMarks, { id: `r${Date.now()}`, bar, label }],
        rehearsalMarkCounter: s.rehearsalMarkCounter + 1,
      };
    });
  }, [recordHistory]);

  const handleRemoveRehearsalMark = useCallback((id) => {
    recordHistory();
    setState(s => ({ ...s, rehearsalMarks: s.rehearsalMarks.filter(m => m.id !== id) }));
  }, [recordHistory]);

  const handleAddSection = useCallback((section) => {
    recordHistory();
    setState(s => ({ ...s, structuralMarkers: [...s.structuralMarkers, { id: `s${Date.now()}`, ...section }] }));
  }, [recordHistory]);

  const handleRemoveSection = useCallback((id) => {
    recordHistory();
    setState(s => ({ ...s, structuralMarkers: s.structuralMarkers.filter(m => m.id !== id) }));
  }, [recordHistory]);

  const handleUpdateSection = useCallback((id, updates) => {
    recordHistory();
    setState(s => ({ ...s, structuralMarkers: s.structuralMarkers.map(m => m.id === id ? { ...m, ...updates } : m) }));
  }, [recordHistory]);

  const handleAddAnnotation = useCallback((annotation) => {
    recordHistory();
    setState(s => ({ ...s, annotations: [...s.annotations, { id: `a${Date.now()}`, ...annotation }] }));
  }, [recordHistory]);

  const handleRemoveAnnotation = useCallback((id) => {
    recordHistory();
    setState(s => ({ ...s, annotations: s.annotations.filter(a => a.id !== id) }));
  }, [recordHistory]);

  const handleUpdateAnnotation = useCallback((id, updates) => {
    recordHistory();
    setState(s => ({ ...s, annotations: s.annotations.map(a => a.id === id ? { ...a, ...updates } : a) }));
  }, [recordHistory]);

  const handleSelectPhrase = useCallback((i) => {
    setState(s => ({ ...s, selectedPhraseIndex: i, selectedTextRange: null }));
  }, []);

  const handleSubPhraseClick = useCallback((phraseIndex, textStart, textEnd, wasSelected) => {
    setState(s => ({
      ...s,
      selectedPhraseIndex: wasSelected ? null : phraseIndex,
      selectedTextRange: wasSelected ? null : { start: textStart, end: textEnd },
    }));
  }, []);

  const handleBarFieldFocus = useCallback((field) => {
    setState(s => ({ ...s, barPickField: field, pickedBar: null }));
  }, []);

  const handleBarPick = useCallback((value) => {
    setState(s => {
      if (!s.barPickField) return s;
      return { ...s, pickedBar: { field: s.barPickField, value } };
    });
  }, []);

  // ── Export / import ─────────────────────────────────────────
  const handleExportJSON = () => {
    const data = getDiagramSnapshot(state);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.title || 'archform'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSVG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const source = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.title || 'archform'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const vb = svg.viewBox.baseVal;
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = vb.width * scale;
      canvas.height = vb.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(pngBlob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(pngBlob);
        a.download = `${state.title || 'archform'}.png`;
        a.click();
      });
    };
    img.src = url;
  };

  const handleImport = file => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        recordHistory();
        setState({
          ...defaultState,
          title: data.title ?? '',
          composer: data.composer ?? '',
          quickEntryText: data.quickEntryText ?? '',
          rehearsalMarks: data.rehearsalMarks ?? [],
          rehearsalMarkStyle: data.rehearsalMarkStyle ?? 'letters',
          rehearsalMarkCounter: data.rehearsalMarkCounter ?? 0,
          structuralMarkers: data.structuralMarkers ?? [],
          annotations: data.annotations ?? [],
        });
      } catch {
        alert('Could not read that file — make sure it is an Archform JSON export.');
      }
    };
    reader.readAsText(file);
  };

  // ── Share ────────────────────────────────────────────────────
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = useCallback(() => {
    const encoded = encodeShare(getDiagramSnapshot(state));
    const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }, [state]);

  const barPickMode = !!state.activePanel && !!state.barPickField;

  return (
    <div className="app">
      {showHelp && <HelpModal onClose={() => { localStorage.setItem(HELP_SEEN_KEY, '1'); setShowHelp(false); }} />}
      <Toolbar
        state={state}
        setState={setState}
        fileIndex={fileIndex}
        onNewFile={handleNewFile}
        onSwitchFile={handleSwitchFile}
        onDeleteFile={handleDeleteFile}
        onShowHelp={() => setShowHelp(true)}
        onUndo={undo}
        onRedo={redo}
        onExportJSON={handleExportJSON}
        onExportSVG={handleExportSVG}
        onExportPNG={handleExportPNG}
        onImport={handleImport}
        onShare={handleShare}
        shareCopied={shareCopied}
        onToggleSectionPanel={() => togglePanel('sections')}
        onToggleAnnotationPanel={() => togglePanel('annotations')}
        sectionPanelOpen={state.activePanel === 'sections'}
        annotationPanelOpen={state.activePanel === 'annotations'}
        onQuickEntryChange={recordHistoryDebounced}
      />

      <div className="main-area">
        <div className="left-side">
          <div className="diagram-area">
            <DiagramCanvas
              title={state.title}
              composer={state.composer}
              phrases={phrases}
              lineBreakIndices={lineBreakIndices}
              rehearsalMarks={state.rehearsalMarks}
              rehearsalMarkStyle={state.rehearsalMarkStyle}
              structuralMarkers={state.structuralMarkers}
              annotations={state.annotations}
              selectedPhraseIndex={state.selectedPhraseIndex}
              editMode={state.editMode}
              barPickMode={barPickMode}
              svgRef={svgRef}
              onSelectPhrase={handleSelectPhrase}
              onSubPhraseClick={handleSubPhraseClick}
              onSlurStartClick={handleSlurStartClick}
              onRemoveRehearsalMark={handleRemoveRehearsalMark}
              onBarPick={handleBarPick}
            />
          </div>

          <QuickEntry
            text={state.quickEntryText}
            onChange={text => {
              recordHistoryDebounced();
              setState(s => ({ ...s, quickEntryText: text, selectedPhraseIndex: null, selectedTextRange: null }));
            }}
            phrases={phrases}
            textSelection={textSelection}
          />
        </div>

        {state.activePanel === 'sections' && (
          <SectionPanel
            onClose={closePanel}
            sections={state.structuralMarkers}
            onAdd={handleAddSection}
            onRemove={handleRemoveSection}
            onUpdate={handleUpdateSection}
            onBarFieldFocus={handleBarFieldFocus}
            pickedBar={state.pickedBar}
          />
        )}

        {state.activePanel === 'annotations' && (
          <AnnotationPanel
            onClose={closePanel}
            annotations={state.annotations}
            onAddAnnotation={handleAddAnnotation}
            onRemoveAnnotation={handleRemoveAnnotation}
            onUpdateAnnotation={handleUpdateAnnotation}
            onBarFieldFocus={handleBarFieldFocus}
            pickedBar={state.pickedBar}
          />
        )}
      </div>
    </div>
  );
}

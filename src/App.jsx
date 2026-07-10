import { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import DiagramCanvas from './components/DiagramCanvas';
import QuickEntry from './components/QuickEntry';
import Toolbar from './components/Toolbar';
import SectionPanel from './components/SectionPanel';
import LabelPanel from './components/LabelPanel';
import HelpModal from './components/HelpModal';
import OverlapPopover from './components/OverlapPopover';
import TimeSignaturePanel from './components/TimeSignaturePanel';
import RepeatsPanel from './components/RepeatsPanel';
import FermataPanel from './components/FermataPanel';
import KeyPanel from './components/KeyPanel';
import RehearsalMarksPanel from './components/RehearsalMarksPanel';
import FileSidebar from './components/FileSidebar';
import FormOverview from './components/FormOverview';
import { relabelMarks } from './utils/marks';
import { parseQuickEntry, computeLayout, barToPosition, CANVAS_WIDTH } from './utils/layout';
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

// Guard against oversized share URLs hanging the tab on load
const MAX_SHARE_HASH_LENGTH = 200_000;

// ── State shape ───────────────────────────────────────────────

const defaultDiagramState = {
  title: '',
  composer: '',
  quickEntryText: '',
  rehearsalMarks: [],
  rehearsalMarkStyle: 'letters',
  structuralMarkers: [],
  labels: [],
  phraseOverlaps: {},
  phraseThemes: {},
  timeSignatures: [],
  repeats: [],
  fermatas: [],
  keyChanges: [],
  rowSpacing: {},
};

const defaultTransient = {
  selectedPhraseIndex: null,
  selectedTextRange: null,
  editMode: null,
  activePanel: null,
  barPickField: null,
  pickedBar: null,
  activeLabelId: null,
  activeSectionId: null,
  activeRepeatId: null,
  activeFermataId: null,
  activeTimeSigId: null,
  activeKeyId: null,
  prefillLabelBar: null,
  prefillSectionBar: null,
};

const defaultState = { ...defaultDiagramState, ...defaultTransient };

// Seeded as the very first file on a fresh install so new users see a worked
// example instead of a blank canvas. Safe to delete; New file stays blank.
const sampleDiagram = {
  ...defaultDiagramState,
  title: 'Minuet (example)',
  composer: '',
  quickEntryText: '4 4\n4 4 8(4+4)',
  timeSignatures: [{ id: 'ts-sample1', numerator: 3, denominator: 4, bar: 1 }],
  structuralMarkers: [
    { id: 's-sample1', label: 'A', startBar: 1, endBar: 9, level: 0, color: '#1a1a1a' },
    { id: 's-sample2', label: 'B', startBar: 9, endBar: 25, level: 0, color: '#2563eb' },
  ],
  labels: [{ id: 'l-sample1', bar: 1, text: 'q Theme' }],
  repeats: [
    { id: 'rp-sample1', bar: 9, type: 'end' },
    { id: 'rp-sample2', bar: 25, type: 'final' },
  ],
};

function getDiagramSnapshot(s) {
  // eslint-disable-next-line no-unused-vars
  const { selectedPhraseIndex, selectedTextRange, editMode, activePanel, barPickField, pickedBar,
          activeLabelId, activeSectionId, activeRepeatId, activeFermataId, activeTimeSigId,
          activeKeyId, prefillLabelBar, prefillSectionBar, ...data } = s;
  return data;
}

// Coerce untrusted diagram data (imports, share links) to the expected shape
// so a malformed payload can't crash the session or bloat storage.
const asStr = (v, max = 50_000) => typeof v === 'string' ? v.slice(0, max) : '';
const asArr = (v, max = 2_000) => Array.isArray(v) ? v.slice(0, max).filter(x => x && typeof x === 'object') : [];
const asObj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};

function sanitizeDiagram(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ...defaultDiagramState };
  return {
    title: asStr(data.title, 500),
    composer: asStr(data.composer, 500),
    quickEntryText: asStr(data.quickEntryText),
    rehearsalMarks: asArr(data.rehearsalMarks),
    rehearsalMarkStyle: ['letters', 'numbers', 'roman', 'bars'].includes(data.rehearsalMarkStyle)
      ? data.rehearsalMarkStyle : 'letters',
    structuralMarkers: asArr(data.structuralMarkers),
    labels: asArr(data.labels ?? data.annotations),
    phraseOverlaps: asObj(data.phraseOverlaps),
    phraseThemes: asObj(data.phraseThemes),
    timeSignatures: asArr(data.timeSignatures),
    repeats: asArr(data.repeats),
    fermatas: asArr(data.fermatas),
    keyChanges: asArr(data.keyChanges),
    rowSpacing: asObj(data.rowSpacing),
  };
}

// ── File init singleton ───────────────────────────────────────

let _appInit = null;
function getAppInit() {
  if (_appInit) return _appInit;

  // Check for shared diagram in URL hash
  const hash = window.location.hash;
  if (hash.startsWith('#share=') && hash.length <= MAX_SHARE_HASH_LENGTH) {
    window.history.replaceState(null, '', window.location.pathname);
    const data = decodeShare(hash.slice(7));
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      let index = loadIndex();
      if (!index) {
        const baseId = genId();
        index = { currentId: baseId, files: [{ id: baseId, name: 'Untitled', updatedAt: Date.now() }] };
        saveFile(baseId, defaultDiagramState);
      }
      const id = genId();
      const diagram = sanitizeDiagram(data);
      const name = fileName(diagram.title, diagram.composer);
      saveFile(id, diagram);
      const newIndex = { ...index, currentId: id, files: [...index.files, { id, name, updatedAt: Date.now(), folderId: null }], folders: index.folders || [] };
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
  const name = fileName(sampleDiagram.title, sampleDiagram.composer);
  const newIndex = { currentId: id, files: [{ id, name, updatedAt: Date.now(), folderId: null }], folders: [] };
  saveIndex(newIndex);
  saveFile(id, sampleDiagram);
  _appInit = { index: newIndex, diagram: sampleDiagram };
  return _appInit;
}

const HELP_SEEN_KEY = 'pd_help_seen';


export default function App() {
  const [fileIndex, setFileIndex] = useState(() => getAppInit().index);
  const [state, setState] = useState(() => {
    const d = getAppInit().diagram;
    // Migrate old 'annotations' key to 'labels' for saved files pre-rename
    return { ...defaultState, ...d, labels: d.labels ?? d.annotations ?? [] };
  });
  const currentIdRef = useRef(getAppInit().index.currentId);
  const [showHelp, setShowHelp] = useState(() => !localStorage.getItem(HELP_SEEN_KEY));
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('pd_sidebar_open');
    return saved === null ? true : saved === '1';
  });
  const [zoom, setZoom] = useState(100);
  const diagramAreaRef = useRef(null);

  // ── Toast (transient notification, optionally with an action) ─
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((message, opts = {}) => {
    clearTimeout(toastTimer.current);
    setToast({ message, actionLabel: opts.actionLabel, onAction: opts.onAction });
    toastTimer.current = setTimeout(() => setToast(null), opts.duration ?? 6000);
  }, []);
  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  // Cmd/Ctrl + scroll on the diagram area controls zoom.
  // Must be attached imperatively so we can pass { passive: false } and call preventDefault.
  useEffect(() => {
    const el = diagramAreaRef.current;
    if (!el) return;
    const handler = (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      // deltaY ~100 per mouse-wheel tick; trackpad sends smaller values continuously.
      setZoom(z => Math.max(50, Math.min(200, Math.round(z - e.deltaY / 10))));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // ── History (undo/redo) ─────────────────────────────────────
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const historyRef = useRef({ stack: [], index: -1 });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryMeta = useCallback(() => {
    const h = historyRef.current;
    setCanUndo(h.index > 0);
    setCanRedo(h.index < h.stack.length - 1);
  }, []);

  // Capture initial snapshot once mounted
  useEffect(() => {
    const snap = getDiagramSnapshot(stateRef.current);
    historyRef.current = { stack: [snap], index: 0 };
    syncHistoryMeta();
  }, []); // eslint-disable-line

  const recordHistory = useCallback(() => {
    const snap = getDiagramSnapshot(stateRef.current);
    const h = historyRef.current;
    if (h.index >= 0 && JSON.stringify(h.stack[h.index]) === JSON.stringify(snap)) return;
    const newStack = [...h.stack.slice(0, h.index + 1), snap].slice(-50);
    historyRef.current = { stack: newStack, index: newStack.length - 1 };
    syncHistoryMeta();
  }, [syncHistoryMeta]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.index <= 0) return;
    const newIndex = h.index - 1;
    historyRef.current = { ...h, index: newIndex };
    setState(s => ({ ...s, ...h.stack[newIndex] }));
    syncHistoryMeta();
  }, [syncHistoryMeta]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    const newIndex = h.index + 1;
    historyRef.current = { ...h, index: newIndex };
    setState(s => ({ ...s, ...h.stack[newIndex] }));
    syncHistoryMeta();
  }, [syncHistoryMeta]);

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
  const storageWarnedRef = useRef(false);
  useEffect(() => {
    const id = currentIdRef.current;
    const toSave = getDiagramSnapshot(state);
    const saved = saveFile(id, toSave);
    if (!saved && !storageWarnedRef.current) {
      storageWarnedRef.current = true;
      showToast('Storage is full — changes are not being saved. Export your work as JSON to be safe.', { duration: 12000 });
    } else if (saved) {
      storageWarnedRef.current = false;
    }
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
      if (e.key === 'Escape') {
        if (state.activePanel) setState(s => ({ ...s, activePanel: null, barPickField: null, pickedBar: null }));
        else if (state.editMode) setState(s => ({ ...s, editMode: null }));
      }
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.editMode, state.activePanel, undo, redo]);

  // Defer the text so rapid keystrokes don't block the main thread with
  // expensive parse+layout+SVG-render cycles on every character.
  const deferredText = useDeferredValue(state.quickEntryText);
  const { phrases, lineBreakIndices } = useMemo(
    () => parseQuickEntry(deferredText),
    [deferredText]
  );

  const hasKeyLane = state.keyChanges.length > 0;
  const layout = useMemo(
    () => computeLayout(phrases, lineBreakIndices, state.structuralMarkers, state.phraseOverlaps, state.rowSpacing, { hasKeyLane }),
    [phrases, lineBreakIndices, state.structuralMarkers, state.phraseOverlaps, state.rowSpacing, hasKeyLane]
  );

  // Overlap popover position (fixed coordinates derived from SVG rect)
  const overlapPopoverPos = useMemo(() => {
    if (state.selectedPhraseIndex == null || !svgRef.current) return null;
    const row = layout.rows.find(r => r.phrases.some(p => p.phraseIndex === state.selectedPhraseIndex));
    if (!row) return null;
    const phrase = row.phrases.find(p => p.phraseIndex === state.selectedPhraseIndex);
    if (!phrase) return null;
    const svgRect = svgRef.current.getBoundingClientRect();
    const scale = svgRect.width / CANVAS_WIDTH;
    const cx = svgRect.left + (phrase.visualX + phrase.width / 2) * scale;
    // Anchor just above the slur arc for "open upward" …
    const yAbove = svgRect.top + (phrase.slurY - 20) * scale;
    // … and just below the full row content for "open downward"
    const yBelow = svgRect.top + (row.rowY + row.rowHeight) * scale + 6;
    return { x: cx, yAbove, yBelow };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedPhraseIndex, layout]);

  const handleOverlapChange = useCallback((startBar, value) => {
    setState(s => {
      const next = { ...s.phraseOverlaps };
      if (!value) delete next[startBar]; else next[startBar] = value;
      return { ...s, phraseOverlaps: next };
    });
  }, []);

  const handleThemeChange = useCallback((startBar, letter) => {
    recordHistory();
    setState(s => {
      const next = { ...s.phraseThemes };
      if (!letter) delete next[startBar]; else next[startBar] = letter;
      return { ...s, phraseThemes: next };
    });
  }, [recordHistory]);

  const handleRowSpacingChange = useCallback((firstBar, px) => {
    setState(s => {
      const next = { ...s.rowSpacing };
      if (!px) delete next[firstBar]; else next[firstBar] = Math.round(px);
      return { ...s, rowSpacing: next };
    });
  }, []);

  // ── Canvas → panel linking ──────────────────────────────────
  const handleLabelCanvasClick = useCallback((id) => {
    setState(s => ({
      ...s,
      activePanel: 'labels',
      activeLabelId: id,
      barPickField: null,
      pickedBar: null,
    }));
  }, []);

  const handleSectionCanvasClick = useCallback((id) => {
    setState(s => ({
      ...s,
      activePanel: 'sections',
      activeSectionId: id,
      barPickField: null,
      pickedBar: null,
    }));
  }, []);

  const handleLabelEditChange = useCallback((id) => {
    setState(s => ({ ...s, activeLabelId: id ?? null }));
  }, []);

  const handleSectionEditChange = useCallback((id) => {
    setState(s => ({ ...s, activeSectionId: id ?? null }));
  }, []);

  const handleRepeatCanvasClick = useCallback((id) => {
    setState(s => ({ ...s, activePanel: 'repeats', activeRepeatId: id, barPickField: null, pickedBar: null }));
  }, []);

  const handleFermataCanvasClick = useCallback((id) => {
    setState(s => ({ ...s, activePanel: 'fermatas', activeFermataId: id, barPickField: null, pickedBar: null }));
  }, []);

  const handleTimeSigCanvasClick = useCallback((id) => {
    setState(s => ({ ...s, activePanel: 'timeSigs', activeTimeSigId: id, barPickField: null, pickedBar: null }));
  }, []);

  const handleKeyCanvasClick = useCallback((id) => {
    setState(s => ({ ...s, activePanel: 'keys', activeKeyId: id, barPickField: null, pickedBar: null }));
  }, []);

  const handleKeyEditChange = useCallback((id) => {
    setState(s => ({ ...s, activeKeyId: id ?? null }));
  }, []);

  const handleRepeatEditChange = useCallback((id) => {
    setState(s => ({ ...s, activeRepeatId: id ?? null }));
  }, []);

  const handleFermataEditChange = useCallback((id) => {
    setState(s => ({ ...s, activeFermataId: id ?? null }));
  }, []);

  const handleTimeSigEditChange = useCallback((id) => {
    setState(s => ({ ...s, activeTimeSigId: id ?? null }));
  }, []);

  const handleRehearsalMarkPanelOpen = useCallback(() => {
    setState(s => ({ ...s, activePanel: 'rehearsalMarks', selectedPhraseIndex: null }));
  }, []);

  const handleAddLabelHere = useCallback((bar) => {
    setState(s => ({
      ...s,
      activePanel: 'labels',
      activeLabelId: null,
      selectedPhraseIndex: null,
      prefillLabelBar: { bar, ts: Date.now() },
    }));
  }, []);

  const handleAddSectionHere = useCallback((bar) => {
    setState(s => ({
      ...s,
      activePanel: 'sections',
      activeSectionId: null,
      selectedPhraseIndex: null,
      prefillSectionBar: { bar, ts: Date.now() },
    }));
  }, []);

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
      selectedPhraseIndex: null,
      selectedTextRange: null,
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
        files: [...prev.files, { id, name: 'Untitled', updatedAt: Date.now(), folderId: null }],
      };
      saveIndex(updated);
      return updated;
    });
    setState({ ...defaultState });
  }, []);

  const handleSwitchFile = useCallback((id) => {
    const data = loadFile(id) ?? defaultDiagramState;
    const merged = { ...defaultState, ...data, labels: data.labels ?? data.annotations ?? [] };
    currentIdRef.current = id;
    historyRef.current = { stack: [getDiagramSnapshot(merged)], index: 0 };
    setFileIndex(prev => {
      const updated = { ...prev, currentId: id };
      saveIndex(updated);
      return updated;
    });
    setState(merged);
  }, []);

  const handleDeleteFile = useCallback((id) => {
    // Stash the file so the toast's Undo can restore it — deletion is
    // otherwise permanent (localStorage remove, outside diagram history).
    const entry = fileIndex.files.find(f => f.id === id);
    const wasActive = fileIndex.currentId === id;
    const data = loadFile(id);
    deleteFile(id);
    setFileIndex(prev => {
      const remaining = prev.files.filter(f => f.id !== id);
      let newCurrentId = prev.currentId;
      if (prev.currentId === id && remaining.length > 0) {
        newCurrentId = remaining[remaining.length - 1].id;
        currentIdRef.current = newCurrentId;
        const next = loadFile(newCurrentId) ?? defaultDiagramState;
        const merged = { ...defaultState, ...next, labels: next.labels ?? next.annotations ?? [] };
        historyRef.current = { stack: [getDiagramSnapshot(merged)], index: 0 };
        setState(merged);
      }
      const updated = { ...prev, currentId: newCurrentId, files: remaining };
      saveIndex(updated);
      return updated;
    });
    showToast(`Deleted “${entry?.name ?? 'file'}”`, {
      actionLabel: 'Undo',
      onAction: () => {
        if (data) saveFile(id, data);
        setFileIndex(prev => {
          const updated = {
            ...prev,
            currentId: wasActive ? id : prev.currentId,
            files: [...prev.files, entry ?? { id, name: 'Untitled', updatedAt: Date.now(), folderId: null }],
          };
          saveIndex(updated);
          return updated;
        });
        if (wasActive) {
          const restored = data ?? defaultDiagramState;
          const merged = { ...defaultState, ...restored, labels: restored.labels ?? restored.annotations ?? [] };
          currentIdRef.current = id;
          historyRef.current = { stack: [getDiagramSnapshot(merged)], index: 0 };
          setState(merged);
        }
      },
    });
  }, [fileIndex, showToast]);

  // ── Folder handlers ─────────────────────────────────────────
  const handleAddFolder = useCallback((name) => {
    setFileIndex(prev => {
      const folder = { id: genId(), name };
      const updated = { ...prev, folders: [...(prev.folders || []), folder] };
      saveIndex(updated);
      return updated;
    });
  }, []);

  const handleDeleteFolder = useCallback((id) => {
    const folder = fileIndex.folders?.find(f => f.id === id);
    const memberIds = fileIndex.files.filter(f => f.folderId === id).map(f => f.id);
    setFileIndex(prev => {
      const updated = {
        ...prev,
        folders: prev.folders.filter(f => f.id !== id),
        files: prev.files.map(f => f.folderId === id ? { ...f, folderId: null } : f),
      };
      saveIndex(updated);
      return updated;
    });
    const suffix = memberIds.length
      ? ` — ${memberIds.length} file${memberIds.length > 1 ? 's' : ''} moved to Ungrouped`
      : '';
    showToast(`Deleted folder “${folder?.name ?? ''}”${suffix}`, {
      actionLabel: 'Undo',
      onAction: () => {
        if (!folder) return;
        setFileIndex(prev => {
          const updated = {
            ...prev,
            folders: [...prev.folders, folder],
            files: prev.files.map(f => memberIds.includes(f.id) ? { ...f, folderId: id } : f),
          };
          saveIndex(updated);
          return updated;
        });
      },
    });
  }, [fileIndex, showToast]);

  const handleRenameFolder = useCallback((id, name) => {
    setFileIndex(prev => {
      const updated = { ...prev, folders: prev.folders.map(f => f.id === id ? { ...f, name } : f) };
      saveIndex(updated);
      return updated;
    });
  }, []);

  const handleMoveFile = useCallback((fileId, folderId) => {
    setFileIndex(prev => {
      const updated = {
        ...prev,
        files: prev.files.map(f => f.id === fileId ? { ...f, folderId: folderId ?? null } : f),
      };
      saveIndex(updated);
      return updated;
    });
  }, []);

  const handleDuplicateFile = useCallback((id) => {
    const sourceData = loadFile(id) ?? defaultDiagramState;
    const sourceFile = fileIndex.files.find(f => f.id === id);
    const newId = genId();
    const baseName = sourceFile?.name ?? 'Untitled';
    const dupName = `${baseName} (copy)`;
    saveFile(newId, sourceData);
    setFileIndex(prev => {
      const idx = prev.files.findIndex(f => f.id === id);
      const newFile = { id: newId, name: dupName, updatedAt: Date.now(), folderId: sourceFile?.folderId ?? null };
      const files = [...prev.files];
      files.splice(idx + 1, 0, newFile);
      const updated = { ...prev, files };
      saveIndex(updated);
      return updated;
    });
  }, [fileIndex.files]);

  // ── Diagram handlers ────────────────────────────────────────
  const handleSlurStartClick = useCallback((bar) => {
    recordHistory();
    setState(s => {
      const existing = s.rehearsalMarks.find(m => m.bar === bar);
      let marks;
      if (existing) {
        marks = s.rehearsalMarks.filter(m => m.bar !== bar);
      } else {
        marks = [...s.rehearsalMarks, { id: `r${Date.now()}`, bar, label: '' }];
      }
      return { ...s, rehearsalMarks: relabelMarks(marks, s.rehearsalMarkStyle) };
    });
  }, [recordHistory]);

  const handleRemoveRehearsalMark = useCallback((id) => {
    recordHistory();
    setState(s => {
      const marks = s.rehearsalMarks.filter(m => m.id !== id);
      return { ...s, rehearsalMarks: relabelMarks(marks, s.rehearsalMarkStyle) };
    });
  }, [recordHistory]);

  const handleMarkStyleChange = useCallback((style) => {
    recordHistory();
    setState(s => ({ ...s, rehearsalMarkStyle: style, rehearsalMarks: relabelMarks(s.rehearsalMarks, style) }));
  }, [recordHistory]);

  const handleAddManualMark = useCallback((bar) => {
    recordHistory();
    setState(s => {
      // Toggle off if one already exists at this bar
      if (s.rehearsalMarks.find(m => m.bar === bar)) {
        const marks = s.rehearsalMarks.filter(m => m.bar !== bar);
        return { ...s, rehearsalMarks: relabelMarks(marks, s.rehearsalMarkStyle) };
      }
      const marks = [...s.rehearsalMarks, { id: `r${Date.now()}`, bar, label: '' }];
      return { ...s, rehearsalMarks: relabelMarks(marks, s.rehearsalMarkStyle) };
    });
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

  const handleAddLabel = useCallback((label) => {
    recordHistory();
    setState(s => ({ ...s, labels: [...s.labels, { id: `l${Date.now()}`, ...label }] }));
  }, [recordHistory]);

  const handleRemoveLabel = useCallback((id) => {
    recordHistory();
    setState(s => ({ ...s, labels: s.labels.filter(a => a.id !== id) }));
  }, [recordHistory]);

  const handleUpdateLabel = useCallback((id, updates) => {
    recordHistory();
    setState(s => ({ ...s, labels: s.labels.map(a => a.id === id ? { ...a, ...updates } : a) }));
  }, [recordHistory]);

  const handleAddRepeat = useCallback((repeat) => {
    recordHistory();
    setState(s => ({ ...s, repeats: [...s.repeats, { id: `rp${Date.now()}`, ...repeat }] }));
  }, [recordHistory]);

  const handleRemoveRepeat = useCallback((id) => {
    recordHistory();
    setState(s => ({ ...s, repeats: s.repeats.filter(r => r.id !== id) }));
  }, [recordHistory]);

  const handleUpdateRepeat = useCallback((id, updates) => {
    recordHistory();
    setState(s => ({ ...s, repeats: s.repeats.map(r => r.id === id ? { ...r, ...updates } : r) }));
  }, [recordHistory]);

  const handleAddFermata = useCallback((fermata) => {
    recordHistory();
    setState(s => ({ ...s, fermatas: [...s.fermatas, { id: `f${Date.now()}`, ...fermata }] }));
  }, [recordHistory]);

  const handleRemoveFermata = useCallback((id) => {
    recordHistory();
    setState(s => ({ ...s, fermatas: s.fermatas.filter(f => f.id !== id) }));
  }, [recordHistory]);

  const handleUpdateFermata = useCallback((id, updates) => {
    recordHistory();
    setState(s => ({ ...s, fermatas: s.fermatas.map(f => f.id === id ? { ...f, ...updates } : f) }));
  }, [recordHistory]);

  const handleAddKey = useCallback((key) => {
    recordHistory();
    setState(s => ({ ...s, keyChanges: [...s.keyChanges, { id: `k${Date.now()}`, ...key }] }));
  }, [recordHistory]);

  const handleRemoveKey = useCallback((id) => {
    recordHistory();
    setState(s => ({ ...s, keyChanges: s.keyChanges.filter(k => k.id !== id) }));
  }, [recordHistory]);

  const handleUpdateKey = useCallback((id, updates) => {
    recordHistory();
    setState(s => ({ ...s, keyChanges: s.keyChanges.map(k => k.id === id ? { ...k, ...updates } : k) }));
  }, [recordHistory]);

  const handleAddTimeSig = useCallback((ts) => {
    recordHistory();
    setState(s => ({ ...s, timeSignatures: [...s.timeSignatures, { id: `ts${Date.now()}`, ...ts }] }));
  }, [recordHistory]);

  const handleRemoveTimeSig = useCallback((id) => {
    recordHistory();
    setState(s => ({ ...s, timeSignatures: s.timeSignatures.filter(t => t.id !== id) }));
  }, [recordHistory]);

  const handleUpdateTimeSig = useCallback((id, updates) => {
    recordHistory();
    setState(s => ({ ...s, timeSignatures: s.timeSignatures.map(t => t.id === id ? { ...t, ...updates } : t) }));
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

  // Clone SVG and strip interactive-only elements before export
  const getExportSVG = () => {
    const svg = svgRef.current;
    if (!svg) return null;
    const clone = svg.cloneNode(true);
    clone.querySelectorAll('[data-no-export]').forEach(el => el.remove());
    // Add <title> metadata so the file is identifiable in file managers / screen readers
    const titleParts = [state.title, state.composer].filter(Boolean);
    if (titleParts.length) {
      const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      titleEl.textContent = titleParts.join(' — ');
      clone.insertBefore(titleEl, clone.firstChild);
    }
    return clone;
  };

  const handleExportSVG = () => {
    const clone = getExportSVG();
    if (!clone) return;
    const source = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.title || 'archform'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = () => {
    const clone = getExportSVG();
    if (!clone) return;
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const vb = svgRef.current.viewBox.baseVal;
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
        const raw = JSON.parse(e.target.result);
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('not a diagram');
        // Import as a new file rather than overwriting the current diagram
        const diagram = sanitizeDiagram(raw);
        const id = genId();
        const name = fileName(diagram.title, diagram.composer);
        saveFile(id, diagram);
        const merged = { ...defaultState, ...diagram };
        currentIdRef.current = id;
        historyRef.current = { stack: [getDiagramSnapshot(merged)], index: 0 };
        setFileIndex(prev => {
          const updated = {
            ...prev,
            currentId: id,
            files: [...prev.files, { id, name, updatedAt: Date.now(), folderId: null }],
          };
          saveIndex(updated);
          return updated;
        });
        setState(merged);
        showToast(`Imported “${name}” as a new file`);
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
      if (url.length > 64_000) {
        showToast('This diagram is very large — the share link may not work in every browser. JSON export is more reliable.', { duration: 8000 });
      }
    });
  }, [state, showToast]);

  // Scroll the main view to a bar when a form-overview block is clicked.
  const handleOverviewNavigate = useCallback((bar) => {
    const area = diagramAreaRef.current;
    const svg = svgRef.current;
    if (!area || !svg) return;
    const pos = barToPosition(bar, layout.rows);
    const row = pos ? layout.rows[pos.rowIndex] : null;
    if (!row) return;
    // getBoundingClientRect deltas keep this correct at any zoom level
    const scale = svg.getBoundingClientRect().width / CANVAS_WIDTH;
    const svgTop = svg.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop;
    area.scrollTo({ top: Math.max(0, svgTop + row.rowY * scale - 56), behavior: 'smooth' });
  }, [layout]);

  const barPickMode = !!state.activePanel && !!state.barPickField;

  return (
    <div className="app">
      {showHelp && <HelpModal onClose={() => { localStorage.setItem(HELP_SEEN_KEY, '1'); setShowHelp(false); }} />}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-message">{toast.message}</span>
          {toast.actionLabel && (
            <button className="toast-action" onClick={() => { toast.onAction?.(); dismissToast(); }}>
              {toast.actionLabel}
            </button>
          )}
          <button className="toast-close" onClick={dismissToast} title="Dismiss">✕</button>
        </div>
      )}
      <Toolbar
        state={state}
        setState={setState}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(o => { const next = !o; localStorage.setItem('pd_sidebar_open', next ? '1' : '0'); return next; })}
        onShowHelp={() => setShowHelp(true)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onExportJSON={handleExportJSON}
        onExportSVG={handleExportSVG}
        onExportPNG={handleExportPNG}
        onImport={handleImport}
        onShare={handleShare}
        shareCopied={shareCopied}
      />

      <div className="main-area">
        {sidebarOpen && (
          <FileSidebar
            fileIndex={fileIndex}
            onNew={handleNewFile}
            onSwitch={handleSwitchFile}
            onDelete={handleDeleteFile}
            onDuplicate={handleDuplicateFile}
            onAddFolder={handleAddFolder}
            onDeleteFolder={handleDeleteFolder}
            onRenameFolder={handleRenameFolder}
            onMoveFile={handleMoveFile}
          />
        )}
        <div className="left-side">
          <div className="diagram-area" ref={diagramAreaRef}>
            <FormOverview
              sections={state.structuralMarkers}
              layoutRows={layout.rows}
              onNavigate={handleOverviewNavigate}
            />
            <div className="zoom-controls">
              <button className="btn zoom-btn" onClick={() => setZoom(z => Math.max(50, z - 10))} title="Zoom out">−</button>
              <span className="zoom-label">{zoom}%</span>
              <button className="btn zoom-btn" onClick={() => setZoom(z => Math.min(200, z + 10))} title="Zoom in">+</button>
              {zoom !== 100 && <button className="btn zoom-btn" onClick={() => setZoom(100)} title="Reset zoom">↺</button>}
            </div>
            <div style={{ width: `${zoom}%`, minWidth: zoom < 100 ? `${zoom}%` : undefined }}>
            <DiagramCanvas
              layout={layout}
              title={state.title}
              composer={state.composer}
              structuralMarkers={state.structuralMarkers}
              timeSignatures={state.timeSignatures}
              rehearsalMarks={state.rehearsalMarks}
              rehearsalMarkStyle={state.rehearsalMarkStyle}
              labels={state.labels}
              repeats={state.repeats}
              fermatas={state.fermatas}
              phraseThemes={state.phraseThemes}
              selectedPhraseIndex={state.selectedPhraseIndex}
              editMode={state.activePanel === 'rehearsalMarks' ? 'rehearsalMarks' : state.editMode}
              barPickMode={barPickMode}
              svgRef={svgRef}
              rowSpacing={state.rowSpacing}
              onRowSpacingChange={handleRowSpacingChange}
              onSelectPhrase={handleSelectPhrase}
              onSubPhraseClick={handleSubPhraseClick}
              onSlurStartClick={handleSlurStartClick}
              onRemoveRehearsalMark={handleRemoveRehearsalMark}
              onRehearsalMarkPanelOpen={handleRehearsalMarkPanelOpen}
              onBarPick={handleBarPick}
              activeLabelId={state.activeLabelId}
              activeSectionId={state.activeSectionId}
              activeRepeatId={state.activeRepeatId}
              activeFermataId={state.activeFermataId}
              activeTimeSigId={state.activeTimeSigId}
              keyChanges={state.keyChanges}
              activeKeyId={state.activeKeyId}
              onLabelClick={handleLabelCanvasClick}
              onSectionClick={handleSectionCanvasClick}
              onRepeatClick={handleRepeatCanvasClick}
              onFermataClick={handleFermataCanvasClick}
              onTimeSigClick={handleTimeSigCanvasClick}
              onKeyClick={handleKeyCanvasClick}
            />
            {state.selectedPhraseIndex != null && overlapPopoverPos && !state.editMode && (
              <OverlapPopover
                startBar={phrases[state.selectedPhraseIndex]?.startBar}
                value={state.phraseOverlaps[phrases[state.selectedPhraseIndex]?.startBar] || 0}
                theme={state.phraseThemes[phrases[state.selectedPhraseIndex]?.startBar] || null}
                position={overlapPopoverPos}
                onClose={() => setState(s => ({ ...s, selectedPhraseIndex: null, selectedTextRange: null }))}
                onChange={handleOverlapChange}
                onThemeChange={handleThemeChange}
                onAddAnnotationHere={handleAddLabelHere}
                onAddSectionHere={handleAddSectionHere}
              />
            )}
            </div>{/* end zoom wrapper */}
          </div>

          <div className="bottom-area">
            {state.activePanel === 'rehearsalMarks' ? (
              <RehearsalMarksPanel
                rehearsalMarks={state.rehearsalMarks}
                rehearsalMarkStyle={state.rehearsalMarkStyle}
                onClose={() => togglePanel('rehearsalMarks')}
                onStyleChange={handleMarkStyleChange}
                onAddManualMark={handleAddManualMark}
                onRemoveMark={handleRemoveRehearsalMark}
              />
            ) : (
              <QuickEntry
                text={state.quickEntryText}
                onChange={text => {
                  recordHistoryDebounced();
                  setState(s => ({ ...s, quickEntryText: text, selectedPhraseIndex: null, selectedTextRange: null }));
                }}
                phrases={phrases}
                textSelection={textSelection}
              />
            )}
            <div className="bottom-panel-buttons">
              <button className={`btn bottom-btn ${state.activePanel === 'sections' ? 'btn-active' : ''}`}
                onClick={() => togglePanel('sections')}>Sections</button>
              <button className={`btn bottom-btn ${state.activePanel === 'labels' ? 'btn-active' : ''}`}
                onClick={() => togglePanel('labels')}>Labels</button>
              <button className={`btn bottom-btn ${state.activePanel === 'timeSigs' ? 'btn-active' : ''}`}
                onClick={() => togglePanel('timeSigs')}>Time signatures</button>
              <button className={`btn bottom-btn ${state.activePanel === 'rehearsalMarks' ? 'btn-active' : ''}`}
                onClick={() => togglePanel('rehearsalMarks')}>Rehearsal marks</button>
              <button className={`btn bottom-btn ${state.activePanel === 'repeats' ? 'btn-active' : ''}`}
                onClick={() => togglePanel('repeats')}>Barlines & repeats</button>
              <button className={`btn bottom-btn ${state.activePanel === 'fermatas' ? 'btn-active' : ''}`}
                onClick={() => togglePanel('fermatas')}>Fermatas &amp; breaks</button>
              <button className={`btn bottom-btn ${state.activePanel === 'keys' ? 'btn-active' : ''}`}
                onClick={() => togglePanel('keys')}>Keys</button>
            </div>
          </div>
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
            layoutRows={layout.rows}
            requestEditId={state.activeSectionId}
            onEditChange={handleSectionEditChange}
            prefillBar={state.prefillSectionBar}
          />
        )}

        {state.activePanel === 'labels' && (
          <LabelPanel
            onClose={closePanel}
            labels={state.labels}
            onAddLabel={handleAddLabel}
            onRemoveLabel={handleRemoveLabel}
            onUpdateLabel={handleUpdateLabel}
            onBarFieldFocus={handleBarFieldFocus}
            pickedBar={state.pickedBar}
            layoutRows={layout.rows}
            requestEditId={state.activeLabelId}
            onEditChange={handleLabelEditChange}
            prefillBar={state.prefillLabelBar}
          />
        )}

        {state.activePanel === 'timeSigs' && (
          <TimeSignaturePanel
            onClose={closePanel}
            timeSignatures={state.timeSignatures}
            onAdd={handleAddTimeSig}
            onRemove={handleRemoveTimeSig}
            onUpdate={handleUpdateTimeSig}
            onBarFieldFocus={handleBarFieldFocus}
            pickedBar={state.pickedBar}
            layoutRows={layout.rows}
            requestEditId={state.activeTimeSigId}
            onEditChange={handleTimeSigEditChange}
          />
        )}

        {state.activePanel === 'repeats' && (
          <RepeatsPanel
            onClose={closePanel}
            repeats={state.repeats}
            onAdd={handleAddRepeat}
            onRemove={handleRemoveRepeat}
            onUpdate={handleUpdateRepeat}
            onBarFieldFocus={handleBarFieldFocus}
            pickedBar={state.pickedBar}
            layoutRows={layout.rows}
            requestEditId={state.activeRepeatId}
            onEditChange={handleRepeatEditChange}
          />
        )}

        {state.activePanel === 'fermatas' && (
          <FermataPanel
            onClose={closePanel}
            fermatas={state.fermatas}
            onAdd={handleAddFermata}
            onRemove={handleRemoveFermata}
            onUpdate={handleUpdateFermata}
            onBarFieldFocus={handleBarFieldFocus}
            pickedBar={state.pickedBar}
            layoutRows={layout.rows}
            requestEditId={state.activeFermataId}
            onEditChange={handleFermataEditChange}
          />
        )}

        {state.activePanel === 'keys' && (
          <KeyPanel
            onClose={closePanel}
            keyChanges={state.keyChanges}
            onAdd={handleAddKey}
            onRemove={handleRemoveKey}
            onUpdate={handleUpdateKey}
            onBarFieldFocus={handleBarFieldFocus}
            pickedBar={state.pickedBar}
            layoutRows={layout.rows}
            requestEditId={state.activeKeyId}
            onEditChange={handleKeyEditChange}
          />
        )}
      </div>
    </div>
  );
}

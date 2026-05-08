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
  editMode: null,
  activePanel: null,
  barPickField: null,
  pickedBar: null,
};

const defaultState = { ...defaultDiagramState, ...defaultTransient };

// Module-level singleton so React strict-mode double-invoke doesn't create duplicate files
let _appInit = null;
function getAppInit() {
  if (_appInit) return _appInit;
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

const HELP_SEEN_KEY = 'pd_help_seen';

export default function App() {
  const [fileIndex, setFileIndex] = useState(() => getAppInit().index);
  const [state, setState] = useState(() => ({ ...defaultState, ...getAppInit().diagram }));
  const currentIdRef = useRef(getAppInit().index.currentId);
  const [showHelp, setShowHelp] = useState(() => !localStorage.getItem(HELP_SEEN_KEY));

  // Auto-save diagram state and keep file name in sync with title/composer
  useEffect(() => {
    const id = currentIdRef.current;
    // eslint-disable-next-line no-unused-vars
    const { selectedPhraseIndex, editMode, activePanel, barPickField, pickedBar, ...toSave } = state;
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

  // Dismiss mark mode on Escape
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape' && state.editMode) {
        setState(s => ({ ...s, editMode: null }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.editMode]);

  const { phrases, lineBreakIndices } = useMemo(
    () => parseQuickEntry(state.quickEntryText),
    [state.quickEntryText]
  );

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

  const handleNewFile = useCallback(() => {
    const id = genId();
    saveFile(id, defaultDiagramState);
    currentIdRef.current = id;
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
        setState({ ...defaultState, ...data });
      }
      const updated = { ...prev, currentId: newCurrentId, files: remaining };
      saveIndex(updated);
      return updated;
    });
  }, []);

  const handleSlurStartClick = useCallback((bar) => {
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
  }, []);

  const handleRemoveRehearsalMark = useCallback((id) => {
    setState(s => ({ ...s, rehearsalMarks: s.rehearsalMarks.filter(m => m.id !== id) }));
  }, []);

  const handleAddSection = useCallback((section) => {
    setState(s => ({ ...s, structuralMarkers: [...s.structuralMarkers, { id: `s${Date.now()}`, ...section }] }));
  }, []);

  const handleRemoveSection = useCallback((id) => {
    setState(s => ({ ...s, structuralMarkers: s.structuralMarkers.filter(m => m.id !== id) }));
  }, []);

  const handleUpdateSection = useCallback((id, updates) => {
    setState(s => ({ ...s, structuralMarkers: s.structuralMarkers.map(m => m.id === id ? { ...m, ...updates } : m) }));
  }, []);

  const handleAddAnnotation = useCallback((annotation) => {
    setState(s => ({ ...s, annotations: [...s.annotations, { id: `a${Date.now()}`, ...annotation }] }));
  }, []);

  const handleRemoveAnnotation = useCallback((id) => {
    setState(s => ({ ...s, annotations: s.annotations.filter(a => a.id !== id) }));
  }, []);

  const handleUpdateAnnotation = useCallback((id, updates) => {
    setState(s => ({ ...s, annotations: s.annotations.map(a => a.id === id ? { ...a, ...updates } : a) }));
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

  const handleExport = () => {
    // eslint-disable-next-line no-unused-vars
    const { selectedPhraseIndex, editMode, activePanel, barPickField, pickedBar, ...data } = state;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.title || 'phrase-diagram'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = file => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
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
        alert('Could not read that file — make sure it is a Phrase Diagrams JSON export.');
      }
    };
    reader.readAsText(file);
  };

  const handleCloseHelp = useCallback(() => {
    localStorage.setItem(HELP_SEEN_KEY, '1');
    setShowHelp(false);
  }, []);

  const barPickMode = !!state.activePanel && !!state.barPickField;

  return (
    <div className="app">
      {showHelp && <HelpModal onClose={handleCloseHelp} />}
      <Toolbar
        state={state}
        setState={setState}
        fileIndex={fileIndex}
        onNewFile={handleNewFile}
        onSwitchFile={handleSwitchFile}
        onDeleteFile={handleDeleteFile}
        onShowHelp={() => setShowHelp(true)}
        onExport={handleExport}
        onImport={handleImport}
        onToggleSectionPanel={() => togglePanel('sections')}
        onToggleAnnotationPanel={() => togglePanel('annotations')}
        sectionPanelOpen={state.activePanel === 'sections'}
        annotationPanelOpen={state.activePanel === 'annotations'}
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
              onSelectPhrase={i => setState(s => ({ ...s, selectedPhraseIndex: i }))}
              onSlurStartClick={handleSlurStartClick}
              onRemoveRehearsalMark={handleRemoveRehearsalMark}
              onBarPick={handleBarPick}
            />
          </div>

          <QuickEntry
            text={state.quickEntryText}
            onChange={text => setState(s => ({ ...s, quickEntryText: text, selectedPhraseIndex: null }))}
            phrases={phrases}
            selectedPhraseIndex={state.selectedPhraseIndex}
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

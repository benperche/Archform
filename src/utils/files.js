export const INDEX_KEY = 'pd_index_v1';
export const fileKey = id => `pd_file_${id}`;
const LEGACY_KEY = 'phraseDiagram_v1';

export function fileName(title, composer) {
  const parts = [title?.trim(), composer?.trim()].filter(Boolean);
  return parts.length ? parts.join(' – ') : 'Untitled';
}

export function genId() {
  return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function loadIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function loadFile(id) {
  try {
    const raw = localStorage.getItem(fileKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveFile(id, data) {
  localStorage.setItem(fileKey(id), JSON.stringify(data));
}

export function deleteFile(id) {
  localStorage.removeItem(fileKey(id));
}

// Migrate from the old single-file storage key. Returns { index, data } or null.
export function migrateLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const id = genId();
    const name = fileName(data.title, data.composer);
    const index = { currentId: id, files: [{ id, name, updatedAt: Date.now() }] };
    saveIndex(index);
    saveFile(id, data);
    localStorage.removeItem(LEGACY_KEY);
    return { index, data };
  } catch { return null; }
}

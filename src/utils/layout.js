export const CANVAS_WIDTH = 1440;
export const PADDING = 64;
export const HEADER_HEIGHT = 64;
const USABLE_WIDTH = CANVAS_WIDTH - 2 * PADDING;

const BASE_ROW_HEIGHT = 108;

// Parse a single token: "6" or "6(4+2)" or "4.5(2+2.5)"
// Returns { length, subPhrases, subTextRanges } where subTextRanges are
// char offsets *within the token string* for each sub-number.
function parseToken(raw) {
  const trimmed = raw.trim();
  const subMatch = trimmed.match(/^(\d+\.?\d*)\(([^)]+)\)$/);
  if (subMatch) {
    const length = parseFloat(subMatch[1]);
    const innerStr = subMatch[2];
    const prefixLen = subMatch[1].length + 1; // e.g. "7(" = 2 chars
    const subPhrases = [];
    const subTextRanges = [];
    const numRe = /\d+\.?\d*/g;
    let m;
    while ((m = numRe.exec(innerStr)) !== null) {
      const n = parseFloat(m[0]);
      if (n > 0) {
        subPhrases.push(n);
        subTextRanges.push({ start: prefixLen + m.index, end: prefixLen + m.index + m[0].length });
      }
    }
    return { length, subPhrases, subTextRanges };
  }
  const n = parseFloat(trimmed);
  if (!isNaN(n) && n > 0) return { length: n, subPhrases: [], subTextRanges: [] };
  return null;
}

// Tokenize a line, keeping parenthetical groups intact.
// Returns [{token, start, end}] with character offsets into the original line.
function tokenizeLine(line) {
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    if (/[\s,)]/.test(line[i])) { i++; continue; } // skip whitespace, commas, stray close-parens
    let j = i, depth = 0;
    while (j < line.length) {
      if (line[j] === '(') depth++;
      else if (line[j] === ')') {
        if (depth === 0) break; // stray close-paren ends the token
        depth--;
      } else if (/[\s,]/.test(line[j]) && depth === 0) break;
      j++;
    }
    if (j > i) tokens.push({ token: line.slice(i, j), start: i, end: j });
    i = j;
  }
  return tokens;
}

// Parse the quick-entry textarea into phrases + line-break set.
// Each line → one row; numbers separated by spaces/commas.
// Subphrase syntax: 6(4+2) creates an outer phrase of 6 with two inner phrases.
export function parseQuickEntry(text) {
  if (!text.trim()) return { phrases: [], lineBreakIndices: new Set() };

  const lines = text.split('\n');
  const phrases = [];
  const lineBreakIndices = new Set();
  let barCounter = 1;

  let lineOffset = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      const tokens = tokenizeLine(line);

      for (let ti = 0; ti < tokens.length; ti++) {
        const { token, start, end } = tokens[ti];
        const parsed = parseToken(token);
        if (!parsed) continue;

        const idx = phrases.length;
        if (idx > 0 && ti === 0) lineBreakIndices.add(idx);

        phrases.push({
          id: `p${idx}`,
          startBar: barCounter,
          length: parsed.length,
          subPhrases: parsed.subPhrases,
          subTextRanges: parsed.subTextRanges,
          textStart: lineOffset + start,
          textEnd: lineOffset + end,
        });
        barCounter = Math.round((barCounter + parsed.length) * 1000) / 1000;
      }
    }
    lineOffset += line.length + 1; // +1 for the \n separator
  }

  return { phrases, lineBreakIndices };
}

// Top padding is based on how many distinct section levels exist on a row.
// 0 levels → 0px, 1 level → 30px, 2 levels → 56px, 3 levels → 82px.
function rowTopPaddingForLevels(levelSet) {
  const n = levelSet.size;
  return n === 0 ? 0 : (n - 1) * 26 + 30;
}

// Key lane: slim band under each row showing key regions, only present
// when the diagram has key changes.
const KEY_LANE_HEIGHT = 16;
const KEY_LANE_GAP = 8;

export function computeLayout(phrases, lineBreakIndices, structuralMarkers = [], phraseOverlaps = {}, rowSpacing = {}, opts = {}) {
  if (!phrases.length) {
    return { rows: [], totalHeight: HEADER_HEIGHT + 176, CANVAS_WIDTH, HEADER_HEIGHT, PADDING };
  }
  const keyLaneExtra = opts.hasKeyLane ? KEY_LANE_GAP + KEY_LANE_HEIGHT : 0;

  // Group phrases into rows
  const rows = [];
  let current = [];
  for (let i = 0; i < phrases.length; i++) {
    if (lineBreakIndices.has(i) && current.length > 0) {
      rows.push(current);
      current = [];
    }
    current.push({ ...phrases[i], phraseIndex: i });
  }
  if (current.length > 0) rows.push(current);

  // Collect the set of distinct section levels that start on each row.
  const rowLevelSets = rows.map(row => {
    const rowStartBar = row[0].startBar;
    const last = row[row.length - 1];
    const rowEndBar = last.startBar + last.length;
    const levels = new Set();
    for (const marker of structuralMarkers) {
      if (marker.startBar >= rowStartBar && marker.startBar < rowEndBar) {
        levels.add(marker.level ?? 0);
      }
    }
    return levels;
  });

  let yOffset = HEADER_HEIGHT;

  const positionedRows = rows.map((row, rowIndex) => {
    // Extra gap above this row (user-draggable; keyed by the first phrase's startBar)
    const firstBar = row[0].startBar;
    const extraGap = rowIndex > 0 ? (rowSpacing[firstBar] || 0) : 0;
    yOffset += extraGap;

    const levelSet = rowLevelSets[rowIndex];
    const topPadding = rowTopPaddingForLevels(levelSet);
    const rowHeight = BASE_ROW_HEIGHT + topPadding + keyLaneExtra;
    const totalBars = row.reduce((sum, p) => sum + p.length, 0);
    const barWidth = USABLE_WIDTH / totalBars;
    const rowY = yOffset;

    // slurY sits within the slur zone (below the section-marker top zone)
    const slurY = rowY + topPadding + Math.round(BASE_ROW_HEIGHT * 0.68);

    yOffset += rowHeight;

    let x = PADDING;
    const positionedPhrases = row.map(phrase => {
      const px = x;
      const width = phrase.length * barWidth;

      // Overlap shifts the visual start left; first phrase overall cannot overlap.
      const overlapBars = phrase.phraseIndex > 0 ? (phraseOverlaps[phrase.startBar] || 0) : 0;
      const overlapPx = overlapBars * barWidth;
      const visualX = px - overlapPx;

      // Sub-phrase positions are relative to visualX so they draw correctly.
      const subPhrasePositions = [];
      if (phrase.subPhrases && phrase.subPhrases.length > 0) {
        const totalSubBars = phrase.subPhrases.reduce((s, l) => s + l, 0);
        let subX = visualX;
        let subBar = phrase.startBar;
        for (let si = 0; si < phrase.subPhrases.length; si++) {
          const subLen = phrase.subPhrases[si];
          const subWidth = (subLen / totalSubBars) * width;
          const range = phrase.subTextRanges?.[si];
          subPhrasePositions.push({
            x: subX,
            width: subWidth,
            length: subLen,
            startBar: subBar,
            textStart: range != null ? phrase.textStart + range.start : phrase.textStart,
            textEnd: range != null ? phrase.textStart + range.end : phrase.textEnd,
          });
          subX += subWidth;
          subBar = Math.round((subBar + subLen) * 1000) / 1000;
        }
      }

      x += width;
      return { ...phrase, x: px, visualX, overlapPx, width, slurY, subPhrasePositions };
    });

    // Key lane band sits below the label zone (labels render at slurY+33)
    const keyLaneY = opts.hasKeyLane ? slurY + 41 : null;

    return { phrases: positionedPhrases, rowY, slurY, keyLaneY, rowIndex, rowEndX: x, rowHeight, levelSet, extraGap };
  });

  return {
    rows: positionedRows,
    totalHeight: yOffset + 48,
    CANVAS_WIDTH,
    HEADER_HEIGHT,
    PADDING,
  };
}

// Find the x position and row for any bar number, interpolating within phrases.
// Phrase starts are checked first so that a bar sitting exactly at a row boundary
// (end of row N = start of row N+1) maps to the new row's left edge, not the
// old row's right edge. This ensures rehearsal marks appear on the following line.
export function barToPosition(bar, rows) {
  // Pass 1: exact phrase starts (highest priority)
  for (const row of rows) {
    for (const p of row.phrases) {
      if (bar === p.startBar) {
        return { x: p.x, slurY: row.slurY, rowIndex: row.rowIndex };
      }
    }
  }
  // Pass 2: interpolate within phrases
  for (const row of rows) {
    for (const p of row.phrases) {
      const endBar = p.startBar + p.length;
      if (bar > p.startBar && bar <= endBar) {
        const frac = (bar - p.startBar) / p.length;
        return { x: p.x + frac * p.width, slurY: row.slurY, rowIndex: row.rowIndex };
      }
    }
  }
  return null;
}

export function formatBar(bar) {
  return Number.isInteger(bar) ? String(bar) : bar.toFixed(1);
}

export function formatLength(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Given an SVG x (and optionally y) coordinate, snap to the nearest phrase boundary bar number.
// When svgY is provided the search is restricted to whichever row the click landed in.
export function xToNearestPhrase(svgX, rows, svgY) {
  let candidateRows = rows;
  if (svgY != null) {
    const hit = rows.find(r => svgY >= r.rowY && svgY < r.rowY + r.rowHeight);
    if (hit) candidateRows = [hit];
  }

  let nearest = null;
  let nearestDist = Infinity;

  for (const row of candidateRows) {
    for (const phrase of row.phrases) {
      const startDist = Math.abs(svgX - phrase.x);
      if (startDist < nearestDist) {
        nearestDist = startDist;
        nearest = phrase.startBar;
      }
      const endX = phrase.x + phrase.width;
      const endDist = Math.abs(svgX - endX);
      if (endDist < nearestDist) {
        nearestDist = endDist;
        nearest = phrase.startBar + phrase.length;
      }
    }
  }

  if (nearest === null) return null;
  // Round to nearest integer or half-bar
  return Math.round(nearest * 2) / 2;
}

// Like barToPosition, but resolves bars that fall exactly at a row boundary
// to the END of the preceding row instead of the start of the next one.
// Used for caesuras and breath marks, which relate to the music before the break.
export function barToPositionEnd(bar, rows) {
  for (let i = 0; i < rows.length - 1; i++) {
    const row = rows[i];
    const last = row.phrases[row.phrases.length - 1];
    const rowEndBar = last.startBar + last.length;
    if (Math.abs(bar - rowEndBar) < 0.001) {
      return { x: row.rowEndX, slurY: row.slurY, rowIndex: row.rowIndex };
    }
  }
  return barToPosition(bar, rows);
}

// Returns { firstBar, lastBar } for the current layout, or null if empty.
export function getBarRange(rows) {
  if (!rows || rows.length === 0) return null;
  const firstBar = rows[0].phrases[0].startBar;
  const lastRow = rows[rows.length - 1];
  const lastPhrase = lastRow.phrases[lastRow.phrases.length - 1];
  const lastBar = lastPhrase.startBar + lastPhrase.length;
  return { firstBar, lastBar };
}

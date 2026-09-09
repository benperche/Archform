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
export function parseQuickEntry(text, firstBar = 1) {
  if (!text.trim()) return { phrases: [], lineBreakIndices: new Set() };

  const lines = text.split('\n');
  const phrases = [];
  const lineBreakIndices = new Set();
  // Bar numbering starts here — set to 0 for a pickup/anacrusis, or to any
  // number when diagramming an excerpt that begins mid-piece.
  let barCounter = Number.isFinite(firstBar) ? firstBar : 1;

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

        const subTotal = parsed.subPhrases.reduce((a, b) => a + b, 0);
        const subMismatch = parsed.subPhrases.length > 0 && Math.abs(subTotal - parsed.length) > 0.001
          ? Math.round((subTotal - parsed.length) * 1000) / 1000
          : null;

        phrases.push({
          id: `p${idx}`,
          startBar: barCounter,
          length: parsed.length,
          subPhrases: parsed.subPhrases,
          subTotal,
          subMismatch,
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

// ── Arch geometry ─────────────────────────────────────────────
// Exported so the collision skyline below is computed from exactly the same
// curve DiagramCanvas draws — if these drift, clearances become fiction.
export const MAIN_MAX_ARCH = 56;

export function mainArchParams(x, width, slurY) {
  const archHeight = Math.max(14, Math.min(width * 0.28, MAIN_MAX_ARCH));
  const x1 = x + 1;
  const x2 = x + width - 1;
  const cpY = slurY - archHeight;
  const cp1x = x1 + (x2 - x1) * 0.22;
  const cp2x = x2 - (x2 - x1) * 0.22;
  return { x1, x2, cpY, archHeight, cp1x, cp2x };
}

// Sub-phrase arches are shallower, but a small sub-phrase inside a wide phrase
// can still rise above the main arch, so the skyline has to account for them.
export function subArchHeight(width) {
  return Math.max(12, Math.min(width * 0.18, 32));
}

// Y on a cubic bezier with control-point y values: slurY, cpY, cpY, slurY
export function bezierY(t, slurY, cpY) {
  const m = 1 - t;
  return m * m * m * slurY + 3 * m * m * t * cpY + 3 * m * t * t * cpY + t * t * t * slurY;
}

function cubic(t, a, c1, c2, b) {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * c1 + 3 * m * t * t * c2 + t * t * t * b;
}

// Height of an arch at a given x, by solving the bezier's x for t. Used to
// keep sub-phrase labels clear of the main arch above them.
export function archYAtX(arch, x, slurY) {
  const { x1, x2, cpY, cp1x, cp2x } = arch;
  if (x <= x1 || x >= x2) return slurY;
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (cubic(mid, x1, cp1x, cp2x, x2) < x) lo = mid; else hi = mid;
  }
  return bezierY((lo + hi) / 2, slurY, cpY);
}

// ── Collision skyline ─────────────────────────────────────────
// Markings above the slur line used to sit at fixed offsets, which collided
// with the arches wherever the curve happened to be high (a theme letter at
// the phrase start always did; a rehearsal mark mid-phrase could by ~10px).
// Instead, track the upper contour of the row and place each marking clear of
// whatever is already there, stacking them. The row then grows to contain the
// result — capped, so one marking can't blow a system up to a whole page.
const SKY_STEP = 4;          // contour resolution in px
const SKY_GAP = 5;           // clearance left between stacked items
const SKY_TOP_MARGIN = 4;
const MAX_EXTRA_TOP = 56;    // most a row may grow upward
const BASE_ABOVE_SLUR = Math.round(BASE_ROW_HEIGHT * 0.68);

// Default heights, used when nothing forces an item higher, so a plain
// diagram looks exactly as it did before.
const MARK_H = 19, MARK_DEFAULT_CENTER = 46;
const FERMATA_H = 14, FERMATA_ABOVE_CENTRE = 9;
const THEME_H = 10, THEME_BASELINE_IN = 8;

function makeSky(x0, x1, baseY) {
  const n = Math.max(1, Math.ceil((x1 - x0) / SKY_STEP) + 1);
  return { x0, n, y: new Array(n).fill(baseY) };
}
const skyIdx = (s, x) => Math.max(0, Math.min(s.n - 1, Math.round((x - s.x0) / SKY_STEP)));

function skyMin(s, xa, xb) {
  let m = Infinity;
  for (let i = skyIdx(s, xa); i <= skyIdx(s, xb); i++) if (s.y[i] < m) m = s.y[i];
  return m;
}
function skyReserve(s, xa, xb, y) {
  for (let i = skyIdx(s, xa); i <= skyIdx(s, xb); i++) if (y < s.y[i]) s.y[i] = y;
}
function skyArch(s, x1, x2, slurY, cpY) {
  const c1 = x1 + (x2 - x1) * 0.22, c2 = x2 - (x2 - x1) * 0.22;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const px = cubic(t, x1, c1, c2, x2);
    skyReserve(s, px - SKY_STEP, px + SKY_STEP, bezierY(t, slurY, cpY));
  }
}
// Reserve space for an item of the given size centred on cx; returns its top y.
function skyPlace(s, cx, halfW, height) {
  const top = skyMin(s, cx - halfW, cx + halfW) - SKY_GAP - height;
  skyReserve(s, cx - halfW, cx + halfW, top);
  return top;
}

// Place theme letters, fermatas and rehearsal marks above a row's arches.
function placeAboveSlur({ positionedPhrases, slurY, rowEndX, barWidth, marks, fermatas, themes }) {
  const sky = makeSky(PADDING - 24, rowEndX + 24, slurY);
  for (const p of positionedPhrases) {
    const a = mainArchParams(p.visualX, p.width, slurY);
    skyArch(sky, a.x1, a.x2, slurY, a.cpY);
    for (const sp of p.subPhrasePositions || []) {
      skyArch(sky, sp.x, sp.x + sp.width, slurY, slurY - subArchHeight(sp.width));
    }
  }

  const first = positionedPhrases[0];
  const last = positionedPhrases[positionedPhrases.length - 1];
  const rowStartBar = first.startBar;
  const rowEndBar = last.startBar + last.length;
  const inRow = bar => bar >= rowStartBar - 0.001 && bar <= rowEndBar + 0.001;
  const barToX = bar => {
    for (const p of positionedPhrases) {
      if (bar >= p.startBar - 0.001 && bar <= p.startBar + p.length + 0.001) {
        return p.x + (bar - p.startBar) * barWidth;
      }
    }
    return null;
  };

  // 1. Theme letters sit closest to the line, at the foot of their arch.
  const themeBaselineY = {};
  for (const p of positionedPhrases) {
    if (!themes[p.startBar]) continue;
    const a = mainArchParams(p.visualX, p.width, slurY);
    themeBaselineY[p.startBar] = skyPlace(sky, a.x1 + 8, 6, THEME_H) + THEME_BASELINE_IN;
  }

  // 2. Fermatas and breaks sit above those.
  const fermataCenterY = {};
  for (const fm of fermatas) {
    if (!inRow(fm.bar)) continue;
    const fx = barToX(fm.bar);
    if (fx == null) continue;
    fermataCenterY[fm.id] = skyPlace(sky, fx, 10, FERMATA_H) + FERMATA_ABOVE_CENTRE;
  }

  // 3. Rehearsal marks go highest, and share one height across the row so they
  //    stay aligned with each other the way they would be in a printed score.
  let markTop = slurY - MARK_DEFAULT_CENTER - MARK_H / 2;
  const rowMarks = marks.filter(m => inRow(m.bar) && barToX(m.bar) != null);
  for (const m of rowMarks) {
    const w = Math.max(20, String(m.label || '').length * 8 + 10);
    const top = skyMin(sky, barToX(m.bar) - w / 2, barToX(m.bar) + w / 2) - SKY_GAP - MARK_H;
    if (top < markTop) markTop = top;
  }
  for (const m of rowMarks) {
    const w = Math.max(20, String(m.label || '').length * 8 + 10);
    skyReserve(sky, barToX(m.bar) - w / 2, barToX(m.bar) + w / 2, markTop);
  }

  let topmost = slurY - MAIN_MAX_ARCH;
  for (let i = 0; i < sky.n; i++) if (sky.y[i] < topmost) topmost = sky.y[i];

  return { themeBaselineY, fermataCenterY, markCenterY: markTop + MARK_H / 2, topmost };
}

// Key lane: slim band under each row showing key regions, only present
// when the diagram has key changes.
const KEY_LANE_HEIGHT = 16;
const KEY_LANE_GAP = 8;
// Hairpin (crescendo/diminuendo) lane, stacked above the key lane
const HAIRPIN_HEIGHT = 12;
const HAIRPIN_GAP = 8;

export function computeLayout(phrases, lineBreakIndices, structuralMarkers = [], phraseOverlaps = {}, rowSpacing = {}, opts = {}) {
  if (!phrases.length) {
    return { rows: [], totalHeight: HEADER_HEIGHT + 176, CANVAS_WIDTH, HEADER_HEIGHT, PADDING };
  }
  const hairpinExtra = opts.hasHairpins ? HAIRPIN_GAP + HAIRPIN_HEIGHT : 0;
  const keyLaneExtra = opts.hasKeyLane ? KEY_LANE_GAP + KEY_LANE_HEIGHT : 0;
  const laneExtra = hairpinExtra + keyLaneExtra;

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
    const totalBars = row.reduce((sum, p) => sum + p.length, 0);
    const barWidth = USABLE_WIDTH / totalBars;
    const rowY = yOffset;

    // Provisional slur line; may be pushed down below if markings above the
    // line need more headroom than the base row provides.
    const slurY0 = rowY + topPadding + BASE_ABOVE_SLUR;

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
        let subX = visualX;
        let subBar = phrase.startBar;
        for (let si = 0; si < phrase.subPhrases.length; si++) {
          const subLen = phrase.subPhrases[si];
          // True scale: a sub-phrase of n bars is n * barWidth wide. Previously
          // these were normalised to fill the parent, which silently hid
          // mismatches like 8(4+3) by stretching them to look correct.
          const subWidth = subLen * barWidth;
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
      return { ...phrase, x: px, visualX, overlapPx, width, slurY: slurY0, subPhrasePositions };
    });

    // Place everything that sits above the slur line against the arches, then
    // grow the row if they needed more headroom than the base row allows.
    const above = placeAboveSlur({
      positionedPhrases, slurY: slurY0, rowEndX: x, barWidth,
      marks: opts.rehearsalMarks || [],
      fermatas: opts.fermatas || [],
      themes: opts.phraseThemes || {},
    });
    const needed = slurY0 - above.topmost + SKY_TOP_MARGIN;
    const extraTop = Math.min(MAX_EXTRA_TOP, Math.max(0, Math.round(needed - BASE_ABOVE_SLUR)));

    const slurY = slurY0 + extraTop;
    const rowHeight = BASE_ROW_HEIGHT + topPadding + laneExtra + extraTop;
    yOffset += rowHeight;

    const shifted = positionedPhrases.map(p => ({ ...p, slurY }));
    const shift = obj => Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, v + extraTop])
    );

    // Lanes stack below the label zone (labels render at slurY+33):
    // hairpins first, then the key lane.
    let laneCursor = slurY + 41;
    const hairpinY = opts.hasHairpins ? laneCursor : null;
    if (opts.hasHairpins) laneCursor += HAIRPIN_HEIGHT + HAIRPIN_GAP;
    const keyLaneY = opts.hasKeyLane ? laneCursor : null;

    return {
      phrases: shifted, rowY, slurY, hairpinY, keyLaneY, rowIndex,
      rowEndX: x, rowHeight, levelSet, extraGap, extraTop,
      themeBaselineY: shift(above.themeBaselineY),
      fermataCenterY: shift(above.fermataCenterY),
      markCenterY: above.markCenterY + extraTop,
    };
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

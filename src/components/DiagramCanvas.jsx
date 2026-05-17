import { useMemo, useState, useEffect, useCallback } from 'react';

// ── SVG note glyph system ─────────────────────────────────────
// Parses text with note shorthand codes and renders inline SVG glyphs.
// Codes: w h q e s ee ss sss ssss  +  triplets: th tq te ts
// Word-boundary delimited so "see" ≠ s+e, "the" ≠ th+e, etc.

const NH_RX = 3.5, NH_RY = 2.2;      // note head semi-axes
const OX = NH_RX;                      // head centre x  (left edge at x=0)
const OY = -(NH_RY + 0.5);            // head centre y  (bottom ≈ text baseline)
const STX = OX + NH_RX * 0.8;         // stem x
const ST_TOP = OY - 10;               // stem top y
const SP = 7.5;                        // note spacing in beamed groups
const BM_H = 1.8, BM_GAP = 2.2;      // beam height / gap between parallel beams
const FL_DX = 4.5, FL_DY = 5;        // flag x-extent and y-extent

const TRIP_W = SP * 2 + STX + 2;     // width of any 3-note triplet group

const NOTE_GW = {
  w: OX * 2 + 2, h: STX + 2, q: STX + 2,
  e: STX + FL_DX + 1, s: STX + FL_DX + 1,
  ee: SP + STX - 3, ss: SP + STX - 3,
  sss: SP * 2 + STX - 3, ssss: SP * 3 + STX - 3,
  th: TRIP_W, tq: TRIP_W, te: TRIP_W, ts: TRIP_W,
};

function NoteGlyph({ type, fill: f = '#1a1a1a' }) {
  const hd = (dx = 0, filled = true) => filled
    ? <ellipse cx={OX + dx} cy={OY} rx={NH_RX} ry={NH_RY} fill={f} />
    : <ellipse cx={OX + dx} cy={OY} rx={NH_RX} ry={NH_RY} fill="white" stroke={f} strokeWidth={0.9} />;
  const st = (dx = 0) =>
    <line x1={STX + dx} y1={OY} x2={STX + dx} y2={ST_TOP} stroke={f} strokeWidth={1.1} />;
  const fl = (yOff = 0) => {
    const x0 = STX, y0 = ST_TOP + yOff;
    return <path d={`M ${x0} ${y0} C ${x0 + FL_DX} ${y0 + FL_DY * 0.3} ${x0 + FL_DX} ${y0 + FL_DY * 0.7} ${x0 + 0.5} ${y0 + FL_DY * 1.4}`} fill="none" stroke={f} strokeWidth={1.1} strokeLinecap="round" />;
  };
  const bm = (n, yOff = 0) =>
    <rect x={STX} y={ST_TOP + yOff} width={SP * (n - 1)} height={BM_H} fill={f} />;

  // Triplet bracket: below the noteheads, ticks pointing up toward the notes,
  // spanning from the outer edges of the first and last noteheads.
  const trip3 = () => {
    const lx = OX - NH_RX - 0.5;           // left edge of first notehead
    const rx = OX + NH_RX + SP * 2 + 0.5;  // right edge of last notehead
    const cx = (lx + rx) / 2;
    const by = OY + NH_RY + 4;             // below notehead bottom with a small gap
    const ty = by + 5;                      // "3" numeral below the bracket
    const tick = 3;                         // tick length, pointing up (by - tick)
    const gap = 2.5;                        // half-gap around the numeral
    return (
      <g>
        <line x1={lx}       y1={by} x2={cx - gap} y2={by} stroke={f} strokeWidth={0.7} />
        <line x1={lx}       y1={by} x2={lx}       y2={by - tick} stroke={f} strokeWidth={0.7} />
        <line x1={rx}       y1={by} x2={cx + gap} y2={by} stroke={f} strokeWidth={0.7} />
        <line x1={rx}       y1={by} x2={rx}       y2={by - tick} stroke={f} strokeWidth={0.7} />
        <text x={cx} y={ty} fontSize={5} textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif" fill={f}>3</text>
      </g>
    );
  };

  switch (type) {
    case 'w':    return <g>{hd(0, false)}</g>;
    case 'h':    return <g>{hd(0, false)}{st()}</g>;
    case 'q':    return <g>{hd()}{st()}</g>;
    case 'e':    return <g>{hd()}{st()}{fl()}</g>;
    case 's':    return <g>{hd()}{st()}{fl()}{fl(BM_H + BM_GAP)}</g>;
    case 'ee':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{bm(2)}</g>;
    case 'ss':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{bm(2)}{bm(2, BM_H + BM_GAP)}</g>;
    case 'sss':  return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP * 2)}{st(SP * 2)}{bm(3)}{bm(3, BM_H + BM_GAP)}</g>;
    case 'ssss': return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP * 2)}{st(SP * 2)}{hd(SP * 3)}{st(SP * 3)}{bm(4)}{bm(4, BM_H + BM_GAP)}</g>;
    // Triplets: 3 notes + "3" bracket
    case 'th':   return <g>{hd(0,false)}{st()}{hd(SP,false)}{st(SP)}{hd(SP*2,false)}{st(SP*2)}{trip3()}</g>;
    case 'tq':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP*2)}{st(SP*2)}{trip3()}</g>;
    case 'te':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP*2)}{st(SP*2)}{bm(3)}{trip3()}</g>;
    case 'ts':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP*2)}{st(SP*2)}{bm(3)}{bm(3,BM_H+BM_GAP)}{trip3()}</g>;
    default: return null;
  }
}

const NOTE_CODES = /\b(ssss|sss|ss|ee|ts|te|tq|th|w|h|q|e|s)\b/g;
function parseNoteText(text) {
  const tokens = [];
  let last = 0;
  NOTE_CODES.lastIndex = 0;
  let m;
  while ((m = NOTE_CODES.exec(text)) !== null) {
    if (m.index > last) tokens.push({ kind: 'text', val: text.slice(last, m.index) });
    tokens.push({ kind: 'note', val: m[1] });
    last = m.index + m[1].length;
  }
  if (last < text.length) tokens.push({ kind: 'text', val: text.slice(last) });
  return tokens;
}

function estTextW(str, fontSize) {
  return str.length * fontSize * 0.52;
}

function NoteText({ text, x, y, fontSize, fill, fontStyle, fontWeight, textAnchor = 'start' }) {
  if (!text) return null;
  const tokens = parseNoteText(text);
  const sc = fontSize / 11;
  const widths = tokens.map(tok =>
    tok.kind === 'text' ? estTextW(tok.val, fontSize) : (NOTE_GW[tok.val] ?? 0) * sc
  );
  const totalW = widths.reduce((a, b) => a + b, 0);
  let startX = textAnchor === 'middle' ? x - totalW / 2
             : textAnchor === 'end'   ? x - totalW : x;
  const positions = [];
  let cur = startX;
  for (const w of widths) { positions.push(cur); cur += w; }

  return (
    <g>
      {tokens.map((tok, i) => {
        const px = positions[i];
        if (tok.kind === 'text') {
          return (
            <text key={i} x={px} y={y} fontSize={fontSize}
              fontFamily="Georgia, 'Times New Roman', serif"
              fontStyle={fontStyle} fontWeight={fontWeight} fill={fill}>{tok.val}</text>
          );
        }
        return (
          <g key={i} transform={`translate(${px}, ${y}) scale(${sc})`}>
            <NoteGlyph type={tok.val} fill={fill} />
          </g>
        );
      })}
    </g>
  );
}
import { barToPosition, formatBar, formatLength, xToNearestPhrase, CANVAS_WIDTH, PADDING } from '../utils/layout';

// Y on a cubic bezier with control-point y values: slurY, cpY, cpY, slurY
function bezierY(t, slurY, cpY) {
  const mt = 1 - t;
  return mt*mt*mt*slurY + 3*mt*mt*t*cpY + 3*mt*t*t*cpY + t*t*t*slurY;
}

// Main slur arch parameters (shared between Slur and sub-phrase rendering)
const MAIN_MAX_ARCH = 56;
function mainArchParams(x, width, slurY) {
  const archHeight = Math.max(14, Math.min(width * 0.28, MAIN_MAX_ARCH));
  const x1 = x + 1;
  const x2 = x + width - 1;
  const cpY = slurY - archHeight;
  const cp1x = x1 + (x2 - x1) * 0.22;
  const cp2x = x2 - (x2 - x1) * 0.22;
  return { x1, x2, cpY, archHeight, cp1x, cp2x };
}

// A main phrase slur with center length label, ticks, and start bar number.
// visualX: left edge of the arch (shifted left when there is an overlap).
// x: nominal bar position (used for bar labels and rehearsal mark placement).
function Slur({ x, visualX, width, slurY, startBar, length, isLastInRow, endBar, overlapPx, selected, editMode, hasMarkAtBar, hideBarNum, hideStartTick, hideEndTick, onClick, onStartClick }) {
  const hasOverlap = overlapPx > 0;
  const { x1, x2, cpY, cp1x, cp2x } = mainArchParams(visualX, width, slurY);
  const d = `M ${x1} ${slurY} C ${cp1x} ${cpY} ${cp2x} ${cpY} ${x2} ${slurY}`;
  const mid = { x: (x1 + x2) / 2, y: bezierY(0.5, slurY, cpY) };

  // Nominal start x (for bar number, rehearsal mark, elision dot)
  const nx = x + 1;

  const inMarkMode = editMode === 'rehearsalMarks';
  const stroke = selected ? '#2563eb' : '#1a1a1a';

  // Width of the bar number string in px (approx, for hit rect sizing)
  const bnStr = formatBar(startBar);
  const bnW = Math.max(18, bnStr.length * 6);

  return (
    <g>
      {/* Full bounding-box hit area — covers the entire arch rectangle */}
      <rect
        x={x1 - 4} y={cpY - 8}
        width={(x2 - x1) + 8} height={(slurY - cpY) + 20}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onClick={onClick}
      />

      {/* Slur arc */}
      <path d={d} fill="none" stroke={stroke} strokeWidth={selected ? 2 : 1.5} strokeLinecap="round" />

      {/* Start tick (at visual start) — hidden when a repeat barline sits here */}
      {!hideStartTick && (
        <line x1={x1} y1={slurY - 6} x2={x1} y2={slurY + 3} stroke={stroke} strokeWidth={1.2} />
      )}
      {/* End tick — hidden when a repeat barline sits here */}
      {!hideEndTick && (
        <line x1={x2} y1={slurY - 6} x2={x2} y2={slurY + 3} stroke={stroke} strokeWidth={1.2} />
      )}

      {/* Elision dot at nominal bar position when phrase overlaps previous */}
      {hasOverlap && (
        <circle cx={nx} cy={slurY} r={3.5} fill={stroke} style={{ pointerEvents: 'none' }} />
      )}

      {/* Center phrase length */}
      <text
        x={mid.x}
        y={mid.y - 10}
        textAnchor="middle"
        fontSize={19}
        fontFamily="Georgia, 'Times New Roman', serif"
        fill={selected ? '#2563eb' : '#1a1a1a'}
      >
        {formatLength(length)}
      </text>

      {/* Start bar number — at nominal position (suppressed when a time sig is here) */}
      {!hideBarNum && (<>
        {/* Hit rect around bar number */}
        <rect
          x={nx - bnW / 2 - 5} y={slurY + 9}
          width={bnW + 10} height={14}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={onClick}
        />
        <text
          x={nx}
          y={slurY + 17}
          textAnchor="middle"
          fontSize={9.5}
          fontFamily="Georgia, 'Times New Roman', serif"
          fill={selected ? '#2563eb' : '#999'}
        >
          {bnStr}
        </text>
      </>)}

      {/* End bar number at the right tick of the last phrase in a row */}
      {isLastInRow && (
        <text
          x={x2}
          y={slurY + 17}
          textAnchor="middle"
          fontSize={9.5}
          fontFamily="Georgia, 'Times New Roman', serif"
          fill="#ccc"
        >
          {formatBar(endBar)}
        </text>
      )}

      {/* Rehearsal mark click target — at nominal position */}
      {inMarkMode && (
        <circle
          cx={nx}
          cy={slurY}
          r={9}
          fill={hasMarkAtBar ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.07)'}
          stroke="#2563eb"
          strokeWidth={1.2}
          strokeDasharray={hasMarkAtBar ? 'none' : '3,2'}
          style={{ cursor: 'crosshair' }}
          onClick={e => { e.stopPropagation(); onStartClick(); }}
        />
      )}
    </g>
  );
}

// A sub-phrase slur: endpoints land on the shared baseline, dashed stroke.
// showPlus: draw a "+" at the left junction (i.e. this is not the first sub-phrase).
function SubSlur({ x1, y1, x2, y2, length, showPlus, onClick }) {
  const dx = x2 - x1;
  const subArchH = Math.max(12, Math.min(dx * 0.18, 32));
  const cpY_sub = Math.min(y1, y2) - subArchH;
  const cp1x = x1 + dx * 0.22;
  const cp2x = x2 - dx * 0.22;
  const d = `M ${x1} ${y1} C ${cp1x} ${cpY_sub} ${cp2x} ${cpY_sub} ${x2} ${y2}`;

  const midX = (x1 + x2) / 2;
  // Place label inside the arch, ~15px below the peak (matching main slur clearance)
  const peakY = 0.25 * Math.max(y1, y2) + 0.75 * cpY_sub;
  const labelY = Math.min(peakY + 22, Math.max(y1, y2) - 2);

  return (
    <g>
      {/* Invisible wide hit area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer' }} onClick={onClick} />
      <path
        d={d}
        fill="none"
        stroke="#1a1a1a"
        strokeWidth={1.2}
        strokeDasharray="10,5"
        strokeLinecap="butt"
      />
      {/* "+" at the left junction when this sub-phrase follows another */}
      {showPlus && (
        <text
          x={x1}
          y={y1 + 8}
          textAnchor="middle"
          fontSize={11}
          fontFamily="Georgia, 'Times New Roman', serif"
          fill="#555"
        >
          +
        </text>
      )}
      {/* Sub-phrase length label inside the arch */}
      <text
        x={midX}
        y={labelY}
        textAnchor="middle"
        fontSize={13}
        fontFamily="Georgia, 'Times New Roman', serif"
        fill="#555"
      >
        {formatLength(length)}
      </text>
    </g>
  );
}

// Boxed rehearsal mark — y is the vertical centre of the box
function RehearsalMark({ x, y, label, markStyle, onClick }) {
  const isBarNum = markStyle === 'bars';
  const fs = isBarNum ? 13 : 12;
  const pad = 5;
  const w = Math.max(20, label.length * (fs * 0.65) + pad * 2);
  const h = 19;
  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick}>
      <rect
        x={x - w / 2} y={y - h / 2}
        width={w} height={h}
        fill="white" stroke="#1a1a1a" strokeWidth={1.2} rx={1.5}
      />
      <text
        x={x} y={y}
        textAnchor="middle"
        dy="0.35em"
        fontSize={fs}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="bold"
        fill="#1a1a1a"
      >
        {label}
      </text>
    </g>
  );
}

// Structural section marker with optional open end.
// levelRank: 0 = innermost (closest to slur), higher = further away.
// isBroad: true when the absolute level value is 0 (bold/thick styling).
function SectionMarker({ x1, x2, y, label, level, levelRank, isOpen, color, isActive, onClick }) {
  const isBroad = level === 0;
  const levelOffset = levelRank * 26;
  const lineY = y - (MAIN_MAX_ARCH + 14) - levelOffset;
  const labelX = isOpen ? x1 + 6 : (x1 + x2) / 2;
  const labelAnchor = isOpen ? 'start' : 'middle';
  const sw = isBroad ? 1.5 : 0.9;
  const col = isActive ? '#2563eb' : (color || '#1a1a1a');

  return (
    <g style={onClick ? { cursor: 'pointer' } : undefined} onClick={onClick}>
      {/* Wide transparent hit area along the bracket line */}
      {onClick && (
        <rect
          x={x1 - 4} y={lineY - 10}
          width={isOpen ? 94 : Math.max((x2 - x1) + 8, 20)}
          height={22}
          fill="transparent"
        />
      )}
      <line x1={x1} y1={lineY} x2={isOpen ? x1 + 30 : x2} y2={lineY} stroke={col} strokeWidth={sw} />
      {isOpen && (
        <line x1={x1 + 30} y1={lineY} x2={x1 + 90} y2={lineY}
          stroke={col} strokeWidth={sw} strokeDasharray="3,4" />
      )}
      <line x1={x1} y1={lineY} x2={x1} y2={y} stroke={col} strokeWidth={sw} />
      {!isOpen && (
        <line x1={x2} y1={lineY} x2={x2} y2={y} stroke={col} strokeWidth={sw} />
      )}
      <NoteText
        text={label}
        x={labelX} y={lineY - 4}
        fontSize={isBroad ? 11 : 10} fill={col} fontStyle="italic"
        fontWeight={isBroad ? 'bold' : undefined}
        textAnchor={labelAnchor}
      />
    </g>
  );
}

// Stacked time-signature numerals rendered on the phrase baseline.
// atBoundary: true when positioned exactly at a phrase-start tick — a white rect
// is drawn first to cover the overlapping tick marks at that junction.
function TimeSig({ x, slurY, numerator, denominator, atBoundary }) {
  const fs = 14;
  const capH = Math.round(fs * 0.72); // ~10px — cap height of Georgia digits
  const numStr = String(numerator);
  const denStr = String(denominator);
  const w = Math.max(numStr.length, denStr.length) * fs * 0.62 + 10;
  // Numerator sits above slurY (baseline = slurY, digits span slurY-capH to slurY)
  // Denominator sits below (baseline = slurY+capH, digits span slurY to slurY+capH)
  // → zero gap, centred on the phrase line
  return (
    <g>
      {atBoundary && (
        <rect x={x - w / 2} y={slurY - 7} width={w} height={10} fill="white" />
      )}
      <text x={x} y={slurY} textAnchor="middle" fontSize={fs}
        fontFamily="Georgia, 'Times New Roman', serif" fontWeight="bold" fill="#1a1a1a">
        {numStr}
      </text>
      <text x={x} y={slurY + capH} textAnchor="middle" fontSize={fs}
        fontFamily="Georgia, 'Times New Roman', serif" fontWeight="bold" fill="#1a1a1a">
        {denStr}
      </text>
    </g>
  );
}

export default function DiagramCanvas({
  layout,
  title,
  composer,
  structuralMarkers,
  timeSignatures = [],
  rehearsalMarks,
  rehearsalMarkStyle,
  labels = [],
  repeats = [],
  fermatas = [],
  selectedPhraseIndex,
  editMode,
  barPickMode,
  rowSpacing = {},
  onRowSpacingChange,
  svgRef,
  onSelectPhrase,
  onSubPhraseClick,
  onSlurStartClick,
  onRemoveRehearsalMark,
  onBarPick,
  activeLabelId,
  activeSectionId,
  onLabelClick,
  onSectionClick,
}) {
  const { rows, totalHeight, HEADER_HEIGHT } = layout;
  const W = CANVAS_WIDTH;

  // ── Row spacing drag ─────────────────────────────────────────
  const [dragging, setDragging] = useState(null);
  // dragging = { firstBar, startClientY, startExtra }

  const startSpacingDrag = useCallback((e, firstBar, currentExtra) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging({ firstBar, startClientY: e.clientY, startExtra: currentExtra });
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = e => {
      const dy = e.clientY - dragging.startClientY;
      const rect = svgRef.current?.getBoundingClientRect();
      const scale = rect ? rect.width / CANVAS_WIDTH : 1;
      const newExtra = Math.max(0, Math.min(300, dragging.startExtra + dy / scale));
      onRowSpacingChange?.(dragging.firstBar, newExtra);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, onRowSpacingChange, svgRef]);

  const marksByBar = useMemo(() => {
    const m = new Map();
    rehearsalMarks.forEach(rm => m.set(rm.bar, rm));
    return m;
  }, [rehearsalMarks]);

  // Set of bars that have a time signature — used to suppress bar number labels
  const timeSigBarSet = useMemo(() => new Set(timeSignatures.map(ts => ts.bar)), [timeSignatures]);

  // Set of bars that have a repeat/barline — used to suppress slur end ticks
  const repeatBarSet = useMemo(() => new Set(repeats.map(r => r.bar)), [repeats]);

  // Set of all phrase start bars — used to determine boundary vs mid-phrase placement
  const boundaryBars = useMemo(() => {
    const s = new Set();
    rows.forEach(row => row.phrases.forEach(p => s.add(p.startBar)));
    return s;
  }, [rows]);

  const getBarPos = bar => barToPosition(bar, rows);

  const handleSvgClick = (e) => {
    if (!barPickMode || !onBarPick) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / W;
    const svgX = (e.clientX - rect.left) / scale;
    const svgY = (e.clientY - rect.top) / scale;
    const bar = xToNearestPhrase(svgX, rows, svgY);
    if (bar !== null) onBarPick(bar);
  };

  return (
    <div className={`canvas-container${barPickMode ? ' canvas-bar-pick' : ''}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${totalHeight}`}
        onClick={handleSvgClick}
        style={barPickMode ? { cursor: 'crosshair' } : undefined}
      >

        <rect width={W} height={totalHeight} fill="white" />

        {/* Title — centred */}
        <text
          x={W / 2} y={HEADER_HEIGHT * 0.72}
          textAnchor="middle"
          fontSize={26}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontWeight="bold"
          fill="#1a1a1a"
          letterSpacing={0.5}
        >
          {title || 'Untitled'}
        </text>

        {/* Composer — top right */}
        <text
          x={W - PADDING} y={HEADER_HEIGHT * 0.72}
          textAnchor="end"
          fontSize={15}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontStyle="italic"
          fill="#555"
        >
          {composer}
        </text>

        {/* Section markers (behind phrases) */}
        {structuralMarkers.map(marker => {
          const startPos = getBarPos(marker.startBar);
          if (!startPos) return null;
          const endPos = marker.endBar != null ? getBarPos(marker.endBar) : null;

          // Compute rank of this marker's level within the levels present on its row
          const startRow = rows[startPos.rowIndex];
          const levelSet = startRow?.levelSet ?? new Set();
          const sortedLevels = [...levelSet].sort((a, b) => a - b);
          const markerLevel = marker.level ?? 0;
          const levelIdx = sortedLevels.indexOf(markerLevel);
          const levelRank = levelSet.size - 1 - (levelIdx >= 0 ? levelIdx : 0);

          const sectionIsActive = marker.id === activeSectionId;
          const sectionClickHandler = (!barPickMode && !editMode && onSectionClick)
            ? (e) => { e.stopPropagation(); onSectionClick(marker.id); }
            : undefined;

          // No end bar, or same row as start: standard rendering
          if (!endPos || endPos.rowIndex === startPos.rowIndex) {
            return (
              <SectionMarker
                key={marker.id}
                x1={startPos.x}
                x2={endPos ? endPos.x : null}
                y={startPos.slurY}
                label={marker.label}
                level={markerLevel}
                levelRank={levelRank}
                isOpen={!endPos}
                color={marker.color}
                isActive={sectionIsActive}
                onClick={sectionClickHandler}
              />
            );
          }

          // Marker crosses a row boundary — check if it ends exactly at the row edge
          const lastPhrase = startRow.phrases[startRow.phrases.length - 1];
          const rowEndBar = lastPhrase.startBar + lastPhrase.length;
          const endsAtRowEdge = Math.abs(marker.endBar - rowEndBar) < 0.001;

          return (
            <SectionMarker
              key={marker.id}
              x1={startPos.x}
              x2={endsAtRowEdge ? startRow.rowEndX : null}
              y={startPos.slurY}
              label={marker.label}
              level={markerLevel}
              levelRank={levelRank}
              isOpen={!endsAtRowEdge}
              color={marker.color}
              isActive={sectionIsActive}
              onClick={sectionClickHandler}
            />
          );
        })}

        {/* Phrase slurs + sub-phrase slurs */}
        {rows.flatMap(row =>
          row.phrases.map((phrase, i) => {
            const isLast = i === row.phrases.length - 1;
            const endBar = phrase.startBar + phrase.length;
            const hasMarkHere = marksByBar.has(phrase.startBar);
            return (
              <g key={phrase.id}>
                <Slur
                  x={phrase.x}
                  visualX={phrase.visualX}
                  overlapPx={phrase.overlapPx}
                  width={phrase.width}
                  slurY={phrase.slurY}
                  startBar={phrase.startBar}
                  length={phrase.length}
                  endBar={endBar}
                  isLastInRow={isLast}
                  selected={phrase.phraseIndex === selectedPhraseIndex}
                  editMode={editMode}
                  hasMarkAtBar={hasMarkHere}
                  hideBarNum={timeSigBarSet.has(phrase.startBar)}
                  hideStartTick={repeatBarSet.has(phrase.startBar)}
                  hideEndTick={repeatBarSet.has(endBar)}
                  onClick={() => onSelectPhrase(phrase.phraseIndex === selectedPhraseIndex ? null : phrase.phraseIndex)}
                  onStartClick={() => onSlurStartClick(phrase.startBar)}
                />
                {/* Sub-phrase slurs — all endpoints on the shared baseline */}
                {phrase.subPhrasePositions.map((sp, si) => (
                  <SubSlur
                    key={si}
                    x1={sp.x} y1={phrase.slurY}
                    x2={sp.x + sp.width} y2={phrase.slurY}
                    length={sp.length}
                    showPlus={si > 0}
                    onClick={() => onSubPhraseClick(
                      phrase.phraseIndex,
                      sp.textStart,
                      sp.textEnd,
                      phrase.phraseIndex === selectedPhraseIndex,
                    )}
                  />
                ))}
              </g>
            );
          })
        )}

        {/* Rehearsal marks */}
        {rehearsalMarks.map(mark => {
          const pos = getBarPos(mark.bar);
          if (!pos) return null;
          return (
            <RehearsalMark
              key={mark.id}
              x={pos.x}
              y={pos.slurY - 46}
              label={mark.label}
              markStyle={rehearsalMarkStyle}
              onClick={() => onRemoveRehearsalMark(mark.id)}
            />
          );
        })}

        {/* Labels — italic text below each row's bar-number zone */}
        {labels.map(lbl => {
          const pos = getBarPos(lbl.bar);
          if (!pos) return null;
          const isActive = lbl.id === activeLabelId;
          const clickable = !barPickMode && !editMode && !!onLabelClick;
          const estW = Math.max(50, lbl.text.length * 6.5);
          return (
            <g
              key={lbl.id}
              style={clickable ? { cursor: 'pointer' } : undefined}
              onClick={clickable ? (e) => { e.stopPropagation(); onLabelClick(lbl.id); } : undefined}
            >
              <rect x={pos.x - 3} y={pos.slurY + 33 - 12} width={estW + 6} height={18} fill="transparent" />
              <NoteText
                text={lbl.text}
                x={pos.x} y={pos.slurY + 33}
                fontSize={11} fill={isActive ? '#2563eb' : '#555'} fontStyle="italic"
              />
            </g>
          );
        })}

        {/* Time signatures — rendered on top so white rects cover tick marks at boundaries */}
        {timeSignatures.map(ts => {
          const pos = getBarPos(ts.bar);
          if (!pos) return null;
          return (
            <TimeSig
              key={ts.id}
              x={pos.x}
              slurY={pos.slurY}
              numerator={ts.numerator}
              denominator={ts.denominator}
              atBoundary={boundaryBars.has(ts.bar)}
            />
          );
        })}

        {/* Repeat barlines & final barlines */}
        {repeats.map(rp => {
          const pos = getBarPos(rp.bar);
          if (!pos) return null;
          const x = pos.x;
          const top = pos.slurY - 28;
          const bot = pos.slurY + 10;
          const h = bot - top;
          const f = '#1a1a1a';
          // Gap between line centres: thick line is 3.5px wide (half = 1.75),
          // thin is 1px (half = 0.5). To get ~1.5px visible gap: 1.75 + 1.5 + 0.5 = 3.75 → use 4px.
          const sep = 4;
          if (rp.type === 'start') {
            // ||:  →  thick | thin  ··  (thick on the outside/left)
            return (
              <g key={rp.id}>
                <line x1={x}       y1={top} x2={x}       y2={bot} stroke={f} strokeWidth={3.5} />
                <line x1={x + sep} y1={top} x2={x + sep} y2={bot} stroke={f} strokeWidth={1} />
                <circle cx={x + sep + 5.5} cy={top + h * 0.35} r={1.8} fill={f} />
                <circle cx={x + sep + 5.5} cy={top + h * 0.65} r={1.8} fill={f} />
              </g>
            );
          }
          if (rp.type === 'end') {
            // :||  →  ··  thin | thick  (thick on the outside/right)
            return (
              <g key={rp.id}>
                <circle cx={x - sep - 5.5} cy={top + h * 0.35} r={1.8} fill={f} />
                <circle cx={x - sep - 5.5} cy={top + h * 0.65} r={1.8} fill={f} />
                <line x1={x - sep} y1={top} x2={x - sep} y2={bot} stroke={f} strokeWidth={1} />
                <line x1={x}       y1={top} x2={x}       y2={bot} stroke={f} strokeWidth={3.5} />
              </g>
            );
          }
          // final barline: thin | thick (thick on the outside/right)
          return (
            <g key={rp.id}>
              <line x1={x - sep / 2} y1={top} x2={x - sep / 2} y2={bot} stroke={f} strokeWidth={1} />
              <line x1={x + sep / 2} y1={top} x2={x + sep / 2} y2={bot} stroke={f} strokeWidth={3.5} />
            </g>
          );
        })}

        {/* Fermatas — pause symbol above the slur arc */}
        {fermatas.map(fm => {
          const pos = getBarPos(fm.bar);
          if (!pos) return null;
          const cx = pos.x;
          const cy = pos.slurY - 36;  // baseline of the fermata (dot sits here)
          const r = 7;
          const f = '#1a1a1a';
          return (
            <g key={fm.id}>
              {/* Dome arc: sweep=0 (CCW) goes upward from left to right endpoint */}
              <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`}
                stroke={f} strokeWidth={1.2} fill="none"
              />
              {/* Dot centred on the baseline — level with the arc endpoints */}
              <circle cx={cx} cy={cy} r={1.8} fill={f} />
            </g>
          );
        })}

        {/* Row spacing drag handles — live in the left PADDING zone (x 0..PADDING) */}
        {rows.slice(1).map(row => {
          const firstBar = row.phrases[0].startBar;
          // data-no-export marks elements stripped before SVG/PNG export
          const extra = row.extraGap || 0;
          // Handle sits at the top of the gap (= natural bottom of previous row)
          const gripY = row.rowY - extra;
          const active = dragging?.firstBar === firstBar;
          return (
            <g
              key={`spacing-${firstBar}`}
              data-no-export="1"
              style={{ cursor: 'ns-resize' }}
              onMouseDown={e => startSpacingDrag(e, firstBar, extra)}
            >
              {/* Larger invisible hit target */}
              <rect x={0} y={gripY - 8} width={PADDING - 4} height={16} fill="transparent" />
              {/* Grip line */}
              <line
                x1={6} y1={gripY} x2={PADDING - 6} y2={gripY}
                stroke={active ? '#2563eb' : '#ccc'}
                strokeWidth={active ? 1.5 : 1}
                strokeDasharray="4,3"
              />
              {/* ↕ icon centred on the grip */}
              <text
                x={PADDING / 2} y={gripY + 4}
                textAnchor="middle" fontSize={8}
                fill={active ? '#2563eb' : '#ccc'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                ↕
              </text>
              {/* Gap size label — only shown when non-zero */}
              {extra > 0 && (
                <text
                  x={PADDING / 2} y={gripY + extra / 2 + 4}
                  textAnchor="middle" fontSize={7.5}
                  fill="#bbb"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {Math.round(extra)}px
                </text>
              )}
            </g>
          );
        })}

        {/* Empty state */}
        {rows.length === 0 && (
          <text
            x={W / 2} y={HEADER_HEIGHT + 58}
            textAnchor="middle"
            fontSize={13}
            fontFamily="Georgia, serif"
            fontStyle="italic"
            fill="#ccc"
          >
            Enter phrase lengths below to begin
          </text>
        )}
      </svg>
    </div>
  );
}

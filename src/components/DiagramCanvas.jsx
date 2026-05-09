import { useMemo } from 'react';

// ── SVG note glyph system ─────────────────────────────────────
// Parses text with note shorthand codes and renders inline SVG glyphs.
// Codes: w h q e s ee ss sss ssss. Word-boundary delimited so "see" ≠ s+e.

const NH_RX = 3.5, NH_RY = 2.2;      // note head semi-axes
const OX = NH_RX;                      // head centre x  (left edge at x=0)
const OY = -(NH_RY + 0.5);            // head centre y  (bottom ≈ text baseline)
const STX = OX + NH_RX * 0.8;         // stem x
const ST_TOP = OY - 10;               // stem top y
const SP = 7.5;                        // note spacing in beamed groups
const BM_H = 1.8, BM_GAP = 2.2;      // beam height / gap between parallel beams
const FL_DX = 4.5, FL_DY = 5;        // flag x-extent and y-extent

const NOTE_GW = {
  w: OX * 2 + 2, h: STX + 2, q: STX + 2,
  e: STX + FL_DX + 1, s: STX + FL_DX + 1,
  ee: SP + STX - 3, ss: SP + STX - 3,
  sss: SP * 2 + STX - 3, ssss: SP * 3 + STX - 3,
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
    default: return null;
  }
}

const NOTE_CODES = /\b(ssss|sss|ss|ee|w|h|q|e|s)\b/g;
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
function Slur({ x, visualX, width, slurY, startBar, length, isLastInRow, endBar, overlapPx, selected, editMode, hasMarkAtBar, hideBarNum, onClick, onStartClick }) {
  const hasOverlap = overlapPx > 0;
  const { x1, x2, cpY, cp1x, cp2x } = mainArchParams(visualX, width, slurY);
  const d = `M ${x1} ${slurY} C ${cp1x} ${cpY} ${cp2x} ${cpY} ${x2} ${slurY}`;
  const mid = { x: (x1 + x2) / 2, y: bezierY(0.5, slurY, cpY) };

  // Nominal start x (for bar number, rehearsal mark, elision dot)
  const nx = x + 1;

  const inMarkMode = editMode === 'rehearsalMarks';
  const stroke = selected ? '#2563eb' : '#1a1a1a';

  return (
    <g>
      {/* Invisible wide hit area for clicking the slur body */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer' }} onClick={onClick} />

      {/* Slur arc */}
      <path d={d} fill="none" stroke={stroke} strokeWidth={selected ? 2 : 1.5} strokeLinecap="round" />

      {/* Start tick (at visual start) */}
      <line x1={x1} y1={slurY - 6} x2={x1} y2={slurY + 3} stroke={stroke} strokeWidth={1.2} />
      {/* End tick */}
      <line x1={x2} y1={slurY - 6} x2={x2} y2={slurY + 3} stroke={stroke} strokeWidth={1.2} />

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
      {!hideBarNum && (
        <text
          x={nx}
          y={slurY + 17}
          textAnchor="middle"
          fontSize={9.5}
          fontFamily="Georgia, 'Times New Roman', serif"
          fill={selected ? '#2563eb' : '#999'}
        >
          {formatBar(startBar)}
        </text>
      )}

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
        dominantBaseline="central"
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
function SectionMarker({ x1, x2, y, label, level, levelRank, isOpen, color }) {
  const isBroad = level === 0;
  const levelOffset = levelRank * 26;
  const lineY = y - (MAIN_MAX_ARCH + 14) - levelOffset;
  const labelX = isOpen ? x1 + 6 : (x1 + x2) / 2;
  const labelAnchor = isOpen ? 'start' : 'middle';
  const sw = isBroad ? 1.5 : 0.9;
  const col = color || '#1a1a1a';

  return (
    <g>
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
  const numStr = String(numerator);
  const denStr = String(denominator);
  const w = Math.max(numStr.length, denStr.length) * fs * 0.62 + 10;
  return (
    <g>
      {atBoundary && (
        <rect x={x - w / 2} y={slurY - 8} width={w} height={12} fill="white" />
      )}
      <text x={x} y={slurY - 3} textAnchor="middle" fontSize={fs}
        fontFamily="Georgia, 'Times New Roman', serif" fontWeight="bold" fill="#1a1a1a">
        {numStr}
      </text>
      <text x={x} y={slurY + fs - 2} textAnchor="middle" fontSize={fs}
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
  annotations,
  selectedPhraseIndex,
  editMode,
  barPickMode,
  svgRef,
  onSelectPhrase,
  onSubPhraseClick,
  onSlurStartClick,
  onRemoveRehearsalMark,
  onBarPick,
}) {
  const { rows, totalHeight, HEADER_HEIGHT } = layout;
  const W = CANVAS_WIDTH;

  const marksByBar = useMemo(() => {
    const m = new Map();
    rehearsalMarks.forEach(rm => m.set(rm.bar, rm));
    return m;
  }, [rehearsalMarks]);

  // Set of bars that have a time signature — used to suppress bar number labels
  const timeSigBarSet = useMemo(() => new Set(timeSignatures.map(ts => ts.bar)), [timeSignatures]);

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
              y={pos.slurY - 30}
              label={mark.label}
              markStyle={rehearsalMarkStyle}
              onClick={() => onRemoveRehearsalMark(mark.id)}
            />
          );
        })}

        {/* Annotations — italic text below each row's bar-number zone */}
        {annotations.map(ann => {
          const pos = getBarPos(ann.bar);
          if (!pos) return null;
          return (
            <NoteText
              key={ann.id}
              text={ann.text}
              x={pos.x} y={pos.slurY + 30}
              fontSize={11} fill="#555" fontStyle="italic"
            />
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

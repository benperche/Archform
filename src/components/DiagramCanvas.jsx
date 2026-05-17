import { useMemo, useState, useEffect, useCallback } from 'react';
import { NoteGlyph, NoteText } from './NoteGlyphs';
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
  const [hovered, setHovered] = useState(false);
  const hasOverlap = overlapPx > 0;
  const { x1, x2, cpY, cp1x, cp2x } = mainArchParams(visualX, width, slurY);
  const d = `M ${x1} ${slurY} C ${cp1x} ${cpY} ${cp2x} ${cpY} ${x2} ${slurY}`;
  const mid = { x: (x1 + x2) / 2, y: bezierY(0.5, slurY, cpY) };

  // Nominal start x (for bar number, rehearsal mark, elision dot)
  const nx = x + 1;

  const inMarkMode = editMode === 'rehearsalMarks';
  const stroke = selected ? '#2563eb' : (hovered ? '#4878cf' : '#1a1a1a');

  // Width of the bar number string in px (approx, for hit rect sizing)
  const bnStr = formatBar(startBar);
  const bnW = Math.max(18, bnStr.length * 6);

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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
  const [hovered, setHovered] = useState(false);
  const isBarNum = markStyle === 'bars';
  const fs = isBarNum ? 13 : 12;
  const pad = 5;
  const w = Math.max(20, label.length * (fs * 0.65) + pad * 2);
  const h = 19;
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <rect
        x={x - w / 2} y={y - h / 2}
        width={w} height={h}
        fill={hovered ? '#eff6ff' : 'white'}
        stroke={hovered ? '#2563eb' : '#1a1a1a'}
        strokeWidth={1.2} rx={1.5}
      />
      <text
        x={x} y={y}
        textAnchor="middle"
        dy="0.35em"
        fontSize={fs}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="bold"
        fill={hovered ? '#2563eb' : '#1a1a1a'}
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
  const [hovered, setHovered] = useState(false);
  const isBroad = level === 0;
  const levelOffset = levelRank * 26;
  const lineY = y - (MAIN_MAX_ARCH + 14) - levelOffset;
  const labelX = isOpen ? x1 + 6 : (x1 + x2) / 2;
  const labelAnchor = isOpen ? 'start' : 'middle';
  const sw = isBroad ? 1.5 : 0.9;
  const col = isActive ? '#2563eb' : (hovered && onClick ? '#4878cf' : (color || '#1a1a1a'));

  return (
    <g
      style={onClick ? { cursor: 'pointer' } : undefined}
      onClick={onClick}
      onMouseEnter={onClick ? () => setHovered(true) : undefined}
      onMouseLeave={onClick ? () => setHovered(false) : undefined}
    >
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
function TimeSig({ x, slurY, numerator, denominator, atBoundary, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);
  const fs = 14;
  const capH = Math.round(fs * 0.72);
  const numStr = String(numerator);
  const denStr = String(denominator);
  const w = Math.max(numStr.length, denStr.length) * fs * 0.62 + 10;
  const col = isActive ? '#2563eb' : (hovered && onClick ? '#4878cf' : '#1a1a1a');
  return (
    <g
      style={onClick ? { cursor: 'pointer' } : undefined}
      onClick={onClick}
      onMouseEnter={onClick ? () => setHovered(true) : undefined}
      onMouseLeave={onClick ? () => setHovered(false) : undefined}
    >
      {onClick && (
        <rect x={x - w / 2 - 4} y={slurY - capH - 6} width={w + 8} height={capH * 2 + 12} fill="transparent" />
      )}
      {atBoundary && (
        <rect x={x - w / 2} y={slurY - 7} width={w} height={10} fill="white" style={{ pointerEvents: 'none' }} />
      )}
      <text x={x} y={slurY} textAnchor="middle" fontSize={fs}
        fontFamily="Georgia, 'Times New Roman', serif" fontWeight="bold" fill={col}>
        {numStr}
      </text>
      <text x={x} y={slurY + capH} textAnchor="middle" fontSize={fs}
        fontFamily="Georgia, 'Times New Roman', serif" fontWeight="bold" fill={col}>
        {denStr}
      </text>
    </g>
  );
}

// Repeat / final barline, clickable when onClick is provided.
function RepeatBarlineItem({ rp, x, slurY, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);
  const top = slurY - 28;
  const bot = slurY + 10;
  const h = bot - top;
  const f = isActive ? '#2563eb' : (hovered && onClick ? '#4878cf' : '#1a1a1a');
  const sep = 4;
  return (
    <g
      style={onClick ? { cursor: 'pointer' } : undefined}
      onClick={onClick}
      onMouseEnter={onClick ? () => setHovered(true) : undefined}
      onMouseLeave={onClick ? () => setHovered(false) : undefined}
    >
      {/* Wide transparent hit area — only when clickable, so it doesn't block other click targets */}
      {onClick && <rect x={x - 12} y={top - 4} width={24} height={h + 8} fill="transparent" />}
      {rp.type === 'start' && <>
        <line x1={x}       y1={top} x2={x}       y2={bot} stroke={f} strokeWidth={3.5} />
        <line x1={x + sep} y1={top} x2={x + sep} y2={bot} stroke={f} strokeWidth={1} />
        <circle cx={x + sep + 5.5} cy={top + h * 0.35} r={1.8} fill={f} />
        <circle cx={x + sep + 5.5} cy={top + h * 0.65} r={1.8} fill={f} />
      </>}
      {rp.type === 'end' && <>
        <circle cx={x - sep - 5.5} cy={top + h * 0.35} r={1.8} fill={f} />
        <circle cx={x - sep - 5.5} cy={top + h * 0.65} r={1.8} fill={f} />
        <line x1={x - sep} y1={top} x2={x - sep} y2={bot} stroke={f} strokeWidth={1} />
        <line x1={x}       y1={top} x2={x}       y2={bot} stroke={f} strokeWidth={3.5} />
      </>}
      {rp.type === 'double' && <>
        <line x1={x - sep / 2} y1={top} x2={x - sep / 2} y2={bot} stroke={f} strokeWidth={1} />
        <line x1={x + sep / 2} y1={top} x2={x + sep / 2} y2={bot} stroke={f} strokeWidth={1} />
      </>}
      {rp.type === 'final' && <>
        <line x1={x - sep / 2} y1={top} x2={x - sep / 2} y2={bot} stroke={f} strokeWidth={1} />
        <line x1={x + sep / 2} y1={top} x2={x + sep / 2} y2={bot} stroke={f} strokeWidth={3.5} />
      </>}
    </g>
  );
}

// Fermata or caesura symbol above a slur arc, clickable when onClick is provided.
// fm.type === 'caesura' renders two parallel forward-slash lines (train tracks).
// Defaults to fermata (arc + dot) when type is absent (backward compatibility).
function FermataGlyph({ fm, cx, cy, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);
  const f = isActive ? '#2563eb' : (hovered && onClick ? '#4878cf' : '#1a1a1a');
  const isCaesura = fm.type === 'caesura';

  // Fermata geometry
  const r = 7;
  // Caesura geometry: two forward-slash lines, each tilted ~25° from vertical
  const slashH = 11, slashDx = 2.5, gap = 5;

  return (
    <g
      style={onClick ? { cursor: 'pointer' } : undefined}
      onClick={onClick}
      onMouseEnter={onClick ? () => setHovered(true) : undefined}
      onMouseLeave={onClick ? () => setHovered(false) : undefined}
    >
      {isCaesura ? (<>
        <rect x={cx - gap - slashDx - 4} y={cy - slashH / 2 - 4}
          width={gap * 2 + slashDx * 2 + 8} height={slashH + 8} fill="transparent" />
        <line x1={cx - gap / 2 - slashDx} y1={cy + slashH / 2}
              x2={cx - gap / 2 + slashDx} y2={cy - slashH / 2}
              stroke={f} strokeWidth={1.5} strokeLinecap="round" />
        <line x1={cx + gap / 2 - slashDx} y1={cy + slashH / 2}
              x2={cx + gap / 2 + slashDx} y2={cy - slashH / 2}
              stroke={f} strokeWidth={1.5} strokeLinecap="round" />
      </>) : (<>
        <rect x={cx - r - 4} y={cy - r - 4} width={(r + 4) * 2} height={r + 10} fill="transparent" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          stroke={f} strokeWidth={1.2} fill="none" />
        <circle cx={cx} cy={cy} r={1.8} fill={f} />
      </>)}
    </g>
  );
}

// Inline label text below the phrase baseline, with hover highlight when clickable.
function LabelItem({ lbl, pos, isActive, clickable, onLabelClick }) {
  const [hovered, setHovered] = useState(false);
  const estW = Math.max(50, lbl.text.length * 6.5);
  const fill = isActive ? '#2563eb' : (hovered && clickable ? '#4878cf' : '#555');
  return (
    <g
      style={clickable ? { cursor: 'pointer' } : undefined}
      onClick={clickable ? (e) => { e.stopPropagation(); onLabelClick(lbl.id); } : undefined}
      onMouseEnter={clickable ? () => setHovered(true) : undefined}
      onMouseLeave={clickable ? () => setHovered(false) : undefined}
    >
      <rect x={pos.x - 3} y={pos.slurY + 33 - 12} width={estW + 6} height={18} fill="transparent" />
      <NoteText
        text={lbl.text}
        x={pos.x} y={pos.slurY + 33}
        fontSize={11} fill={fill} fontStyle="italic"
      />
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
  onRehearsalMarkPanelOpen,
  onBarPick,
  activeLabelId,
  activeSectionId,
  activeRepeatId,
  activeFermataId,
  activeTimeSigId,
  onLabelClick,
  onSectionClick,
  onRepeatClick,
  onFermataClick,
  onTimeSigClick,
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
          const inMarkMode = editMode === 'rehearsalMarks';
          return (
            <RehearsalMark
              key={mark.id}
              x={pos.x}
              y={pos.slurY - 46}
              label={mark.label}
              markStyle={rehearsalMarkStyle}
              onClick={inMarkMode
                ? () => onRemoveRehearsalMark(mark.id)
                : () => onRehearsalMarkPanelOpen?.()}
            />
          );
        })}

        {/* Labels — italic text below each row's bar-number zone */}
        {labels.map(lbl => {
          const pos = getBarPos(lbl.bar);
          if (!pos) return null;
          return (
            <LabelItem
              key={lbl.id}
              lbl={lbl}
              pos={pos}
              isActive={lbl.id === activeLabelId}
              clickable={!barPickMode && !editMode && !!onLabelClick}
              onLabelClick={onLabelClick}
            />
          );
        })}

        {/* Time signatures — rendered on top so white rects cover tick marks at boundaries */}
        {timeSignatures.map(ts => {
          const pos = getBarPos(ts.bar);
          if (!pos) return null;
          const clickable = !barPickMode && !editMode && !!onTimeSigClick;
          return (
            <TimeSig
              key={ts.id}
              x={pos.x}
              slurY={pos.slurY}
              numerator={ts.numerator}
              denominator={ts.denominator}
              atBoundary={boundaryBars.has(ts.bar)}
              isActive={ts.id === activeTimeSigId}
              onClick={clickable ? (e) => { e.stopPropagation(); onTimeSigClick(ts.id); } : undefined}
            />
          );
        })}

        {/* Repeat barlines & final barlines */}
        {repeats.map(rp => {
          const pos = getBarPos(rp.bar);
          if (!pos) return null;
          const clickable = !barPickMode && !editMode && !!onRepeatClick;
          return (
            <RepeatBarlineItem
              key={rp.id}
              rp={rp}
              x={pos.x}
              slurY={pos.slurY}
              isActive={rp.id === activeRepeatId}
              onClick={clickable ? (e) => { e.stopPropagation(); onRepeatClick(rp.id); } : undefined}
            />
          );
        })}

        {/* Fermatas — pause symbol above the slur arc */}
        {fermatas.map(fm => {
          const pos = getBarPos(fm.bar);
          if (!pos) return null;
          const clickable = !barPickMode && !editMode && !!onFermataClick;
          return (
            <FermataGlyph
              key={fm.id}
              fm={fm}
              cx={pos.x}
              cy={pos.slurY - 36}
              isActive={fm.id === activeFermataId}
              onClick={clickable ? (e) => { e.stopPropagation(); onFermataClick(fm.id); } : undefined}
            />
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
          <g>
            <text x={W / 2} y={HEADER_HEIGHT + 52} textAnchor="middle"
              fontSize={14} fontFamily="Georgia, serif" fontStyle="italic" fill="#bbb">
              Enter phrase lengths below to get started
            </text>
            <text x={W / 2} y={HEADER_HEIGHT + 74} textAnchor="middle"
              fontSize={11} fontFamily="'Monaco', 'Menlo', monospace" fill="#d0cdc7">
              e.g.  4 4 8, 4 4 4 4
            </text>
            <text x={W / 2} y={HEADER_HEIGHT + 92} textAnchor="middle"
              fontSize={11} fontFamily="Georgia, serif" fill="#d0cdc7">
              Spaces or commas separate phrases · new line = new system row
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

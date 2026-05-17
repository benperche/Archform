// Shared note glyph rendering — used by DiagramCanvas and HelpModal.

const NH_RX = 3.5, NH_RY = 2.2;
const OX = NH_RX;
const OY = -(NH_RY + 0.5);
const STX = OX + NH_RX * 0.8;
const ST_TOP = OY - 10;
const SP = 7.5;
const BM_H = 1.8, BM_GAP = 2.2;
const FL_DX = 4.5, FL_DY = 5;
const TRIP_W = SP * 2 + STX + 2;

export const NOTE_GW = {
  w: OX * 2 + 2, h: STX + 2, q: STX + 2,
  e: STX + FL_DX + 1, s: STX + FL_DX + 1,
  ee: SP + STX - 3, ss: SP + STX - 3,
  sss: SP * 2 + STX - 3, ssss: SP * 3 + STX - 3,
  th: TRIP_W, tq: TRIP_W, te: TRIP_W, ts: TRIP_W,
};

export const NOTE_CODES = /\b(ssss|sss|ss|ee|ts|te|tq|th|w|h|q|e|s)\b/g;

export function parseNoteText(text) {
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

export function NoteGlyph({ type, fill: f = '#1a1a1a' }) {
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

  const trip3 = () => {
    const lx = OX - NH_RX - 0.5;
    const rx = OX + NH_RX + SP * 2 + 0.5;
    const cx = (lx + rx) / 2;
    const by = OY + NH_RY + 4;
    const ty = by + 5;
    const tick = 3, gap = 2.5;
    return (
      <g>
        <line x1={lx} y1={by} x2={cx - gap} y2={by} stroke={f} strokeWidth={0.7} />
        <line x1={lx} y1={by} x2={lx} y2={by - tick} stroke={f} strokeWidth={0.7} />
        <line x1={rx} y1={by} x2={cx + gap} y2={by} stroke={f} strokeWidth={0.7} />
        <line x1={rx} y1={by} x2={rx} y2={by - tick} stroke={f} strokeWidth={0.7} />
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
    case 'th':   return <g>{hd(0,false)}{st()}{hd(SP,false)}{st(SP)}{hd(SP*2,false)}{st(SP*2)}{trip3()}</g>;
    case 'tq':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP*2)}{st(SP*2)}{trip3()}</g>;
    case 'te':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP*2)}{st(SP*2)}{bm(3)}{trip3()}</g>;
    case 'ts':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP*2)}{st(SP*2)}{bm(3)}{bm(3,BM_H+BM_GAP)}{trip3()}</g>;
    default: return null;
  }
}

function estTextW(str, fontSize) { return str.length * fontSize * 0.52; }

export function NoteText({ text, x, y, fontSize, fill, fontStyle, fontWeight, textAnchor = 'start' }) {
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

// Standalone preview SVG for a single note type — used in help modal.
// height/width chosen to comfortably contain the tallest glyph.
export function NoteGlyphPreview({ type }) {
  const gw = NOTE_GW[type] ?? 10;
  const vw = Math.ceil(gw) + 6;
  const vh = 26; // enough room for stem + triplet bracket below
  const baseline = 19; // y=0 in glyph coords maps here
  return (
    <svg
      width={vw} height={vh}
      viewBox={`-2 ${-baseline} ${vw} ${vh}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <NoteGlyph type={type} />
    </svg>
  );
}

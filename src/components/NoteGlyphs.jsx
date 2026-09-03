// Shared note glyph rendering — used by DiagramCanvas and HelpModal.

const NH_RX = 3.5, NH_RY = 2.2;
const OX = NH_RX;
const OY = -(NH_RY + 0.5);
const STX = OX + NH_RX;        // stem at right edge of notehead
const ST_TOP = OY - 10;
const SP = 7.5;
const BM_H = 1.8, BM_GAP = 2.2;
const FL_DX = 4.5;
const TRIP_W = SP * 2 + STX + 2;

// ── Rest geometry ─────────────────────────────────────────────
// Whole and half rests are identical blocks distinguished only by which side
// of a staff line they sit on. There is no staff here, so both are drawn with
// a short reference line: the whole rest hangs below it, the half rest sits on
// it. Without that line the two would be indistinguishable.
const RST_LINE_Y = -6;
const RST_LINE_X2 = 8.4;
const RST_BLK_X = 1.1;
const RST_BLK_W = 6.2;
const RST_BLK_H = 2.3;
const REST_W = RST_LINE_X2 + 1.5;

export const NOTE_GW = {
  w: OX * 2 + 2, h: STX + 2, q: STX + 2,
  e: STX + FL_DX + 1, s: STX + FL_DX + 1,
  ee: SP + STX - 3, ss: SP + STX - 3,
  sss: SP * 2 + STX - 3, ssss: SP * 3 + STX - 3,
  th: TRIP_W, tq: TRIP_W, te: TRIP_W, ts: TRIP_W,
  wr: REST_W, hr: REST_W, qr: 8, er: 8, sr: 8.5,
};

// Note/rest codes, longest first. A trailing "." makes the value dotted, e.g.
// "q." — the lookahead stops "Water" matching "w" and keeps the dot attached.
const NOTE_ALT = 'ssss|sss|ss|ee|ts|te|tq|th|wr|hr|qr|er|sr|w|h|q|e|s';
// Text dynamics, rendered in the bold-italic serif style musicians expect.
const DYN_ALT = 'sffz|sfz|sfp|fff|ppp|ff|pp|mf|mp|rfz|rf|sf|fp|fz|f|p';

export const NOTE_CODES = new RegExp(
  `\\b(?:(${NOTE_ALT})(\\.?)(?![\\w.])|(${DYN_ALT})\\b)`, 'g'
);

export const DYNAMICS = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'sf', 'sfz', 'fp'];

export function parseNoteText(text) {
  const tokens = [];
  let last = 0;
  NOTE_CODES.lastIndex = 0;
  let m;
  while ((m = NOTE_CODES.exec(text)) !== null) {
    if (m.index > last) tokens.push({ kind: 'text', val: text.slice(last, m.index) });
    if (m[1]) tokens.push({ kind: 'note', val: m[1], dotted: m[2] === '.' });
    else tokens.push({ kind: 'dyn', val: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ kind: 'text', val: text.slice(last) });
  return tokens;
}

const REST_TYPES = new Set(['wr', 'hr', 'qr', 'er', 'sr']);

export function NoteGlyph({ type, fill: f = '#1a1a1a', dotted = false }) {
  const hd = (dx = 0, filled = true) => filled
    ? <ellipse cx={OX + dx} cy={OY} rx={NH_RX} ry={NH_RY} fill={f} />
    : <ellipse cx={OX + dx} cy={OY} rx={NH_RX} ry={NH_RY} fill="white" stroke={f} strokeWidth={0.9} />;
  const st = (dx = 0) =>
    <line x1={STX + dx} y1={OY} x2={STX + dx} y2={ST_TOP} stroke={f} strokeWidth={1.1} />;
  // Flag: an open hook sweeping right and down. Deliberately does not curl back
  // to the stem — two stacked closed teardrops read as a "B" rather than as
  // two flags. Used for both the eighth and the sixteenth.
  const flHook = (yOff = 0) => {
    const x0 = STX, y0 = ST_TOP + yOff;
    return <path
      d={`M ${x0} ${y0} C ${x0 + FL_DX} ${y0 + 1.1} ${x0 + FL_DX + 0.8} ${y0 + 3} ${x0 + FL_DX - 1.1} ${y0 + 4.7}`}
      fill="none" stroke={f} strokeWidth={1.1} strokeLinecap="round" />;
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

  // Whole / half rest: block hanging below (whole) or sitting on (half) the line
  const blockRest = below => (
    <g>
      <line x1={0} y1={RST_LINE_Y} x2={RST_LINE_X2} y2={RST_LINE_Y}
        stroke={f} strokeWidth={0.9} strokeLinecap="round" />
      <rect
        x={RST_BLK_X}
        y={below ? RST_LINE_Y : RST_LINE_Y - RST_BLK_H}
        width={RST_BLK_W} height={RST_BLK_H} fill={f} />
    </g>
  );

  // Quarter rest: zigzag with a curled tail
  const qRest = () => (
    <path
      d="M 2.1 -12 L 5.4 -8.8 L 2.3 -6.4 L 5.6 -3.7 C 3.8 -4.7 2.1 -3.8 2.8 -1.7"
      fill="none" stroke={f} strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" />
  );

  // Eighth / sixteenth rest: slanted stem with n blobs sitting on it
  const flagRest = n => {
    const x1 = 5.7, y1 = -11.4, x2 = 2.3, y2 = -1.1;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;   // left-hand normal to the stem
    const lerp = (a, b, t) => a + (b - a) * t;
    const blobs = [];
    for (let i = 0; i < n; i++) {
      const t = 0.07 + i * 0.31;
      const ax = lerp(x1, x2, t), ay = lerp(y1, y2, t);
      blobs.push(
        <circle key={i} cx={ax + nx * 1.15} cy={ay + ny * 1.15} r={1.5} fill={f} />
      );
    }
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={f} strokeWidth={1.1} strokeLinecap="round" />
        {blobs}
      </g>
    );
  };

  // Augmentation dot, placed clear of the notehead (or to the right of a rest)
  const dot = () => {
    if (!dotted) return null;
    const isRest = REST_TYPES.has(type);
    const cx = isRest ? (type === 'wr' || type === 'hr' ? 10.4 : 8.2) : OX + NH_RX + 2.6;
    const cy = isRest ? -6.3 : OY;
    return <circle cx={cx} cy={cy} r={1.15} fill={f} />;
  };

  const withDot = el => dotted ? <g>{el}{dot()}</g> : el;

  const glyph = (() => {
    switch (type) {
    case 'w':    return <g>{hd(0, false)}</g>;
    case 'h':    return <g>{hd(0, false)}{st()}</g>;
    case 'q':    return <g>{hd()}{st()}</g>;
    case 'e':    return <g>{hd()}{st()}{flHook()}</g>;
    case 's':    return <g>{hd()}{st()}{flHook(0)}{flHook(4.9)}</g>;
    case 'ee':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{bm(2)}</g>;
    case 'ss':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{bm(2)}{bm(2, BM_H + BM_GAP)}</g>;
    case 'sss':  return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP * 2)}{st(SP * 2)}{bm(3)}{bm(3, BM_H + BM_GAP)}</g>;
    case 'ssss': return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP * 2)}{st(SP * 2)}{hd(SP * 3)}{st(SP * 3)}{bm(4)}{bm(4, BM_H + BM_GAP)}</g>;
    case 'th':   return <g>{hd(0,false)}{st()}{hd(SP,false)}{st(SP)}{hd(SP*2,false)}{st(SP*2)}{trip3()}</g>;
    case 'tq':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP*2)}{st(SP*2)}{trip3()}</g>;
    case 'te':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP*2)}{st(SP*2)}{bm(3)}{trip3()}</g>;
    case 'ts':   return <g>{hd()}{st()}{hd(SP)}{st(SP)}{hd(SP*2)}{st(SP*2)}{bm(3)}{bm(3,BM_H+BM_GAP)}{trip3()}</g>;
    case 'wr':   return blockRest(true);
    case 'hr':   return blockRest(false);
    case 'qr':   return <g>{qRest()}</g>;
    case 'er':   return flagRest(1);
    case 'sr':   return flagRest(2);
    default: return null;
    }
  })();

  if (!glyph) return null;
  return withDot(glyph);
}

function estTextW(str, fontSize) { return str.length * fontSize * 0.52; }

export function NoteText({ text, x, y, fontSize, fill, fontStyle, fontWeight, textAnchor = 'start' }) {
  if (!text) return null;
  const tokens = parseNoteText(text);
  const sc = fontSize / 11;
  const widths = tokens.map(tok =>
    tok.kind === 'text' ? estTextW(tok.val, fontSize)
    : tok.kind === 'dyn' ? estTextW(tok.val, fontSize) * 1.15 + 2
    : (NOTE_GW[tok.val] ?? 0) * sc + (tok.dotted ? 4 * sc : 0)
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
        if (tok.kind === 'dyn') {
          return (
            <text key={i} x={px} y={y} fontSize={fontSize * 1.18}
              fontFamily="Georgia, 'Times New Roman', serif"
              fontStyle="italic" fontWeight="bold" fill={fill}>{tok.val}</text>
          );
        }
        return (
          <g key={i} transform={`translate(${px}, ${y}) scale(${sc})`}>
            <NoteGlyph type={tok.val} fill={fill} dotted={tok.dotted} />
          </g>
        );
      })}
    </g>
  );
}

// Standalone preview SVG of a fermata — used in help modal.
// Matches the arc+dot drawn by FermataGlyph in DiagramCanvas.
export function FermataPreview() {
  const r = 7, cx = 11, cy = 10;
  return (
    <svg width={22} height={18} viewBox="0 0 22 18"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke="#1a1a1a" strokeWidth={1.2} fill="none" />
      <circle cx={cx} cy={cy} r={1.8} fill="#1a1a1a" />
    </svg>
  );
}

// Standalone preview SVG of a breath mark — used in help modal.
// Matches the curved comma drawn by FermataGlyph in DiagramCanvas.
export function BreathPreview() {
  const cx = 11, cy = 9;
  return (
    <svg width={22} height={18} viewBox="0 0 22 18"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d={`M ${cx - 1} ${cy + 4} Q ${cx + 5} ${cy + 1} ${cx + 2} ${cy - 6}`}
        stroke="#1a1a1a" strokeWidth={1.3} fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Standalone preview SVG of a caesura — used in help modal.
// Matches the two forward-slash lines drawn by FermataGlyph in DiagramCanvas.
export function CaesuraPreview() {
  const cx = 11, cy = 9, slashH = 11, slashDx = 2.5, gap = 5;
  return (
    <svg width={22} height={18} viewBox="0 0 22 18"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <line x1={cx - gap / 2 - slashDx} y1={cy + slashH / 2}
            x2={cx - gap / 2 + slashDx} y2={cy - slashH / 2}
            stroke="#1a1a1a" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={cx + gap / 2 - slashDx} y1={cy + slashH / 2}
            x2={cx + gap / 2 + slashDx} y2={cy - slashH / 2}
            stroke="#1a1a1a" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

// Standalone preview SVG for a single note type — used in help modal.
// height/width chosen to comfortably contain the tallest glyph.
export function NoteGlyphPreview({ type, dotted = false }) {
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
      <NoteGlyph type={type} dotted={dotted} />
    </svg>
  );
}

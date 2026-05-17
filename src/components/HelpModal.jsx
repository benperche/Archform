import { NoteGlyphPreview } from './NoteGlyphs';

export default function HelpModal({ onClose }) {
  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-modal" onClick={e => e.stopPropagation()}>
        <div className="help-header">
          <h2 className="help-title">How to Use Archform</h2>
          <button className="help-close" onClick={onClose}>✕</button>
        </div>

        <div className="help-body">

          <section className="help-section">
            <p className="help-intro">
              Archform is a tool for making phrase diagrams — visual maps of how a piece of music
              is structured. Each slur arch represents a phrase; sections and labels let you
              layer in as much analytical detail as you need.
            </p>
          </section>

          <section className="help-section">
            <h3>1 — Enter your phrases</h3>
            <p>
              Type phrase lengths in the <strong>Phrases</strong> box at the bottom — separated by spaces or commas.
              Each number becomes one slur arch on the diagram.
            </p>
            <div className="help-example">6 6 2 7 6 9 3</div>
            <p>
              Start a <strong>new line</strong> to begin a new row of the diagram.
              Use <strong>parentheses</strong> to show how a phrase is sub-divided:
            </p>
            <div className="help-example">7(4+3){'  '}9(5+4){'  '}8(6+2)</div>
            <p>The title and composer fields at the top are shown on the printed diagram.</p>
          </section>

          <section className="help-section">
            <h3>2 — Add rehearsal marks</h3>
            <p>
              Click <strong>Rehearsal marks</strong> in the bottom button grid to open the rehearsal
              marks panel. The phrase input is replaced by the panel — click any slur's starting
              point on the diagram to place a mark there. Click an existing mark to remove it.
            </p>
            <p>
              You can also type a bar number into the <em>Bar</em> field and click <em>Add mark</em>
              to place a mark at an arbitrary position not tied to a slur start.
            </p>
            <p>
              Choose the label style using the toggle buttons: <em>Letters</em> (A, B, C…),
              <em> Numbers</em> (1, 2, 3…), <em>Roman</em> (I, II, III…), or <em>Bar nos.</em>
            </p>
          </section>

          <section className="help-section">
            <h3>3 — Add sections (above the diagram)</h3>
            <p>
              Click <strong>Sections</strong> in the bottom button grid to open the Sections panel.
              Sections are labelled brackets that span a range of bars and appear
              <em> above</em> the slur rows.
            </p>
            <p>
              Each section has a <strong>start bar</strong>, <strong>end bar</strong>, an optional <strong>label</strong>,
              and a <strong>level</strong>:
            </p>
            <ul>
              <li><strong>Broad</strong> — renders highest, bold with thick lines. Use for large-scale structure.</li>
              <li><strong>Mid</strong> — renders in between.</li>
              <li><strong>Fine</strong> — renders closest to the slurs. Use for phrase-level detail.</li>
            </ul>
            <p>
              If a section spans multiple rows it will show as an open bracket on every row it crosses,
              closing only at its actual end bar.
            </p>
            <p>
              Click any section bracket on the diagram to jump straight to its edit form in the panel.
              You can also click <em>Pick from diagram</em> then click a slur to fill in a bar number automatically.
            </p>
          </section>

          <section className="help-section">
            <h3>4 — Add labels (below the diagram)</h3>
            <p>
              Click <strong>Labels</strong> in the bottom button grid. Labels are free-text items that appear
              <em> below</em> the slur rows, pinned to a bar position. Click a label on the diagram
              to jump to its edit form.
            </p>
            <p>
              You can include note symbols in label text using shorthand codes:
            </p>
            <div className="help-note-table">
              <div className="help-note-row"><NoteGlyphPreview type="w" /><code>w</code><span>whole note (semibreve)</span></div>
              <div className="help-note-row"><NoteGlyphPreview type="h" /><code>h</code><span>half note (minim)</span></div>
              <div className="help-note-row"><NoteGlyphPreview type="q" /><code>q</code><span>quarter note (crotchet)</span></div>
              <div className="help-note-row"><NoteGlyphPreview type="e" /><code>e</code><span>eighth note (quaver)</span></div>
              <div className="help-note-row"><NoteGlyphPreview type="s" /><code>s</code><span>sixteenth note (semiquaver)</span></div>
              <div className="help-note-row"><NoteGlyphPreview type="ee" /><code>ee</code><span>two beamed eighths</span></div>
              <div className="help-note-row"><NoteGlyphPreview type="ss" /><code>ss / sss / ssss</code><span>two / three / four beamed sixteenths</span></div>
            </div>
            <p>
              Triplet groups show three notes with a <em>3</em> bracket below:
            </p>
            <div className="help-note-table">
              <div className="help-note-row"><NoteGlyphPreview type="th" /><code>th</code><span>triplet halves</span></div>
              <div className="help-note-row"><NoteGlyphPreview type="tq" /><code>tq</code><span>triplet quarters</span></div>
              <div className="help-note-row"><NoteGlyphPreview type="te" /><code>te</code><span>triplet eighths</span></div>
              <div className="help-note-row"><NoteGlyphPreview type="ts" /><code>ts</code><span>triplet sixteenths</span></div>
            </div>
            <p>Example: <code>te te q 1st Theme</code></p>
          </section>

          <section className="help-section">
            <h3>5 — Add time signatures</h3>
            <p>
              Click <strong>Time signatures</strong> in the bottom button grid.
              Click a common time signature to select it, or enter a custom top and bottom number,
              then specify a bar position (or click the diagram to pick one) and click
              <em> Add time signature</em>.
            </p>
            <p>
              Time signatures appear as stacked bold numerals on the phrase line.
              When placed at a phrase boundary they sit between the two arches;
              when placed mid-phrase they float on the line beneath the arch without interrupting it.
              Click a time signature on the diagram to edit it.
            </p>
          </section>

          <section className="help-section">
            <h3>6 — Add barlines &amp; repeats</h3>
            <p>
              Click <strong>Barlines &amp; repeats</strong> to add barline markings at any bar position.
              Four types are available:
            </p>
            <ul>
              <li><strong>Start repeat</strong> (||:) — thick line with dots on the right</li>
              <li><strong>End repeat</strong> (:||) — dots on the left, thick line</li>
              <li><strong>Double barline</strong> (||) — two thin equal-weight lines</li>
              <li><strong>Final barline</strong> — thin line followed by a thick line</li>
            </ul>
            <p>Click a barline on the diagram to jump to its edit form.</p>
          </section>

          <section className="help-section">
            <h3>7 — Add fermatas</h3>
            <p>
              Click <strong>Fermatas</strong> to place a pause symbol (&#119136;) above the slur arc
              at any bar position. Click a fermata on the diagram to edit or remove it.
            </p>
          </section>

          <section className="help-section">
            <h3>8 — Navigation &amp; zoom</h3>
            <p>
              Use the <strong>+</strong> / <strong>−</strong> buttons above the diagram to zoom in and out,
              or hold <strong>⌘ Cmd</strong> (Mac) / <strong>Ctrl</strong> (Windows) and scroll with
              the mouse wheel. The reset button (↺) returns to 100%.
            </p>
            <p>
              Drag the <strong>↕</strong> handles in the left margin between rows to add extra
              vertical space between systems.
            </p>
            <p>
              Click any section, label, time signature, barline, or fermata on the diagram to open
              its panel and jump straight to the edit form for that item.
            </p>
          </section>

          <section className="help-section">
            <h3>9 — Managing files</h3>
            <p>
              Use the <strong>Files</strong> button (top left) to create new diagrams, switch between them,
              duplicate or delete ones you no longer need. File names are set automatically from the
              title and composer fields. Drag files into <strong>folders</strong> to keep your work organised.
            </p>
            <p>
              Use <strong>Export</strong> to save a diagram as a JSON file and <strong>Import</strong> to
              reload it later. SVG and PNG exports are also available. Use <strong>Print / PDF</strong> to
              print or export to PDF — the toolbar and panels are hidden automatically.
            </p>
          </section>

        </div>

        <div className="help-footer">
          <span className="help-credit">Designed by Ben Perche · Code by Claude.ai</span>
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

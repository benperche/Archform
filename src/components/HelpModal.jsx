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
              is structured. Each slur arch represents a phrase; sections and annotations let you
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
              Click <strong>Rehearsal marks</strong> in the toolbar to enter mark mode —
              the toolbar turns blue. Then click any slur's starting point to place a mark there.
              Click an existing mark to remove it.
            </p>
            <p>
              Choose the label style — <em>Letters</em> (A, B, C…),
              <em> Numbers</em> (1, 2, 3…), or <em>Bar numbers</em> — using the options that appear
              in the toolbar. Press <strong>Esc</strong> or click <em>Exit</em> to leave mark mode.
            </p>
          </section>

          <section className="help-section">
            <h3>3 — Add sections (above the diagram)</h3>
            <p>
              Open the <strong>Sections</strong> panel from the toolbar.
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
              Click any section in the list to edit it. You can click <em>Pick from diagram</em>
              then click a slur to fill in a bar number automatically.
            </p>
          </section>

          <section className="help-section">
            <h3>4 — Add annotations (below the diagram)</h3>
            <p>
              Open the <strong>Annotations</strong> panel. Annotations are free-text labels that appear
              <em> below</em> the slur rows, pinned to a bar position.
            </p>
            <p>
              You can include note symbols in annotation text using shorthand codes:
            </p>
            <div className="help-note-table">
              <div className="help-note-row"><code>q</code><span>quarter note (crotchet)</span></div>
              <div className="help-note-row"><code>h</code><span>half note (minim)</span></div>
              <div className="help-note-row"><code>w</code><span>whole note (semibreve)</span></div>
              <div className="help-note-row"><code>e</code><span>eighth note (quaver)</span></div>
              <div className="help-note-row"><code>s</code><span>sixteenth note (semiquaver)</span></div>
              <div className="help-note-row"><code>ee</code><span>two beamed eighths</span></div>
              <div className="help-note-row"><code>ss / sss / ssss</code><span>two / three / four beamed sixteenths</span></div>
            </div>
            <p>Example: <code>ee ee q 1st Theme</code></p>
          </section>

          <section className="help-section">
            <h3>5 — Add time signatures</h3>
            <p>
              Open the <strong>Time sigs</strong> panel from the toolbar.
              Click a common time signature to select it, or enter a custom top and bottom number,
              then specify a bar position (or click the diagram to pick one) and click
              <em> Add time signature</em>.
            </p>
            <p>
              Time signatures appear as stacked bold numerals on the phrase line.
              When placed at a phrase boundary they sit between the two arches;
              when placed mid-phrase they float on the line beneath the arch without interrupting it.
            </p>
          </section>

          <section className="help-section">
            <h3>6 — Managing files</h3>
            <p>
              Use the <strong>Files</strong> button (top left) to create new diagrams, switch between them,
              or delete ones you no longer need. File names are set automatically from the
              title and composer fields.
            </p>
            <p>
              Use <strong>Export</strong> to save a diagram as a JSON file and <strong>Import</strong> to
              reload it later. Use <strong>Print / PDF</strong> to print or export to PDF —
              the toolbar and panels are hidden automatically.
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

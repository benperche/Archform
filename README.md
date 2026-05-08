# Archform

A tool for making phrase diagrams — visual maps of how a piece of music is structured. Each slur arch represents a phrase; sections and annotations let you layer in as much analytical detail as you need.

**[Try it live →](https://benperche.github.io/Archform/)**

---

## Features

- **Phrase entry** — type phrase lengths as numbers, separated by spaces. New lines create new rows. Parentheses show sub-divisions: `7(4+3)`.
- **Rehearsal marks** — click slur starts to place marks, with letter, number, or bar-number labelling.
- **Sections** — labelled brackets above the diagram, at three levels of hierarchy (Broad, Mid, Fine). Sections that cross row boundaries render as open brackets.
- **Annotations** — free-text labels below the diagram, pinned to a bar position. Supports inline note symbols (`q`, `h`, `w`, `e`, `s`, `ee`, `ss`, `sss`, `ssss`).
- **Multi-file** — create, switch between, and delete diagrams. File names update automatically from the title and composer fields.
- **Export / Import** — save and reload diagrams as JSON files.
- **Print / PDF** — clean print layout with toolbar and panels hidden.

## Development

```bash
npm install
npm run dev
```

Requires Node 18+. Built with [React](https://react.dev/) and [Vite](https://vitejs.dev/). No backend — all data is stored in `localStorage`.

## Deployment

The site deploys automatically to GitHub Pages on every push to `main` via the included GitHub Actions workflow. To enable it, go to **Settings → Pages** in the repository and set the source to **GitHub Actions**.

## License

MIT

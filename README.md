# artifact-viewer

Open the markdown artifacts your coding agents produce (plans, design docs,
audit reports) in the browser — **read them beautifully, edit them in place,
save back to disk, and live-reload** when an agent rewrites the file.

Fully local. No cloud, no telemetry, no account.

```
artifact open docs/plans/2026-05-31-some-design.md
```

## Why

Terminal markdown is hard to read and IDE preview is read-only & bland. AI
artifacts are code-heavy — fenced code, mermaid diagrams, GFM tables, YAML
frontmatter, task lists — and deserve a real reading surface you can also edit.

## Features

- **Read mode** — rich typography (GitHub markdown CSS), syntax-highlighted
  code (highlight.js), rendered **mermaid** diagrams, GFM tables and task lists.
- **Edit mode** — Milkdown (ProseMirror) WYSIWYG that round-trips markdown
  faithfully. YAML frontmatter is split into its own panel so the editor can
  never corrupt it.
- **Save** — writes back to the same file. `Cmd/Ctrl+S`.
- **Live-reload** — a file watcher pushes external changes over a websocket; if
  you have unsaved edits it asks before discarding them.
- **Toggle** — `Cmd/Ctrl+E` flips Read ⇄ Edit.

## Install

```bash
git clone <this-repo> artifact-viewer
cd artifact-viewer
npm install
npm run build      # produces dist/ that the CLI serves
npm link           # makes `artifact` available globally
```

## Usage

```bash
artifact open path/to/file.md   # open in the browser
artifact path/to/file.md        # shorthand
artifact open file.md --no-open # start server without launching a browser
artifact --help
```

Use it from any project — it's not tied to any particular repo.

## How it works

```
bin/artifact.js      CLI — resolves the file, starts the server
server/index.mjs     Fastify: serves the SPA, GET/PUT /api/file, /ws live-reload
src/                 Vite + React SPA
  App.tsx              orchestration: load, read/edit toggle, save, reload
  readview.ts          markdown-it + highlight.js + mermaid (read mode)
  Editor.tsx           Milkdown Crepe wrapper (edit mode)
  frontmatter.ts       split/join YAML frontmatter so it never round-trips
```

The frontmatter is sliced off before the editor sees the body and re-attached
verbatim on save — that's what guarantees YAML survives editing untouched.

## Development

```bash
npm run dev        # Vite dev server (proxies /api + /ws to the running server)
# in another terminal:
ARTIFACT_FILE=sample.md node server/index.mjs
npm run typecheck
```

## Scope

v1 is deliberately single-file. No directory browser, auth, multi-user, or
collaboration — git already handles history.

## License

MIT

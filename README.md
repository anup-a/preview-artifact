# preview-artifact

Open the artifacts your coding agents produce (plans, design docs, audit
reports, papers) in the browser — **read them beautifully, edit them in place,
save back to disk, and live-reload** when an agent rewrites the file.

Handles **Markdown** (`.md`), **LaTeX** (`.tex`), and **PDF** (`.pdf`).

Fully local. No cloud, no telemetry, no account.

```bash
preview-artifact open docs/plans/2026-05-31-some-design.md
```

## Why

Terminal markdown is hard to read and IDE preview is read-only & bland. AI
artifacts are code-heavy — fenced code, mermaid diagrams, GFM tables, YAML
frontmatter, task lists — and deserve a real reading surface you can also edit.

## Features

- **Read mode** — rich typography (GitHub markdown CSS), syntax-highlighted
  code (highlight.js), rendered **mermaid** diagrams, GFM tables and task lists,
  and **KaTeX math** (`$…$` / `$$…$$`).
- **LaTeX (`.tex`)** — display equations typeset by KaTeX with the rest shown as
  highlighted LaTeX source; editable and saveable as plain source.
- **PDF (`.pdf`)** — embedded read-only viewer.
- **Edit mode** — Milkdown (ProseMirror) WYSIWYG that round-trips markdown
  faithfully. YAML frontmatter is split into its own panel so the editor can
  never corrupt it.
- **Save** — writes back to the same file. `Cmd/Ctrl+S`.
- **Live-reload** — a file watcher pushes external changes over a websocket; if
  you have unsaved edits it asks before discarding them.
- **Toggle** — `Cmd/Ctrl+E` flips Read ⇄ Edit.

## Install

Requires Node ≥ 18.

```bash
git clone https://github.com/anup-a/preview-artifact.git
cd preview-artifact
npm install
npm run build      # produces dist/ that the CLI serves
npm link           # makes `preview-artifact` available globally
```

## Usage

```bash
preview-artifact open path/to/file.md   # open in the browser
preview-artifact path/to/file.md        # shorthand
preview-artifact open file.md --no-open # start server without launching a browser
preview-artifact --help
```

Use it from any project — it's not tied to any particular repo.

## Use it from your coding agent

This tool is meant to be launched *by* your agent when it finishes writing an
artifact. The CLI runs a long-lived local server, so agents must launch it
**in the background**. See [`AGENTS.md`](./AGENTS.md) for the canonical agent
instructions; quick reference below.

### Claude Code

A `/preview-artifact` slash command ships in [`.claude/commands/`](./.claude/commands/).

- **Per-project:** it's auto-available when Claude Code is run inside this repo.
- **Global (any project):** copy it once —
  ```bash
  mkdir -p ~/.claude/commands
  cp .claude/commands/preview-artifact.md ~/.claude/commands/
  ```
  Then in any session: `/preview-artifact path/to/file.md`

### Codex / Cursor / Aider / shell-based agents

These read `AGENTS.md` automatically. They can launch it directly — no
backgrounding needed, the CLI self-daemonizes and returns immediately:

```bash
preview-artifact open path/to/file.md   # prints the URL, then returns
```

### Any agent without PATH access to the global bin

Invoke the entry script by absolute path:

```bash
node /absolute/path/to/preview-artifact/bin/preview-artifact.js open file.md
```

## How it works

One shared **daemon** serves every file; the file is passed as a `?path=` query
parameter rather than getting its own server/port. The CLI auto-starts the
daemon (detached) on first use, reuses it afterward, and records its port in
`~/.preview-artifact/daemon.json`.

```
bin/preview-artifact.js  CLI — ensures the daemon is up, opens /?path=<file>
server/index.mjs         daemon: serves the SPA, GET/PUT /api/file?path=,
                         GET /api/raw?path= (pdf bytes), /ws?path= live-reload
src/                     Vite + React SPA
  App.tsx                  orchestration: load, read/edit toggle, save, reload
  readview.ts              markdown-it + highlight.js + mermaid + KaTeX (read mode)
  Editor.tsx               Milkdown Crepe wrapper (markdown edit mode)
  frontmatter.ts           split/join YAML frontmatter so it never round-trips
.claude/commands/        Claude Code /preview-artifact slash command
AGENTS.md                instructions for coding agents
```

- Binds to `127.0.0.1` only and sets no CORS headers, so cross-origin pages
  can't read API responses or perform preflighted writes.
- Markdown frontmatter is sliced off before the editor sees the body and
  re-attached verbatim on save, so YAML survives editing untouched.

## Development

```bash
node server/index.mjs                 # start the daemon (default port 4317)
npm run dev                           # Vite dev server, proxies /api + /ws to 4317
# then open http://localhost:5173/?path=/abs/path/to/file.md
npm run typecheck
```

After any change under `src/`, run `npm run build` — the daemon serves the built
`dist/`, not live source.

## Scope

v1 is deliberately single-file. No directory browser, auth, multi-user, or
collaboration — git already handles history.

## License

MIT

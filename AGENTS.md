# AGENTS.md — preview-artifact

Guidance for coding agents (Claude Code, Codex, Cursor, Aider, etc.) working in
or using this repository.

## What this tool is

`preview-artifact` is a **local** CLI that opens an artifact in the browser with
a beautiful read view and (for text formats) a WYSIWYG/source edit mode that
**saves back to the same file** and **live-reloads** when the file changes on
disk. Built for the artifacts agents produce: plans, design docs, audit reports,
papers.

Supported file types:
- **`.md` / `.markdown`** — markdown with mermaid, syntax highlighting, GFM
  tables/task lists, and KaTeX math; edited via a WYSIWYG editor.
- **`.tex` / `.latex`** — display equations typeset by KaTeX with the rest as
  highlighted LaTeX source; edited as plain source.
- **`.pdf`** — embedded read-only viewer (no edit).

## How an agent should launch it for the user

The CLI starts a long-running local server, so **run it detached / in the
background** — never block on it.

```bash
preview-artifact open path/to/file.md
```

It prints the URL it bound to, e.g.:

```
[artifact-viewer] file.md → http://127.0.0.1:4317
```

- Read that first line of output to get the URL and report it to the user.
- The browser opens automatically; pass `--no-open` to suppress that.
- To stop it, kill the process (Ctrl-C / SIGTERM).

### Background-launch patterns by agent

- **Claude Code** — use the `/preview-artifact <file>` slash command (shipped in
  `.claude/commands/`), or run the Bash tool with `run_in_background: true`.
- **Codex / shell-based agents** — detach so it survives the turn:
  ```bash
  nohup preview-artifact open path/to/file.md >/tmp/preview-artifact.log 2>&1 &
  sleep 2 && grep -o 'http://[^ ]*' /tmp/preview-artifact.log | head -1
  ```
- **Any agent** — if `preview-artifact` isn't on PATH, the repo hasn't been
  linked; run `npm install && npm run build && npm link` here first.

## Prerequisites

- Node ≥ 18.
- One-time setup in this repo: `npm install && npm run build && npm link`.

## Working ON this repo (not just using it)

- After changing anything in `src/`, run `npm run build` — the server serves the
  built `dist/`, not live source. (`npm run dev` runs Vite for hot-reload dev.)
- `npm run typecheck` must pass before committing.
- Keep frontmatter handling in `src/frontmatter.ts` intact: YAML is split off
  before the editor sees the body and re-attached verbatim on save. This is what
  prevents the WYSIWYG editor from corrupting frontmatter. Don't route
  frontmatter through Milkdown.
- Read mode (`src/readview.ts`) and edit mode (`src/Editor.tsx`) are deliberately
  separate render paths. Mermaid renders in read mode only.

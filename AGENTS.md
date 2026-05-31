# AGENTS.md — Pretifact

Guidance for coding agents (Claude Code, Codex, Cursor, Aider, etc.) working in
or using this repository.

## What this tool is

`pretifact` is a **local** CLI that opens an artifact in the browser with
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

Just run it — **no backgrounding needed.** A single shared daemon serves every
file; the CLI auto-starts it (detached) on first use, reuses it afterward, and
**returns immediately** after printing the URL:

```bash
pretifact open path/to/file.md
```

Prints, e.g.:

```
[pretifact] file.md → http://127.0.0.1:4317/?path=%2Fabs%2Fpath%2Ffile.md
```

- Read that line to get the URL and report it to the user.
- The browser opens automatically; pass `--no-open` to suppress it.
- Opening more files reuses the same daemon (different `?path=`).
- `pretifact stop` shuts the daemon down. State: `~/.pretifact/`.

### Notes by agent

- **Claude Code** — install the skill (`npx skills add anup-a/preview-artifact`
  or the plugin marketplace); it auto-invokes. Or just call the CLI via Bash.
- **Codex / shell-based agents** — run `pretifact open <file>` directly;
  it daemonizes itself, so no `nohup &` is required.
- **Any agent** — if `pretifact` isn't on PATH, install it:
  `npm install -g pretifact`.

## Prerequisites

- Node ≥ 18.
- Install once: `npm install -g pretifact` (or `npm link` from a clone
  when developing this repo).

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

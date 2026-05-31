---
name: preview-artifact
description: Open an artifact (a Markdown/LaTeX/PDF/image plan, design doc, report, or paper) in a local browser viewer with beautiful formatting the user can read and edit, instead of dumping it into chat. Use when the user asks to preview, open, view, or render a file/artifact, or right after you generate a plan or document the user should review.
---

# Pretifact

Open artifacts in the local **Pretifact** viewer — a warm, editorial,
light/dark reading surface with a WYSIWYG editor — rather than pasting long
content into the chat.

## When to use

- The user says "preview/open/view/render this", "let me read it in the browser",
  "show me the plan nicely", or similar.
- You just wrote a plan, design doc, report, or `.md`/`.tex`/`.pdf` the user
  should review — offer to open it.

## When NOT to use

- The user wants the content inline in chat, or it's a one-line snippet.

## How

1. Determine the file path. If you just created it, use that path; otherwise ask
   which file. Supported: `.md` / `.markdown`, `.tex` / `.latex`, `.pdf`, and
   images (`.png`, `.jpg`, `.svg`, …).
2. Run it with a normal (foreground) shell call — it auto-starts a shared
   background daemon, returns immediately, and prints the URL:
   ```bash
   pretifact open "<path>"
   ```
   You can pass **several files at once** to load them into the viewer's side
   panel (the user can switch between them):
   ```bash
   pretifact open plan.md design.md report.pdf
   ```
3. If `pretifact` is not found, install it once, then retry:
   ```bash
   npm install -g pretifact
   ```
4. Report the printed URL (`http://127.0.0.1:PORT/?path=…`). The browser opens
   automatically; if not, the user can click it. Markdown and LaTeX **edit, save
   back to disk, and live-reload**; PDFs and images are read-only.

Opening more files reuses the same daemon. `pretifact stop` shuts it down.

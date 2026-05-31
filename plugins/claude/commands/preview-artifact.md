---
description: Open a markdown/LaTeX/PDF artifact in the browser — beautiful read view + WYSIWYG/source edit, saves back to disk, live-reloads on change
argument-hint: <path-to-file>
allowed-tools: Bash, Read
---

Open the artifact in the local **preview-artifact** viewer.

Target file: `$ARGUMENTS`

Steps:

1. If `$ARGUMENTS` is empty, ask the user which file to open (offer any recent
   `.md` / `.tex` / `.pdf` you've been working with), then stop.
2. Confirm the file exists with `test -f "$ARGUMENTS"`. If it doesn't, say so and stop.
3. Run the CLI with a normal (foreground) Bash call — it auto-starts a shared
   background daemon, returns immediately, and prints the URL:
   ```
   preview-artifact open "$ARGUMENTS"
   ```
   If `preview-artifact` isn't on PATH, it isn't installed — tell the user to
   `git clone https://github.com/anup-a/preview-artifact && cd preview-artifact
   && npm install && npm run build && npm link`, then retry.
4. Report the printed URL (`[preview-artifact] file → http://127.0.0.1:PORT/?path=…`).
   The browser opens automatically; if not, the user can click it. Mention that
   text files (`.md`/`.tex`) edit and save back to disk and live-reload on change;
   PDFs are read-only.

Keep the reply short: confirm it's open and give the URL.

---
description: Open a markdown artifact in the browser — beautiful read view + WYSIWYG edit, saves back to disk, live-reloads on change
argument-hint: <path-to-markdown-file>
allowed-tools: Bash, Read
---

Open the markdown artifact in the local **artifact-viewer** (`preview-artifact` CLI).

Target file: `$ARGUMENTS`

Steps:

1. If `$ARGUMENTS` is empty, ask the user which markdown file to open (offer any
   recent `*.md` you've been working with), then stop.
2. Confirm the file exists with `test -f "$ARGUMENTS"`. If it doesn't, say so and stop.
3. Launch the viewer **in the background** (Bash tool with `run_in_background: true`)
   so it keeps serving after this turn:
   ```
   preview-artifact open "$ARGUMENTS"
   ```
   If `preview-artifact` isn't on PATH, the project hasn't been linked — tell the
   user to run `npm install && npm run build && npm link` in the artifact-viewer
   repo (see its README), then retry.
4. Wait ~2 seconds, then read the background task's output. It prints a line like:
   `[artifact-viewer] file.md → http://127.0.0.1:4317`
5. Report that URL. The browser opens automatically; if it didn't, the user can
   click the URL. Mention that edits save back to the file and the page
   live-reloads whenever the file changes on disk.

Keep the reply short: confirm it's open and give the URL.

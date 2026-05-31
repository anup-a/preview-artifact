Open the file `$ARGUMENTS` in the local **Pretifact** viewer.

1. Confirm it exists (`test -f "$ARGUMENTS"`). If not, say so and stop.
2. Run this in the shell — it auto-starts a shared background daemon, returns
   immediately, and prints the URL (no need to background it yourself):

   ```
   pretifact open "$ARGUMENTS"
   ```

   If `pretifact` is not found, it isn't installed: run
   `npm install -g pretifact`, then retry.
3. Report the printed URL (`http://127.0.0.1:PORT/?path=…`). The browser opens
   automatically. `.md`/`.tex` files edit, save back to disk, and live-reload;
   PDFs are read-only.

Keep the reply short: confirm it's open and give the URL.

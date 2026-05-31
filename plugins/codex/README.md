# preview-artifact — Codex integration

Codex doesn't have a formal plugin format, but it reads **custom prompts** (slash
commands) and **`AGENTS.md`**. This gives Codex a `/preview-artifact` command.

## Install

1. Make sure the CLI is installed: `npm install -g preview-artifact`.
2. Copy the prompt into your Codex prompts directory:

   ```bash
   mkdir -p ~/.codex/prompts
   cp prompts/preview-artifact.md ~/.codex/prompts/
   ```

3. In Codex, run:

   ```
   /preview-artifact path/to/file.md
   ```

That's it — Codex runs `preview-artifact open …`, which self-daemonizes and
prints the local URL. The repo's top-level `AGENTS.md` also teaches any
agent (Codex, Cursor, Aider, …) how to launch the viewer without a prompt.

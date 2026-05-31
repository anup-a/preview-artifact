import { useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "./Editor";
import { renderMarkdown, runMermaid } from "./readview";
import { splitFrontmatter, joinFrontmatter } from "./frontmatter";
import { fetchFile, saveFile, watchFile } from "./api";

type Mode = "read" | "edit";
type SaveState = "idle" | "saving" | "saved" | "error";

export function App() {
  const [path, setPath] = useState<string>("");
  const [frontmatter, setFrontmatter] = useState<string | null>(null);
  const [body, setBody] = useState<string>("");
  const [mode, setMode] = useState<Mode>("read");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  // A newer version arrived on disk while we had unsaved edits.
  const [pendingReload, setPendingReload] = useState<string | null>(null);
  // editKey forces the Crepe editor to remount when we load fresh content.
  const [editKey, setEditKey] = useState(0);

  const readRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const applyContent = useCallback((content: string) => {
    const split = splitFrontmatter(content);
    setFrontmatter(split.frontmatter);
    setBody(split.body);
    setDirty(false);
    setPendingReload(null);
    setEditKey((k) => k + 1);
  }, []);

  // Initial load.
  useEffect(() => {
    fetchFile()
      .then((payload) => {
        setPath(payload.path);
        applyContent(payload.content);
      })
      .catch((err) => setLoadError(String(err)));
  }, [applyContent]);

  // Live-reload subscription.
  useEffect(() => {
    return watchFile((msg) => {
      if (dirtyRef.current) {
        setPendingReload(msg.content); // ask before discarding edits
      } else {
        applyContent(msg.content);
      }
    });
  }, [applyContent]);

  // Render read-mode HTML + mermaid whenever the body changes in read mode.
  useEffect(() => {
    if (mode !== "read" || !readRef.current) return;
    readRef.current.innerHTML = renderMarkdown(body);
    void runMermaid(readRef.current);
  }, [mode, body]);

  const save = useCallback(async () => {
    setSaveState("saving");
    try {
      const raw = joinFrontmatter(frontmatter, body);
      await saveFile(raw);
      setDirty(false);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("error");
    }
  }, [frontmatter, body]);

  const onBodyChange = useCallback((markdown: string) => {
    setBody(markdown);
    setDirty(true);
  }, []);

  const onFrontmatterChange = useCallback((value: string) => {
    setFrontmatter(value);
    setDirty(true);
  }, []);

  // Keyboard: Cmd/Ctrl+S to save, Cmd/Ctrl+E to toggle mode.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirtyRef.current) void save();
      } else if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setMode((m) => (m === "read" ? "edit" : "read"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  if (loadError) {
    return <div className="error-screen">Could not load file:<br />{loadError}</div>;
  }

  const fileName = path.split("/").pop() ?? path;

  return (
    <div className="app">
      <header className="toolbar">
        <div className="file-info">
          <span className="file-name">{fileName}</span>
          <span className="file-path" title={path}>{path}</span>
        </div>
        <div className="toolbar-actions">
          <StatusPill dirty={dirty} saveState={saveState} />
          <div className="mode-switch" role="tablist">
            <button
              role="tab"
              aria-selected={mode === "read"}
              className={mode === "read" ? "active" : ""}
              onClick={() => setMode("read")}
            >
              Read
            </button>
            <button
              role="tab"
              aria-selected={mode === "edit"}
              className={mode === "edit" ? "active" : ""}
              onClick={() => setMode("edit")}
            >
              Edit
            </button>
          </div>
          <button className="save-btn" disabled={!dirty} onClick={() => void save()}>
            Save
          </button>
        </div>
      </header>

      {pendingReload !== null && (
        <div className="reload-banner">
          This file changed on disk and you have unsaved edits.
          <button onClick={() => applyContent(pendingReload)}>Reload (discard mine)</button>
          <button onClick={() => setPendingReload(null)}>Keep my edits</button>
        </div>
      )}

      <main className="content">
        {mode === "read" ? (
          <article ref={readRef} className="markdown-body read-view" />
        ) : (
          <div className="edit-view">
            {frontmatter !== null && (
              <details className="frontmatter-panel" open>
                <summary>frontmatter (yaml)</summary>
                <textarea
                  className="frontmatter-input"
                  value={frontmatter}
                  spellCheck={false}
                  onChange={(e) => onFrontmatterChange(e.target.value)}
                />
              </details>
            )}
            <Editor key={editKey} defaultValue={body} onChange={onBodyChange} />
          </div>
        )}
      </main>
    </div>
  );
}

function StatusPill({ dirty, saveState }: { dirty: boolean; saveState: SaveState }) {
  if (saveState === "saving") return <span className="status saving">Saving…</span>;
  if (saveState === "error") return <span className="status error">Save failed</span>;
  if (saveState === "saved") return <span className="status saved">Saved ✓</span>;
  if (dirty) return <span className="status dirty">Unsaved changes</span>;
  return <span className="status clean">Up to date</span>;
}

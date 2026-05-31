import { useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "./Editor";
import { renderMarkdown, renderTex, runMermaid } from "./readview";
import { splitFrontmatter, joinFrontmatter } from "./frontmatter";
import { fetchFile, saveFile, watchFile, rawUrl, type FileKind } from "./api";

type Mode = "read" | "edit";
type SaveState = "idle" | "saving" | "saved" | "error";

export function App() {
  const [path, setPath] = useState<string>("");
  const [kind, setKind] = useState<FileKind>("markdown");
  const [frontmatter, setFrontmatter] = useState<string | null>(null);
  const [body, setBody] = useState<string>("");
  const [mode, setMode] = useState<Mode>("read");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingReload, setPendingReload] = useState<string | null>(null);
  const [editKey, setEditKey] = useState(0);
  // Cache-buster for the PDF <iframe> so external changes reload it.
  const [rawVersion, setRawVersion] = useState(0);

  const readRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const kindRef = useRef(kind);
  kindRef.current = kind;

  const applyDoc = useCallback((k: FileKind, content: string | undefined) => {
    setKind(k);
    if (k === "markdown") {
      const split = splitFrontmatter(content ?? "");
      setFrontmatter(split.frontmatter);
      setBody(split.body);
    } else {
      setFrontmatter(null);
      setBody(content ?? "");
    }
    setDirty(false);
    setPendingReload(null);
    setEditKey((n) => n + 1);
  }, []);

  // Initial load.
  useEffect(() => {
    fetchFile()
      .then((payload) => {
        setPath(payload.path);
        setRawVersion(payload.mtimeMs);
        applyDoc(payload.kind, payload.content);
      })
      .catch((err) => setLoadError(String(err)));
  }, [applyDoc]);

  // Live-reload subscription.
  useEffect(() => {
    return watchFile((msg) => {
      if (kindRef.current === "pdf") {
        setRawVersion(msg.mtimeMs); // reload the iframe
      } else if (dirtyRef.current) {
        setPendingReload(msg.content ?? ""); // ask before discarding edits
      } else {
        applyDoc(kindRef.current, msg.content);
      }
    });
  }, [applyDoc]);

  // Render read-mode HTML when body/kind/mode change (markdown + tex only).
  useEffect(() => {
    if (mode !== "read" || kind === "pdf" || !readRef.current) return;
    readRef.current.innerHTML =
      kind === "tex" ? renderTex(body) : renderMarkdown(body);
    if (kind === "markdown") void runMermaid(readRef.current);
  }, [mode, body, kind]);

  const save = useCallback(async () => {
    setSaveState("saving");
    try {
      const raw = kind === "markdown" ? joinFrontmatter(frontmatter, body) : body;
      await saveFile(raw);
      setDirty(false);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("error");
    }
  }, [kind, frontmatter, body]);

  const onBodyChange = useCallback((markdown: string) => {
    setBody(markdown);
    setDirty(true);
  }, []);

  const onFrontmatterChange = useCallback((value: string) => {
    setFrontmatter(value);
    setDirty(true);
  }, []);

  // Keyboard: Cmd/Ctrl+S save, Cmd/Ctrl+E toggle (not for pdf).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirtyRef.current) void save();
      } else if (mod && e.key.toLowerCase() === "e" && kindRef.current !== "pdf") {
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
  const editable = kind !== "pdf";

  return (
    <div className="app">
      <header className="toolbar">
        <div className="file-info">
          <span className="file-name">{fileName}</span>
          <span className="file-path" title={path}>{path}</span>
        </div>
        <div className="toolbar-actions">
          {mode === "edit" && editable && <span className="edit-pill">Editing</span>}
          {kind === "pdf" ? (
            <span className="status clean">PDF · read-only</span>
          ) : (
            <StatusPill dirty={dirty} saveState={saveState} />
          )}
          {editable && (
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
          )}
          {editable && (
            <button className="save-btn" disabled={!dirty} onClick={() => void save()}>
              Save
            </button>
          )}
        </div>
      </header>

      {pendingReload !== null && (
        <div className="reload-banner">
          This file changed on disk and you have unsaved edits.
          <button onClick={() => applyDoc(kind, pendingReload)}>Reload (discard mine)</button>
          <button onClick={() => setPendingReload(null)}>Keep my edits</button>
        </div>
      )}

      <main className={"content" + (kind === "pdf" ? " content--pdf" : "")}>
        {kind === "pdf" ? (
          <iframe className="pdf-view" title={fileName} src={rawUrl(rawVersion)} />
        ) : mode === "read" ? (
          <article ref={readRef} className="markdown-body read-view" />
        ) : kind === "tex" ? (
          <div className="edit-view">
            <textarea
              className="source-input"
              value={body}
              spellCheck={false}
              onChange={(e) => onBodyChange(e.target.value)}
            />
          </div>
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

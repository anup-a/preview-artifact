import { useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "./Editor";
import { Lightbox, type ZoomContent } from "./Lightbox";
import { Toc, type TocItem } from "./Toc";
import { renderMarkdown, renderTex, runMermaid } from "./readview";
import { splitFrontmatter, joinFrontmatter } from "./frontmatter";
import {
  fetchFile,
  saveFile,
  watchFile,
  rawUrl,
  assetUrl,
  fileDir,
  type FileKind,
} from "./api";
import { fetchArtifacts, type Artifacts } from "./api";
import { getTheme, applyTheme, type Theme } from "./theme";
import { Sidebar } from "./Sidebar";

// Rewrite local/relative <img> sources so they load through the daemon
// (remote http(s)/data/blob URLs are left untouched).
function resolveImages(container: HTMLElement): void {
  container.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (!src || /^(https?:|data:|blob:)/i.test(src)) return;
    const abs = src.startsWith("/") ? src : `${fileDir}/${src}`;
    img.setAttribute("src", assetUrl(abs));
  });
}

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
  const [theme, setTheme] = useState<Theme>(getTheme);
  const [artifacts, setArtifacts] = useState<Artifacts>({ opened: [], recents: [] });
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem("pa-sidebar") === "1", // closed by default
  );
  const [zoom, setZoom] = useState<ZoomContent | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);

  // Click-to-zoom: open embedded images and rendered mermaid diagrams in the
  // full-screen lightbox. Event delegation covers mermaid SVGs that are
  // inserted asynchronously after the initial render.
  const onReadClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const img = target.closest("img");
    if (img) {
      setZoom({ type: "img", src: img.src, alt: img.alt });
      return;
    }
    const svg = target.closest("pre.mermaid svg");
    if (svg) setZoom({ type: "svg", markup: svg.outerHTML });
  }, []);

  const setSidebar = useCallback((open: boolean) => {
    setSidebarOpen(open);
    localStorage.setItem("pa-sidebar", open ? "1" : "0");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((cur) => {
      const next: Theme = cur === "light" ? "dark" : "light";
      applyTheme(next);
      return next;
    });
  }, []);

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
      if (kindRef.current === "pdf" || kindRef.current === "image") {
        setRawVersion(msg.mtimeMs); // reload the iframe/image
      } else if (dirtyRef.current) {
        setPendingReload(msg.content ?? ""); // ask before discarding edits
      } else {
        applyDoc(kindRef.current, msg.content);
      }
    });
  }, [applyDoc]);

  // Load the artifacts panel once. The order only changes on refresh/navigation
  // (clicking an item reloads), not reactively — keeps the list stable to read.
  useEffect(() => {
    fetchArtifacts().then(setArtifacts).catch(() => {});
  }, []);

  // Render read-mode HTML when body/kind/mode change (markdown + tex only).
  useEffect(() => {
    if (mode !== "read" || kind === "pdf" || kind === "image" || !readRef.current) {
      setToc([]);
      return;
    }
    readRef.current.innerHTML =
      kind === "tex" ? renderTex(body) : renderMarkdown(body);
    resolveImages(readRef.current);
    if (kind === "markdown") {
      void runMermaid(readRef.current);
      // Build the TOC from the headings markdown-it-anchor just gave ids to.
      const headings = Array.from(
        readRef.current.querySelectorAll<HTMLElement>("h1, h2, h3, h4"),
      );
      setToc(
        headings
          .filter((h) => h.id)
          .map((h) => ({ id: h.id, text: h.textContent ?? "", level: Number(h.tagName[1]) })),
      );
    } else {
      setToc([]);
    }
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
      } else if (
        mod &&
        e.key.toLowerCase() === "e" &&
        (kindRef.current === "markdown" || kindRef.current === "tex")
      ) {
        e.preventDefault();
        setMode((m) => (m === "read" ? "edit" : "read"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  const fileName = path ? (path.split("/").pop() ?? path) : "preview-artifact";
  const editable = !loadError && (kind === "markdown" || kind === "tex");
  const binary = kind === "pdf" || kind === "image";

  return (
    <div className="app">
      {sidebarOpen && (
        <Sidebar artifacts={artifacts} currentPath={path} onClose={() => setSidebar(false)} />
      )}
      <div className="main">
        {mode === "read" && kind === "markdown" && toc.length >= 2 && <Toc items={toc} />}
        <header className="toolbar">
          <div className="file-info">
            {!sidebarOpen && (
              <button className="icon-btn" onClick={() => setSidebar(true)} title="Show panel" aria-label="Show panel">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M3 12h18M3 18h18" />
                </svg>
              </button>
            )}
            <span className="file-name">{fileName}</span>
            {path && <span className="file-path" title={path}>{path}</span>}
          </div>
          <div className="toolbar-actions">
            {!loadError && mode === "edit" && editable && <span className="edit-pill">Editing</span>}
            {loadError ? null : binary ? (
              <span className="status clean">
                {kind === "pdf" ? "PDF" : "Image"} · read-only
              </span>
            ) : (
              <StatusPill dirty={dirty} saveState={saveState} />
            )}
            <button
              className="icon-btn"
              onClick={toggleTheme}
              title={theme === "light" ? "Switch to dark" : "Switch to light"}
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              )}
            </button>
            {editable && (
              <div className="mode-switch" role="tablist">
                <button role="tab" aria-selected={mode === "read"} className={mode === "read" ? "active" : ""} onClick={() => setMode("read")}>
                  Read
                </button>
                <button role="tab" aria-selected={mode === "edit"} className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>
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

        <main className={"content" + (!loadError && kind === "pdf" ? " content--pdf" : "")}>
          {loadError ? (
            <div className="empty-state">
              <p>No artifact open.</p>
              <p className="empty-hint">Pick one from the panel, or run <code>preview-artifact open &lt;file&gt;</code>.</p>
            </div>
          ) : kind === "pdf" ? (
            <iframe className="pdf-view" title={fileName} src={rawUrl(rawVersion)} />
          ) : kind === "image" ? (
            <img
              className="image-view"
              alt={fileName}
              src={rawUrl(rawVersion)}
              onClick={() => setZoom({ type: "img", src: rawUrl(rawVersion), alt: fileName })}
            />
          ) : mode === "read" ? (
            <article ref={readRef} className="markdown-body read-view" onClick={onReadClick} />
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
      {zoom && <Lightbox content={zoom} onClose={() => setZoom(null)} />}
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

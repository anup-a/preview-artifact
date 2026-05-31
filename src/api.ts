// Thin client for the local daemon. The file to view is taken from the page's
// `?path=` query parameter and forwarded to every endpoint, so one daemon can
// serve any number of files.

export type FileKind = "markdown" | "tex" | "pdf" | "image";

export interface FilePayload {
  path: string;
  kind: FileKind;
  /** Absent for binary kinds (pdf) — fetch those via rawUrl(). */
  content?: string;
  mtimeMs: number;
}

/** Absolute path of the file this page is viewing (from the URL). */
export const filePath = new URLSearchParams(location.search).get("path") ?? "";

const pathParam = `path=${encodeURIComponent(filePath)}`;

/** URL for the raw bytes of the file (used to embed PDFs). */
export function rawUrl(version: number | string): string {
  return `/api/raw?${pathParam}&v=${version}`;
}

/** URL serving the raw bytes of an arbitrary local file (e.g. an image). */
export function assetUrl(absPath: string): string {
  return `/api/raw?path=${encodeURIComponent(absPath)}`;
}

/** Directory containing the current file (for resolving relative asset paths). */
export const fileDir = filePath.slice(0, filePath.lastIndexOf("/"));

export async function fetchFile(): Promise<FilePayload> {
  if (!filePath) throw new Error("No file specified (missing ?path= in URL)");
  const res = await fetch(`/api/file?${pathParam}`);
  if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
  return res.json();
}

export async function saveFile(content: string): Promise<{ mtimeMs: number }> {
  const res = await fetch(`/api/file?${pathParam}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Failed to save file: ${res.status}`);
  return res.json();
}

export type ReloadMessage = { type: "reload"; content?: string; mtimeMs: number };

/** Subscribe to external file changes. Returns an unsubscribe function. */
export function watchFile(onReload: (msg: ReloadMessage) => void): () => void {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws?${pathParam}`);
  ws.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg?.type === "reload") onReload(msg);
    } catch {
      /* ignore malformed frames */
    }
  });
  return () => ws.close();
}

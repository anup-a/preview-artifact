// Thin client for the local Fastify server. All requests are same-origin
// (the server serves this SPA), so no base URL or auth is needed.

export type FileKind = "markdown" | "tex" | "pdf";

export interface FilePayload {
  path: string;
  kind: FileKind;
  /** Absent for binary kinds (pdf) — fetch those via /api/raw. */
  content?: string;
  mtimeMs: number;
}

export async function fetchFile(): Promise<FilePayload> {
  const res = await fetch("/api/file");
  if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
  return res.json();
}

export async function saveFile(content: string): Promise<{ mtimeMs: number }> {
  const res = await fetch("/api/file", {
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
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
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

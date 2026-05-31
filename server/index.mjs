// preview-artifact daemon.
//
// A single long-lived local server that can view ANY file passed as a `?path=`
// query parameter — no more one-server-per-file. The CLI (bin/preview-artifact.js)
// starts this once, then every `open` just points the browser at
// http://127.0.0.1:<port>/?path=<absolute-file>.
//
// Security: binds to 127.0.0.1 only and sets no CORS headers, so cross-origin
// web pages cannot read API responses (opaque) or perform preflighted writes.

import { readFile, writeFile, stat, mkdir, rm } from "node:fs/promises";
import { existsSync, statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import chokidar from "chokidar";

const distDir = fileURLToPath(new URL("../dist", import.meta.url));
if (!existsSync(distDir)) {
  console.error(`[preview-artifact] missing build output: ${distDir}\nRun: npm run build`);
  process.exit(1);
}

const STATE_DIR = path.join(os.homedir(), ".preview-artifact");
const STATE_FILE = path.join(STATE_DIR, "daemon.json");

const IMAGE_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".bmp", ".ico",
]);
function kindOf(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === ".tex" || ext === ".latex") return "tex";
  return "markdown";
}

// Editable text kinds (everything else — pdf, image — is binary/read-only).
const isTextKind = (kind) => kind === "markdown" || kind === "tex";

// Content-type for raw assets (PDFs and images embedded by markdown).
const MIME = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};
function mimeOf(file) {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

function isValidFile(p) {
  if (typeof p !== "string" || !p || !path.isAbsolute(p) || !existsSync(p)) return false;
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

// ---- Artifacts panel state ----
// `opened`: paths registered this daemon run (the session working set).
// `recents`: persisted history across restarts.
const RECENTS_FILE = path.join(STATE_DIR, "recents.json");
const RECENTS_MAX = 40;
let opened = []; // abs paths, most-recent first
let recents = []; // [{ path, ts }], most-recent first
const panelSockets = new Set();

function loadRecents() {
  try {
    const data = JSON.parse(readFileSync(RECENTS_FILE, "utf8"));
    if (Array.isArray(data)) recents = data.filter((r) => r && typeof r.path === "string");
  } catch {
    /* none yet */
  }
}

async function saveRecents() {
  try {
    await mkdir(STATE_DIR, { recursive: true });
    await writeFile(RECENTS_FILE, JSON.stringify(recents.slice(0, RECENTS_MAX)));
  } catch (err) {
    console.error("[preview-artifact] recents save error:", err);
  }
}

function artifactInfo(p) {
  return { path: p, name: path.basename(p), kind: kindOf(p) };
}

function registerArtifacts(paths, ts) {
  let changed = false;
  for (const p of paths) {
    if (!isValidFile(p)) continue;
    changed = true;
    opened = [p, ...opened.filter((x) => x !== p)];
    recents = [{ path: p, ts }, ...recents.filter((r) => r.path !== p)].slice(0, RECENTS_MAX);
  }
  if (changed) {
    void saveRecents();
    broadcastPanel();
  }
}

function broadcastPanel() {
  const frame = JSON.stringify({ type: "artifacts" });
  for (const socket of panelSockets) {
    try {
      socket.send(frame);
    } catch {
      /* drop */
    }
  }
}

// Per-path state: a lazily-created file watcher and its subscribed sockets.
const entries = new Map(); // absPath -> { watcher, sockets:Set, lastWritten:string|null }

function getEntry(absPath) {
  let e = entries.get(absPath);
  if (!e) {
    e = { watcher: null, sockets: new Set(), lastWritten: null };
    entries.set(absPath, e);
  }
  return e;
}

function ensureWatch(absPath) {
  const e = getEntry(absPath);
  if (e.watcher) return e;
  const isText = isTextKind(kindOf(absPath));
  e.watcher = chokidar.watch(absPath, { ignoreInitial: true });
  e.watcher.on("change", async () => {
    try {
      const info = await stat(absPath);
      let frame;
      if (isText) {
        const content = await readFile(absPath, "utf8");
        if (content === e.lastWritten) return; // our own save, ignore
        frame = JSON.stringify({ type: "reload", content, mtimeMs: info.mtimeMs });
      } else {
        frame = JSON.stringify({ type: "reload", mtimeMs: info.mtimeMs });
      }
      for (const socket of e.sockets) {
        try {
          socket.send(frame);
        } catch {
          /* drop dead sockets silently */
        }
      }
    } catch (err) {
      console.error("[preview-artifact] watch error:", err);
    }
  });
  return e;
}

const fastify = Fastify({ logger: false });
await fastify.register(fastifyWebsocket);
await fastify.register(fastifyStatic, { root: distDir });

// Health check with an app signature so the CLI can tell it's really us.
fastify.get("/api/health", async () => ({ app: "preview-artifact", ok: true }));

// The sidebar's two sections: this session's open artifacts + recent history.
fastify.get("/api/artifacts", async () => {
  const openInfos = opened.filter(isValidFile).map(artifactInfo);
  const openSet = new Set(opened);
  const recentInfos = recents
    .map((r) => r.path)
    .filter((p) => !openSet.has(p) && isValidFile(p))
    .map(artifactInfo);
  return { opened: openInfos, recents: recentInfos };
});

// CLI registers artifacts here so they appear in the panel.
fastify.post("/api/register", async (request) => {
  const paths = Array.isArray(request.body?.paths) ? request.body.paths : [];
  registerArtifacts(paths, Date.now());
  return { ok: true };
});

fastify.get("/api/file", async (request, reply) => {
  const p = String(request.query?.path ?? "");
  if (!isValidFile(p)) {
    reply.code(400);
    return { error: "invalid or missing path" };
  }
  registerArtifacts([p], Date.now()); // viewing a file also tracks it
  const info = await stat(p);
  const kind = kindOf(p);
  if (!isTextKind(kind)) {
    // Binary kinds (pdf, image) are fetched via /api/raw, not inlined.
    return { path: p, kind, mtimeMs: info.mtimeMs };
  }
  const content = await readFile(p, "utf8");
  return { path: p, kind, content, mtimeMs: info.mtimeMs };
});

// Raw bytes of a file (used to embed PDFs).
fastify.get("/api/raw", async (request, reply) => {
  const p = String(request.query?.path ?? "");
  if (!isValidFile(p)) {
    reply.code(400);
    return reply.send({ error: "invalid or missing path" });
  }
  const buf = await readFile(p);
  reply.header("Cache-Control", "no-store").type(mimeOf(p));
  return reply.send(buf);
});

fastify.put("/api/file", async (request, reply) => {
  const p = String(request.query?.path ?? "");
  if (!isValidFile(p)) {
    reply.code(400);
    return { error: "invalid or missing path" };
  }
  if (!isTextKind(kindOf(p))) {
    reply.code(400);
    return { error: `cannot edit a ${kindOf(p)} file` };
  }
  const { content } = request.body ?? {};
  if (typeof content !== "string") {
    reply.code(400);
    return { error: "content must be a string" };
  }
  getEntry(p).lastWritten = content;
  await writeFile(p, content, "utf8");
  const info = await stat(p);
  return { mtimeMs: info.mtimeMs };
});

// Panel updates: notified whenever the open/recent artifact lists change.
fastify.get("/ws/panel", { websocket: true }, (connection) => {
  const socket = connection.socket ?? connection;
  panelSockets.add(socket);
  socket.on("close", () => panelSockets.delete(socket));
});

fastify.get("/ws", { websocket: true }, (connection, request) => {
  // @fastify/websocket v11 passes the socket directly; older versions nest it.
  const socket = connection.socket ?? connection;
  const p = String(request.query?.path ?? "");
  if (!isValidFile(p)) {
    socket.close();
    return;
  }
  const entry = ensureWatch(p);
  entry.sockets.add(socket);
  socket.on("close", () => {
    entry.sockets.delete(socket);
    // Tear down the watcher when nobody is viewing this file anymore.
    if (entry.sockets.size === 0 && entry.watcher) {
      entry.watcher.close();
      entry.watcher = null;
    }
  });
});

// SPA fallback: any non-API route serves index.html.
fastify.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith("/api") || request.url.startsWith("/ws")) {
    reply.code(404).send({ error: "not found" });
    return;
  }
  reply.sendFile("index.html");
});

async function listenOnFreePort(start, attempts = 20) {
  for (let port = start; port < start + attempts; port++) {
    try {
      await fastify.listen({ port, host: "127.0.0.1" });
      return port;
    } catch (err) {
      if (err.code === "EADDRINUSE") continue;
      throw err;
    }
  }
  throw new Error(`No free port in range ${start}-${start + attempts}`);
}

loadRecents();
const port = await listenOnFreePort(Number(process.env.ARTIFACT_PORT) || 4317);
await mkdir(STATE_DIR, { recursive: true });
await writeFile(STATE_FILE, JSON.stringify({ port, pid: process.pid }));
console.log(`[preview-artifact] daemon listening on http://127.0.0.1:${port}`);

const shutdown = async () => {
  for (const entry of entries.values()) {
    if (entry.watcher) await entry.watcher.close();
  }
  await rm(STATE_FILE, { force: true }).catch(() => {});
  await fastify.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

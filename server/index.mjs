// Local server for artifact-viewer. Serves the built SPA and exposes a tiny
// API to read/save the single target file, plus a websocket that pushes
// external file changes to the browser for live-reload.
//
// The target file path comes from the ARTIFACT_FILE env var (set by bin/artifact.js).

import { readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import chokidar from "chokidar";
import open from "open";

const targetFile = process.env.ARTIFACT_FILE
  ? path.resolve(process.env.ARTIFACT_FILE)
  : null;

if (!targetFile || !existsSync(targetFile)) {
  console.error(`[artifact-viewer] file not found: ${targetFile ?? "(none provided)"}`);
  process.exit(1);
}

// File kind drives how the client renders/edits it.
function kindOf(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".tex" || ext === ".latex") return "tex";
  return "markdown"; // .md, .markdown, and anything else (best-effort)
}
const fileKind = kindOf(targetFile);
const isText = fileKind !== "pdf";

const distDir = fileURLToPath(new URL("../dist", import.meta.url));
if (!existsSync(distDir)) {
  console.error(`[artifact-viewer] missing build output: ${distDir}\nRun: npm run build`);
  process.exit(1);
}

// Tracks the bytes we last wrote ourselves, so we don't echo our own saves
// back to the browser as an external "reload" event.
let lastWritten = null;

const fastify = Fastify({ logger: false });
await fastify.register(fastifyWebsocket);
await fastify.register(fastifyStatic, { root: distDir });

const sockets = new Set();

fastify.get("/api/file", async () => {
  const info = await stat(targetFile);
  // Binary kinds (pdf) are fetched via /api/raw, not inlined as text.
  if (!isText) {
    return { path: targetFile, kind: fileKind, mtimeMs: info.mtimeMs };
  }
  const content = await readFile(targetFile, "utf8");
  return { path: targetFile, kind: fileKind, content, mtimeMs: info.mtimeMs };
});

// Raw bytes of the target file (used to embed PDFs).
fastify.get("/api/raw", async (_request, reply) => {
  const buf = await readFile(targetFile);
  const type = fileKind === "pdf" ? "application/pdf" : "application/octet-stream";
  reply.header("Cache-Control", "no-store").type(type);
  return reply.send(buf);
});

fastify.put("/api/file", async (request, reply) => {
  if (!isText) {
    reply.code(400);
    return { error: `cannot edit a ${fileKind} file` };
  }
  const { content } = request.body ?? {};
  if (typeof content !== "string") {
    reply.code(400);
    return { error: "content must be a string" };
  }
  lastWritten = content;
  await writeFile(targetFile, content, "utf8");
  const info = await stat(targetFile);
  return { mtimeMs: info.mtimeMs };
});

fastify.get("/ws", { websocket: true }, (connection) => {
  // @fastify/websocket v11 passes the socket directly; older versions nest it.
  const socket = connection.socket ?? connection;
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});

// SPA fallback: any non-API route serves index.html.
fastify.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith("/api") || request.url.startsWith("/ws")) {
    reply.code(404).send({ error: "not found" });
    return;
  }
  reply.sendFile("index.html");
});

// Watch the target file for external edits (e.g. an agent rewriting it).
const watcher = chokidar.watch(targetFile, { ignoreInitial: true });
watcher.on("change", async () => {
  try {
    const info = await stat(targetFile);
    let frame;
    if (isText) {
      const content = await readFile(targetFile, "utf8");
      if (content === lastWritten) return; // our own save, ignore
      frame = JSON.stringify({ type: "reload", content, mtimeMs: info.mtimeMs });
    } else {
      frame = JSON.stringify({ type: "reload", mtimeMs: info.mtimeMs });
    }
    for (const socket of sockets) {
      try {
        socket.send(frame);
      } catch {
        /* drop dead sockets silently */
      }
    }
  } catch (err) {
    console.error("[artifact-viewer] watch error:", err);
  }
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

const port = await listenOnFreePort(Number(process.env.ARTIFACT_PORT) || 4317);
const url = `http://127.0.0.1:${port}`;
console.log(`[artifact-viewer] ${path.basename(targetFile)} → ${url}`);

if (process.env.ARTIFACT_NO_OPEN !== "1") {
  await open(url).catch(() => {
    console.log(`[artifact-viewer] open your browser at ${url}`);
  });
}

const shutdown = async () => {
  await watcher.close();
  await fastify.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

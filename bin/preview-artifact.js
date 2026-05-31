#!/usr/bin/env node
// CLI for preview-artifact.
//
//   preview-artifact open <file>   open a file in the shared local daemon
//   preview-artifact <file>        shorthand for "open"
//   preview-artifact stop          stop the daemon
//
// A single daemon serves every file (passed as ?path=), auto-started on first
// use and reused afterwards. State lives in ~/.preview-artifact/daemon.json.
import path from "node:path";
import os from "node:os";
import { existsSync, readFileSync, mkdirSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import open from "open";

const STATE_DIR = path.join(os.homedir(), ".preview-artifact");
const STATE_FILE = path.join(STATE_DIR, "daemon.json");
const LOG_FILE = path.join(STATE_DIR, "daemon.log");
const serverEntry = fileURLToPath(new URL("../server/index.mjs", import.meta.url));

function usage(code = 0) {
  console.log(`preview-artifact — read & edit agent artifacts in the browser

Usage:
  preview-artifact open <file...> Open .md / .tex / .pdf file in the browser
  preview-artifact <file>        Shorthand for "open"
  preview-artifact stop          Stop the background daemon

Options:
  --no-open                      Print the URL but don't launch a browser
  -h, --help                     Show this help
`);
  process.exit(code);
}

function readState() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

// Return the port of a running, healthy daemon, or null.
async function healthyPort() {
  const state = readState();
  if (!state?.port) return null;
  try {
    const res = await fetch(`http://127.0.0.1:${state.port}/api/health`, {
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.app === "preview-artifact" ? state.port : null;
  } catch {
    return null;
  }
}

async function startDaemon() {
  mkdirSync(STATE_DIR, { recursive: true });
  const out = openSync(LOG_FILE, "a");
  const child = spawn(process.execPath, [serverEntry], {
    detached: true,
    stdio: ["ignore", out, out],
    env: process.env,
  });
  child.unref();
  // Poll for the daemon to come up (~5s max).
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const port = await healthyPort();
    if (port) return port;
  }
  throw new Error(`daemon did not start; see ${LOG_FILE}`);
}

async function stopDaemon() {
  const state = readState();
  if (!state?.pid) {
    console.log("preview-artifact: no daemon running");
    return;
  }
  try {
    process.kill(state.pid, "SIGTERM");
    console.log(`preview-artifact: stopped daemon (pid ${state.pid})`);
  } catch {
    console.log("preview-artifact: daemon not running");
  }
}

async function openFiles(files, noOpen) {
  const targets = [];
  for (const f of files) {
    const abs = path.resolve(process.cwd(), f);
    if (!existsSync(abs)) {
      console.error(`error: file not found: ${abs}`);
      process.exit(1);
    }
    targets.push(abs);
  }
  const port = (await healthyPort()) ?? (await startDaemon());

  // Register all artifacts so they appear in the panel.
  await fetch(`http://127.0.0.1:${port}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths: targets }),
  }).catch(() => {});

  for (const t of targets) {
    console.log(
      `[preview-artifact] ${path.basename(t)} → http://127.0.0.1:${port}/?path=${encodeURIComponent(t)}`,
    );
  }
  // Open a browser tab at the first artifact (the rest show in the panel).
  if (!noOpen) {
    const url = `http://127.0.0.1:${port}/?path=${encodeURIComponent(targets[0])}`;
    await open(url).catch(() => console.log(`open your browser at ${url}`));
  }
}

const argv = process.argv.slice(2);
if (argv.includes("-h") || argv.includes("--help") || argv.length === 0) {
  usage(0);
}

const noOpen = argv.includes("--no-open");
const positional = argv.filter((a) => !a.startsWith("-"));

if (positional[0] === "stop") {
  await stopDaemon();
} else {
  const files = positional[0] === "open" ? positional.slice(1) : positional;
  if (files.length === 0) {
    console.error("error: no file specified\n");
    usage(1);
  }
  await openFiles(files, noOpen);
}

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
  preview-artifact open <file>   Open a .md / .tex / .pdf file in the browser
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

async function openFile(file, noOpen) {
  const target = path.resolve(process.cwd(), file);
  if (!existsSync(target)) {
    console.error(`error: file not found: ${target}`);
    process.exit(1);
  }
  const port = (await healthyPort()) ?? (await startDaemon());
  const url = `http://127.0.0.1:${port}/?path=${encodeURIComponent(target)}`;
  console.log(`[preview-artifact] ${path.basename(target)} → ${url}`);
  if (!noOpen) {
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
  const file = positional[0] === "open" ? positional[1] : positional[0];
  if (!file) {
    console.error("error: no file specified\n");
    usage(1);
  }
  await openFile(file, noOpen);
}

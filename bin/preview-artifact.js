#!/usr/bin/env node
// CLI for artifact-viewer.
//
//   preview-artifact open <file.md>   open a markdown artifact in the browser
//   preview-artifact <file.md>        shorthand for `open`
//
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);

function usage(code = 0) {
  console.log(`artifact-viewer — read & edit agent markdown artifacts in the browser

Usage:
  preview-artifact open <file.md>   Open a markdown file (beautiful read view + WYSIWYG edit)
  preview-artifact <file.md>        Shorthand for "open"

Options:
  --no-open                 Start the server but don't launch a browser
  -h, --help                Show this help
`);
  process.exit(code);
}

if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
  usage(0);
}

const noOpen = argv.includes("--no-open");
const positional = argv.filter((a) => !a.startsWith("-"));
const cmd = positional[0] === "open" ? positional[1] : positional[0];

if (!cmd) {
  console.error("error: no file specified\n");
  usage(1);
}

const target = path.resolve(process.cwd(), cmd);
if (!existsSync(target)) {
  console.error(`error: file not found: ${target}`);
  process.exit(1);
}

process.env.ARTIFACT_FILE = target;
if (noOpen) process.env.ARTIFACT_NO_OPEN = "1";

const serverEntry = fileURLToPath(new URL("../server/index.mjs", import.meta.url));
await import(serverEntry);

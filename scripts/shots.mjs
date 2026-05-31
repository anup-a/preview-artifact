// Generate README screenshots from the running daemon.
//
// Prereq: the daemon is running (e.g. `preview-artifact open <anything>`) and
// the demo files exist under ~/.pa-demo. Then:
//   npm i -D playwright && npx playwright install chromium
//   node scripts/shots.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.PA_BASE || "http://127.0.0.1:4317";
const HOME = process.env.HOME;
const url = (f) => `${BASE}/?path=${encodeURIComponent(`${HOME}/.pa-demo/${f}`)}`;
const outDir = fileURLToPath(new URL("../docs/screenshots", import.meta.url));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 820 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

async function shot(file, name, { scrollY = 0, edit = false } = {}) {
  await page.goto(url(file), { waitUntil: "networkidle" });
  if (edit) await page.getByRole("tab", { name: "Edit" }).click();
  await page.waitForTimeout(1600); // mermaid / fonts / image
  if (scrollY) {
    await page.evaluate((y) => document.querySelector(".content")?.scrollTo(0, y), scrollY);
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(outDir, name) });
  console.log("wrote", name);
}

await shot("article.md", "read-markdown.png");
await shot("showcase.md", "showcase.png");
await shot("showcase.md", "showcase-diagram.png", { scrollY: 360 });
await shot("paper.tex", "latex.png");
await shot("report.pdf", "pdf.png");
await shot("showcase.md", "edit-markdown.png", { edit: true });

await browser.close();
console.log("done →", outDir);

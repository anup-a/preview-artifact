// Generate a single hero image: left half light theme, right half dark theme
// (diagonal split). Requires the daemon running + ~/.pa-demo demo files.
//   npm i -D playwright && npx playwright install chromium
//   node scripts/split-shot.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.PA_BASE || "http://127.0.0.1:4317";
const HOME = process.env.HOME;
const url = `${BASE}/?path=${encodeURIComponent(`${HOME}/.pa-demo/showcase.md`)}`;
const outDir = fileURLToPath(new URL("../docs/screenshots", import.meta.url));
mkdirSync(outDir, { recursive: true });
const W = 1280, H = 860;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

async function shot(theme, file) {
  await page.addInitScript((t) => localStorage.setItem("pa-theme", t), theme);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(outDir, file) });
}
await shot("light", "_light.png");
await shot("dark", "_dark.png");

const b64 = (f) => readFileSync(path.join(outDir, f)).toString("base64");
const html = `<!doctype html><html><body style="margin:0">
  <div style="position:relative;width:${W}px;height:${H}px;overflow:hidden">
    <img src="data:image/png;base64,${b64("_light.png")}" style="position:absolute;inset:0;width:${W}px;height:${H}px"/>
    <img src="data:image/png;base64,${b64("_dark.png")}" style="position:absolute;inset:0;width:${W}px;height:${H}px;clip-path:polygon(54% 0,100% 0,100% 100%,46% 100%)"/>
    <div style="position:absolute;top:0;bottom:0;left:50%;width:2px;transform:skewX(-7deg);background:rgba(180,84,44,.7)"></div>
  </div>
</body></html>`;
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, "hero-split.png") });

await browser.close();
console.log("wrote hero-split.png");

// Read-mode renderer: turns the markdown body into richly formatted HTML.
// Kept separate from the Milkdown editor so the reading experience can render
// things the editor can't (mermaid diagrams) without ever touching the source
// bytes — we only render a visual view, the underlying markdown is untouched.

import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
// @ts-expect-error — no bundled types for this plugin.
import taskLists from "markdown-it-task-lists";
import hljs from "highlight.js";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(code, lang) {
    // Mermaid fences become a <pre class="mermaid"> for runMermaid() to render.
    if (lang === "mermaid") {
      return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        const out = hljs.highlight(code, { language: lang }).value;
        return `<pre class="hljs"><code class="language-${lang}">${out}</code></pre>`;
      } catch {
        /* fall through to plain */
      }
    }
    return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`;
  },
})
  .use(anchor, { permalink: anchor.permalink.headerLink({ safariReaderFix: true }) })
  .use(taskLists, { enabled: true, label: true });

export function renderMarkdown(body: string): string {
  return md.render(body);
}

/** Render any mermaid code fences found inside the container into SVG. */
export async function runMermaid(container: HTMLElement): Promise<void> {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>("pre.mermaid"));
  if (nodes.length === 0) return;
  try {
    await mermaid.run({ nodes });
  } catch (err) {
    // A single bad diagram shouldn't break the whole document.
    console.error("[artifact-viewer] mermaid render error:", err);
  }
}

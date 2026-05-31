// Read-mode renderers.
//
// - renderMarkdown: markdown -> HTML (highlight.js, mermaid, KaTeX math, GFM).
// - renderTex: a .tex file -> highlighted LaTeX source with display equations
//   typeset by KaTeX, inserted in document order.
//
// Kept separate from the Milkdown editor so the reading experience can render
// things the editor can't, without ever touching the source bytes.

import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
// @ts-expect-error — no bundled types for these plugins.
import taskLists from "markdown-it-task-lists";
// @ts-expect-error — no bundled types.
import texmath from "markdown-it-texmath";
import hljs from "highlight.js";
import katex from "katex";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "neutral", // clean grayscale, sits well on the warm cream paper
  securityLevel: "loose",
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(code, lang) {
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
  // Adds slug `id`s to headings for deep-linking, without wrapping in an <a>.
  .use(anchor)
  .use(taskLists, { enabled: true, label: true })
  // $...$ inline and $$...$$ display math via KaTeX.
  .use(texmath, {
    engine: katex,
    delimiters: "dollars",
    katexOptions: { throwOnError: false },
  });

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
    console.error("[artifact-viewer] mermaid render error:", err);
  }
}

function highlightLatex(code: string): string {
  const trimmed = code.replace(/^\n+|\n+$/g, "");
  if (!trimmed) return "";
  const html = hljs.getLanguage("latex")
    ? hljs.highlight(trimmed, { language: "latex" }).value
    : escapeHtml(trimmed);
  return `<pre class="hljs language-latex"><code>${html}</code></pre>`;
}

// Display-math: $$...$$, \[...\], and common equation environments.
const TEX_DISPLAY_MATH =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|eqnarray\*?)\}[\s\S]+?\\end\{\3\}/g;

/**
 * Render a .tex file: highlighted LaTeX source with display equations typeset
 * by KaTeX in document order. Inline `$...$` stays as source (this is a source
 * view, not a full LaTeX typesetter).
 */
export function renderTex(src: string): string {
  let out = "";
  let last = 0;
  TEX_DISPLAY_MATH.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TEX_DISPLAY_MATH.exec(src)) !== null) {
    out += highlightLatex(src.slice(last, m.index));
    // group 1 = $$…$$, group 2 = \[…\], otherwise an environment (render whole).
    const expr = m[1] ?? m[2] ?? m[0];
    out += `<div class="tex-math">${katex.renderToString(expr, {
      displayMode: true,
      throwOnError: false,
    })}</div>`;
    last = TEX_DISPLAY_MATH.lastIndex;
  }
  out += highlightLatex(src.slice(last));
  return out;
}

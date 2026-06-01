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

// Tolerant pre-pass so agent-authored diagrams render like they do elsewhere
// (e.g. Lark): literal "\n" line-breaks → <br/>, and backticks inside node
// labels (incl. ```fences```) stripped — mermaid 11 rejects both.
function repairMermaid(code: string): string {
  return code
    .replace(/`+/g, "") // drop backticks (``` openui ```, `code`) inside labels
    .replace(/\\n/g, "<br/>") // legacy \n line-break → mermaid-friendly <br/>
    // Quote unquoted edge labels so @, →, parens, etc. are literal text — mermaid
    // 11 otherwise reads a bare @ as edge-id syntax and throws.
    .replace(/\|([^|"\n]+)\|/g, (_m, label) => `|"${label.trim()}"|`);
}

let mermaidSeq = 0;

/** Render mermaid code fences to SVG; on failure, fall back to a code block. */
export async function runMermaid(container: HTMLElement): Promise<void> {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>("pre.mermaid"));
  for (const node of nodes) {
    const raw = node.textContent ?? "";
    try {
      const { svg } = await mermaid.render(`pa-mermaid-${mermaidSeq++}`, repairMermaid(raw));
      node.innerHTML = svg;
    } catch (err) {
      // A single bad diagram shouldn't look like the page is broken — show the
      // source instead of mermaid's error box.
      console.error("[pretifact] mermaid render error:", err);
      const pre = document.createElement("pre");
      pre.className = "hljs language-mermaid";
      const code = document.createElement("code");
      code.textContent = raw;
      pre.appendChild(code);
      node.replaceWith(pre);
    }
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

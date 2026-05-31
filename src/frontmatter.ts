// Markdown editors (Milkdown included) treat a leading `---` block as a
// thematic break + headings, which silently corrupts YAML frontmatter on
// round-trip. We split it off before editing and re-attach it verbatim on
// save, so the frontmatter bytes are never touched by the editor.

export interface SplitDoc {
  /** Raw frontmatter text WITHOUT the surrounding `---` fences, or null if none. */
  frontmatter: string | null;
  /** The markdown body (everything after the closing fence). */
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(raw: string): SplitDoc {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: null, body: raw };
  }
  return {
    frontmatter: match[1],
    body: raw.slice(match[0].length),
  };
}

export function joinFrontmatter(frontmatter: string | null, body: string): string {
  if (frontmatter === null) {
    return body;
  }
  const trimmed = frontmatter.replace(/\r?\n$/, "");
  return `---\n${trimmed}\n---\n\n${body.replace(/^\n+/, "")}`;
}

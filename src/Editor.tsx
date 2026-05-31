// Edit-mode WYSIWYG, powered by Milkdown Crepe (ProseMirror, markdown-native).
// We feed it ONLY the body (frontmatter is handled separately) so the editor
// can't corrupt YAML on round-trip.

import { useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import { fileDir, assetUrl } from "./api";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

// Resolve relative/local <img> sources to the daemon's asset URL so they show
// in the editor too (cosmetic — Crepe serializes the original src on save).
function resolveEditorImages(root: HTMLElement): void {
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (!src || /^(https?:|data:|blob:|\/api\/raw)/i.test(src)) return;
    const abs = src.startsWith("/") ? src : `${fileDir}/${src}`;
    img.setAttribute("src", assetUrl(abs));
  });
}

interface EditorProps {
  /** Initial markdown body. Changing this remounts the editor (use a React key). */
  defaultValue: string;
  /** Fired on every keystroke with the current markdown. */
  onChange: (markdown: string) => void;
}

export function Editor({ defaultValue, onChange }: EditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Crepe emits a markdownUpdated during initialization (its normalized
    // serialization of defaultValue). We capture that as a baseline and treat
    // it as "not an edit", so merely opening the editor doesn't mark the file
    // dirty. Only divergence from the baseline counts as a real change.
    let baseline: string | null = null;

    const crepe = new Crepe({ root, defaultValue });
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        if (baseline === null) {
          baseline = markdown;
          return;
        }
        if (markdown === baseline) return;
        onChangeRef.current(markdown);
      });
    });
    crepe.create().then(() => resolveEditorImages(root));

    // Crepe re-renders on edits; keep relative images resolved as they appear.
    const observer = new MutationObserver(() => resolveEditorImages(root));
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });

    return () => {
      observer.disconnect();
      crepe.destroy();
    };
    // defaultValue is intentionally read once; App remounts via `key` on reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={rootRef} className="crepe-host" />;
}

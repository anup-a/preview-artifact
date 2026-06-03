// Hover-reveal table of contents for the read view.
//
// Collapsed it's a column of short dashes (one per heading, indented by level);
// on hover it expands into a labelled, clickable outline. Headings already carry
// anchor ids (markdown-it-anchor), so clicking scrolls to the section and the
// active section is tracked with an IntersectionObserver.

import { useEffect, useState } from "react";

export type TocItem = { id: string; text: string; level: number };

export function Toc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const minLevel = items.reduce((m, i) => Math.min(m, i.level), 6);

  // Highlight the heading currently near the top of the scroll viewport.
  useEffect(() => {
    const els = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      // Active band: just under the toolbar to ~35% down the viewport.
      { rootMargin: "-64px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  const onClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  };

  return (
    <nav className="toc" aria-label="Table of contents">
      <ul className="toc-list">
        {items.map((item) => (
          <li
            key={item.id}
            className={"toc-item" + (item.id === activeId ? " active" : "")}
            style={{ "--depth": item.level - minLevel } as React.CSSProperties}
          >
            <a href={`#${item.id}`} onClick={(e) => onClick(e, item.id)} title={item.text}>
              <span className="toc-dash" aria-hidden="true" />
              <span className="toc-label">{item.text}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

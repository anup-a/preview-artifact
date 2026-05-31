// Light/dark theme handling. A `data-theme` attribute on <html> drives the
// token palette; we persist the choice and default to light (the editorial look).
//
// The dark code-highlight theme is injected scoped to [data-theme="dark"] so it
// only applies in dark mode (atom-one-light is imported globally for light).

import hljsDark from "highlight.js/styles/atom-one-dark.css?inline";

const KEY = "pa-theme";
export type Theme = "light" | "dark";

export function getTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  return saved === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEY, theme);
}

// Scope the dark highlight.js theme under [data-theme="dark"] via CSS nesting.
const darkStyle = document.createElement("style");
darkStyle.textContent = `[data-theme="dark"]{${hljsDark}}`;
document.head.appendChild(darkStyle);

applyTheme(getTheme());

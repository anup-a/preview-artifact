// Dark-mode wiring for third-party stylesheets.
//
// highlight.js and Milkdown Crepe ship separate light/dark themes. We load the
// light ones normally (see main.tsx / Editor.tsx) and inject the dark ones into
// a <style media="(prefers-color-scheme: dark)"> element — the whole sheet only
// activates in dark mode, and because it's appended last it wins the cascade.
// No selector rewriting, so it works even for rules targeting :root.
//
// github-markdown.css already switches on prefers-color-scheme internally, so it
// needs nothing here.

import hljsDark from "highlight.js/styles/github-dark.css?inline";
import crepeDark from "@milkdown/crepe/theme/frame-dark.css?inline";

function injectDark(css: string): void {
  const style = document.createElement("style");
  style.media = "(prefers-color-scheme: dark)";
  style.textContent = css;
  document.head.appendChild(style);
}

injectDark(hljsDark);
injectDark(crepeDark);

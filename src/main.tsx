import { createRoot } from "react-dom/client";
import { App } from "./App";

// Bundled locally (no runtime web-font fetch): display serif for headings,
// text serif for body — the editorial pairing from the reference.
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";

import "highlight.js/styles/atom-one-light.css";
import "github-markdown-css/github-markdown-light.css";
import "katex/dist/katex.min.css";
import "./theme"; // sets data-theme + injects dark code highlighting
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");

// No StrictMode: its dev-only double-invoke races Milkdown's async create/destroy.
createRoot(root).render(<App />);

import { createRoot } from "react-dom/client";
import { App } from "./App";

import "highlight.js/styles/github.css";
import "github-markdown-css/github-markdown-light.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");

// No StrictMode: its dev-only double-invoke races Milkdown's async create/destroy.
createRoot(root).render(<App />);

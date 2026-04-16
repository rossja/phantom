import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";

// Bootstrap theme before paint to prevent flash
const stored = localStorage.getItem("phantom-chat-theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const isDark = stored === "dark" || (!stored && prefersDark);
document.documentElement.classList.toggle("dark", isDark);

// Bootstrap title before paint. The cached agent name from a previous
// load beats the HTML default "Phantom" so browser tabs, tab-search,
// and iOS tab switcher all show the real agent identity immediately.
try {
  const cached = localStorage.getItem("phantom-chat-bootstrap-v1");
  if (cached) {
    const parsed = JSON.parse(cached) as { agent_name?: unknown };
    if (typeof parsed.agent_name === "string" && parsed.agent_name.length > 0) {
      document.title = parsed.agent_name;
    }
  }
} catch {
  // corrupt cache, ignore
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

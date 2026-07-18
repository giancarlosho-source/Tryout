import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

const API_URL = (import.meta as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "";
if (API_URL) setBaseUrl(API_URL);

// Attach JWT to all /api/ requests globally (needed for station pages that bypass PasswordGate)
const _origFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const token = localStorage.getItem("tryoutdesk_token");
  if (token && typeof input === "string" && input.includes("/api/")) {
    const merged = new Headers(init?.headers);
    if (!merged.has("Authorization")) merged.set("Authorization", `Bearer ${token}`);
    init = { ...init, headers: merged };
  }
  return _origFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);

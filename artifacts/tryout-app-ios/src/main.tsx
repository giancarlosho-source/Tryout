import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { getServerUrl } from "./lib/server-url";

const serverUrl = getServerUrl();
if (serverUrl) setBaseUrl(serverUrl);

createRoot(document.getElementById("root")!).render(<App />);

import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { App as CapApp } from "@capacitor/app";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { StaffGate } from "@/components/staff-gate";
import { useLiveSync } from "@/hooks/use-live-sync";
import { getServerUrl, setServerUrl } from "@/lib/server-url";

import CheckInStation from "./pages/stations/checkin";
import PhotoStation from "./pages/stations/photo";
import MeasurementsStation from "./pages/stations/measurements";
import EvaluationStation from "./pages/stations/evaluation";
import ServerView from "./pages/server";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient();

function AppInner() {
  useLiveSync();
  return null;
}

// ── Server setup screen ──────────────────────────────────────────────────────

function ServerSetup({ onConnected }: { onConnected: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  const connect = async (raw: string) => {
    const trimmed = raw.trim().replace(/\/$/, "");
    if (!trimmed) { setError("Please enter a server URL."); return; }
    setTesting(true);
    setError("");
    try {
      const res = await fetch(`${trimmed}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error("Bad response");
      setServerUrl(trimmed);
      setBaseUrl(trimmed);
      onConnected();
    } catch {
      setError("Could not reach that server. Check the URL and try again.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <img
            src="/tribe-logo.png"
            alt="Tribe VB"
            className="h-20 w-20 object-contain mx-auto"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Tribe Tryouts</h1>
          <p className="text-gray-500 font-medium">Connect to the coordinator's server</p>
        </div>

        <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Ask your coordinator for the <strong>server URL</strong> from the{" "}
            <strong>Sessions</strong> page of the admin dashboard, then paste it below.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Server URL
            </label>
            <input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://xxxx.trycloudflare.com"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-base font-mono focus:outline-none focus:border-primary transition-colors"
            />
            {error && (
              <p className="text-sm text-red-600 font-semibold">{error}</p>
            )}
          </div>

          <button
            onClick={() => connect(url)}
            disabled={testing || !url.trim()}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {testing ? "Connecting…" : "Connect"}
          </button>
        </div>

        <p className="text-xs text-center text-gray-400 leading-relaxed">
          The coordinator starts the server from their Mac. The URL is shown on the{" "}
          <strong>Sessions</strong> page under &ldquo;Staff Device Setup.&rdquo;
        </p>
      </div>
    </div>
  );
}

// ── Root app ────────────────────────────────────────────────────────────────

function App() {
  const [serverReady, setServerReady] = useState(() => !!getServerUrl());

  // Handle tribetryouts://connect?server=... deep links
  useEffect(() => {
    const sub = CapApp.addListener("appUrlOpen", (data) => {
      try {
        const url = new URL(data.url);
        if (url.protocol === "tribetryouts:" && url.hostname === "connect") {
          const server = url.searchParams.get("server");
          if (server) {
            setServerUrl(server.replace(/\/$/, ""));
            setBaseUrl(server.replace(/\/$/, ""));
            setServerReady(true);
            queryClient.clear();
          }
        }
      } catch { /* ignore malformed URLs */ }
    });
    return () => { sub.then((h) => h.remove()); };
  }, []);

  if (!serverReady) {
    return (
      <TooltipProvider>
        <ServerSetup onConnected={() => { queryClient.clear(); setServerReady(true); }} />
        <Toaster />
      </TooltipProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppInner />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <StaffGate>
            <Switch>
              <Route path="/station/checkin">
                <ErrorBoundary label="Check-In"><CheckInStation /></ErrorBoundary>
              </Route>
              <Route path="/station/photo" component={PhotoStation} />
              <Route path="/station/measurements" component={MeasurementsStation} />
              <Route path="/station/evaluation" component={EvaluationStation} />
              <Route path="/server" component={ServerView} />
              <Route component={NotFound} />
            </Switch>
          </StaffGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

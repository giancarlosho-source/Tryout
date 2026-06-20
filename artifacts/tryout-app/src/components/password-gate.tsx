import { useState, useEffect } from "react";
import { Shield, Lock } from "lucide-react";

const STORAGE_KEY = "tryoutdesk_admin_auth";
const API_BASE = (import.meta as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "";

async function checkRequired(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/auth/required`);
    const d = await r.json();
    return d.required === true;
  } catch {
    return false;
  }
}

async function verifyPassword(password: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const d = await r.json();
    return d.ok === true;
  } catch {
    return false;
  }
}

export function useAdminAuth() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return {
    logout: () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    },
    isAuthenticated: stored === "true",
  };
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "open" | "locked" | "authed">("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") {
      setStatus("authed");
      return;
    }
    checkRequired().then((required) => {
      setStatus(required ? "locked" : "open");
    });
  }, []);

  if (status === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "open" || status === "authed") {
    return <>{children}</>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const ok = await verifyPassword(password);
    if (ok) {
      localStorage.setItem(STORAGE_KEY, "true");
      setStatus("authed");
    } else {
      setError("Incorrect password");
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight">TryoutDesk</h1>
            <p className="text-sm text-muted-foreground mt-1">Admin Console</p>
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 transition-opacity"
          >
            {loading ? "Verifying…" : "Enter Console"}
          </button>
        </form>
      </div>
    </div>
  );
}

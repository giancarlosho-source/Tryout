import { useState, useEffect } from "react";
import { Shield, Mail, Lock, Building2 } from "lucide-react";

const TOKEN_KEY = "tryoutdesk_token";
const CLUB_KEY = "tryoutdesk_club";
const API_BASE = (import.meta as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "";

export type ClubInfo = { id: number; name: string; email: string };

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function useAdminAuth() {
  const raw = localStorage.getItem(CLUB_KEY);
  const club: ClubInfo | null = raw ? JSON.parse(raw) : null;
  return {
    club,
    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CLUB_KEY);
      window.location.reload();
    },
  };
}

// Attach JWT to all API requests
const _fetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const token = getToken();
  if (token && typeof input === "string" && input.includes("/api/")) {
    init = {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    };
  }
  return _fetch(input, init);
};

type Screen = "checking" | "login" | "signup" | "authed";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>("checking");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (token) {
      // Verify token still valid
      fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.club) {
            localStorage.setItem(CLUB_KEY, JSON.stringify(d.club));
            setScreen("authed");
          } else {
            localStorage.removeItem(TOKEN_KEY);
            checkStatus();
          }
        })
        .catch(() => checkStatus());
    } else {
      checkStatus();
    }
  }, []);

  function checkStatus() {
    fetch(`${API_BASE}/api/auth/status`)
      .then((r) => r.json())
      .then((d) => setScreen(d.hasClub ? "login" : "signup"))
      .catch(() => setScreen("login"));
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Login failed."); return; }
      localStorage.setItem(TOKEN_KEY, d.token);
      localStorage.setItem(CLUB_KEY, JSON.stringify(d.club));
      setScreen("authed");
    } catch {
      setError("Could not reach server.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Signup failed."); return; }
      localStorage.setItem(TOKEN_KEY, d.token);
      localStorage.setItem(CLUB_KEY, JSON.stringify(d.club));
      setScreen("authed");
    } catch {
      setError("Could not reach server.");
    } finally {
      setLoading(false);
    }
  };

  if (screen === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (screen === "authed") return <>{children}</>;

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight">TryoutDesk</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {screen === "signup" ? "Create your club account" : "Sign in to your club account"}
            </p>
          </div>
        </div>

        <form onSubmit={screen === "signup" ? handleSignup : handleLogin} className="flex flex-col gap-3">
          {screen === "signup" && (
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Club name (e.g. SF Volleyball)"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                autoFocus
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              autoFocus={screen === "login"}
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              placeholder={screen === "signup" ? "Password (min 8 characters)" : "Password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {error && <p className="text-sm text-destructive text-center font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 transition-opacity mt-1"
          >
            {loading ? "Please wait…" : screen === "signup" ? "Create Account" : "Sign In"}
          </button>

          {screen === "login" && (
            <p className="text-xs text-center text-muted-foreground pt-1">
              First time?{" "}
              <button type="button" onClick={() => { setScreen("signup"); setError(""); }}
                className="text-primary font-semibold hover:underline">
                Create your club account
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

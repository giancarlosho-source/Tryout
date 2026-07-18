import { useState, useEffect } from "react";
import { Shield, Mail, Lock, Building2, AlertTriangle } from "lucide-react";

const TOKEN_KEY = "tryoutdesk_token";
const CLUB_KEY = "tryoutdesk_club";
const API_BASE = (import.meta as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "";

export type ClubInfo = { id: number; name: string; email: string; logoUrl?: string | null; primaryColor?: string | null; status?: string; trialEndsAt?: string | null; emailVerified?: boolean };

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function useAdminAuth() {
  const raw = localStorage.getItem(CLUB_KEY);
  const club: ClubInfo | null = raw ? JSON.parse(raw) : null;

  async function uploadLogo(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const logoUrl = reader.result as string;
        try {
          const r = await fetch(`${API_BASE}/api/auth/logo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logoUrl }),
          });
          const d = await r.json();
          if (!r.ok) { reject(new Error(d.error ?? "Upload failed")); return; }
          // Update cached club info
          const updated = { ...(club ?? {}), logoUrl };
          localStorage.setItem(CLUB_KEY, JSON.stringify(updated));
          resolve(logoUrl);
        } catch (e) { reject(e); }
      };
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  }

  async function updateClub(fields: { name?: string; primaryColor?: string }): Promise<ClubInfo> {
    const r = await fetch(`${API_BASE}/api/auth/club`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "Update failed");
    const updated: ClubInfo = d.club;
    localStorage.setItem(CLUB_KEY, JSON.stringify(updated));
    if (updated.primaryColor) applyColor(updated.primaryColor);
    return updated;
  }

  return {
    club,
    uploadLogo,
    updateClub,
    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CLUB_KEY);
      window.location.reload();
    },
  };
}

export function applyColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);
  const hsl = `${hDeg} ${sPct}% ${lPct}%`;

  // Perceived luminance — determines whether text on top should be white or dark
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const onColor = luminance > 0.35 ? "220 40% 12%" : "0 0% 100%";

  // Darker/lighter shade for sidebar depth effects
  const deeperL = Math.max(lPct - 12, 4);
  const lighterL = Math.min(lPct + 10, 96);
  const deeper = `${hDeg} ${sPct}% ${deeperL}%`;
  const lighter = `${hDeg} ${sPct}% ${lighterL}%`;

  // Active nav pill: white on dark sidebar, dark on light sidebar
  const activeBg = luminance > 0.35 ? deeper : "0 0% 100%";
  const activeFg = luminance > 0.35 ? "0 0% 100%" : `${hDeg} ${sPct}% ${deeperL}%`;

  const css = document.documentElement.style;
  // Buttons, links, accents throughout the app
  css.setProperty("--primary", hsl);
  css.setProperty("--primary-foreground", onColor);
  css.setProperty("--ring", hsl);
  // Sidebar — full repaint with club color
  css.setProperty("--sidebar", hsl);
  css.setProperty("--sidebar-foreground", onColor);
  css.setProperty("--sidebar-border", deeper);
  css.setProperty("--sidebar-accent", luminance > 0.35 ? deeper : lighter);
  css.setProperty("--sidebar-accent-foreground", onColor);
  // Active nav item pill
  css.setProperty("--sidebar-primary", activeBg);
  css.setProperty("--sidebar-primary-foreground", activeFg);
}

// Intercept 402 subscription errors globally
const _fetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const response = await _fetch(input, init);
  if (response.status === 402) {
    // Clone so the body can still be read by the caller if needed
    const clone = response.clone();
    clone.json().then((d: { error?: string }) => {
      window.dispatchEvent(new CustomEvent("tryoutdesk:subscription-error", { detail: d.error ?? "SUBSCRIPTION_REQUIRED" }));
    }).catch(() => {
      window.dispatchEvent(new CustomEvent("tryoutdesk:subscription-error", { detail: "SUBSCRIPTION_REQUIRED" }));
    });
  }
  return response;
};

type Screen = "checking" | "login" | "signup" | "forgot" | "authed";

const SUBSCRIPTION_MESSAGES: Record<string, { title: string; body: string }> = {
  TRIAL_EXPIRED: {
    title: "Your trial has ended",
    body: "Your 14-day free trial has expired. Contact us to activate your subscription and regain access.",
  },
  PAST_DUE: {
    title: "Payment past due",
    body: "Your account has a past-due balance. Please contact us to restore access.",
  },
  CANCELLED: {
    title: "Subscription cancelled",
    body: "Your TryoutDesk subscription has been cancelled. Contact us if you'd like to reactivate.",
  },
  SUBSCRIPTION_REQUIRED: {
    title: "Subscription required",
    body: "Your account requires an active subscription. Please contact us to get set up.",
  },
};

function SubscriptionWall({ code, onLogout }: { code: string; onLogout: () => void }) {
  const msg = SUBSCRIPTION_MESSAGES[code] ?? SUBSCRIPTION_MESSAGES["SUBSCRIPTION_REQUIRED"];
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-sm mx-auto px-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">{msg.title}</h1>
          <p className="text-sm text-muted-foreground mt-2">{msg.body}</p>
        </div>
        <a
          href="mailto:giancarlosho@gmail.com"
          className="block w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm text-center"
        >
          Contact Support
        </a>
        <button
          onClick={onLogout}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>("checking");
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedData, setAgreedData] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      setSubscriptionError((e as CustomEvent<string>).detail);
    };
    window.addEventListener("tryoutdesk:subscription-error", handler);
    return () => window.removeEventListener("tryoutdesk:subscription-error", handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CLUB_KEY);
    setSubscriptionError(null);
    window.location.reload();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signup") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      setScreen("signup");
      return;
    }
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
            if (d.club.primaryColor) applyColor(d.club.primaryColor);
            if (d.forcePasswordChange) {
              localStorage.setItem("tryoutdesk_change_pw", "1");
              if (!window.location.pathname.endsWith("/club-settings")) {
                window.location.href = "/club-settings";
                return;
              }
            }
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
      localStorage.removeItem("tryoutdesk_admin_token");
      if (d.club.primaryColor) applyColor(d.club.primaryColor);
      if (d.forcePasswordChange) {
        localStorage.setItem("tryoutdesk_change_pw", "1");
        window.location.href = "/club-settings";
        return;
      }
      setScreen("authed");
    } catch {
      setError("Could not reach server.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedTerms || !agreedData) {
      setError("Please check both boxes to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API_BASE}/api/billing/signup-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, agreedAt: new Date().toISOString() }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Signup failed."); return; }
      // Redirect to Stripe checkout to collect card (trial — no charge for 30 days)
      window.location.href = d.url;
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Failed to send reset email."); return; }
      setForgotSent(true);
    } catch {
      setError("Could not reach server.");
    } finally {
      setLoading(false);
    }
  };

  if (subscriptionError) return <SubscriptionWall code={subscriptionError} onLogout={handleLogout} />;

  if (screen === "authed") return <>{children}</>;

  // Forgot password screen
  if (screen === "forgot") return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight">Reset Password</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {forgotSent ? "Check your inbox" : "Enter your account email"}
            </p>
          </div>
        </div>
        {forgotSent ? (
          <div className="flex flex-col gap-4 text-center">
            <div className="px-4 py-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
              <p className="font-bold mb-1">Email sent!</p>
              <p>We sent a temporary password to <strong>{email}</strong>. Check your inbox and use it to log in, then change your password in Club Settings.</p>
            </div>
            <button
              onClick={() => { setForgotSent(false); setScreen("login"); setPassword(""); }}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="Your account email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                autoFocus
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {error && <p className="text-sm text-destructive text-center font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 mt-1"
            >
              {loading ? "Sending…" : "Send Temporary Password"}
            </button>
            <p className="text-xs text-center text-muted-foreground pt-1">
              <button type="button" onClick={() => { setScreen("login"); setError(""); setForgotSent(false); }}
                className="text-primary font-semibold hover:underline">
                Back to Sign In
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );

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
              {screen === "signup" ? "Start your 30-day free trial" : "Sign in to your club account"}
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

          {screen === "signup" && (
            <div className="flex flex-col gap-2 mt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => { setAgreedTerms(e.target.checked); setError(""); }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-xs text-muted-foreground leading-snug">
                  I agree to the{" "}
                  <a href="https://tryoutdesk.com/terms" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">Terms of Service</a>
                  {" "}and{" "}
                  <a href="https://tryoutdesk.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">Privacy Policy</a>.
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedData}
                  onChange={(e) => { setAgreedData(e.target.checked); setError(""); }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-xs text-muted-foreground leading-snug">
                  I am authorized to upload player data on behalf of my organization and take full responsibility for obtaining any required consents from players and their guardians.
                </span>
              </label>
            </div>
          )}

          {error && <p className="text-sm text-destructive text-center font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 transition-opacity mt-1"
          >
            {loading ? "Please wait…" : screen === "signup" ? "Start Free Trial →" : "Sign In"}
          </button>

          {screen === "signup" && (
            <p className="text-xs text-center text-muted-foreground -mt-1">
              No charge for 30 days · $799/year after · Cancel anytime
            </p>
          )}

          {screen === "login" && (
            <div className="flex flex-col gap-1.5 pt-1">
              <p className="text-xs text-center text-muted-foreground">
                <button type="button" onClick={() => { setScreen("forgot"); setError(""); setForgotSent(false); }}
                  className="text-primary font-semibold hover:underline">
                  Forgot your password?
                </button>
              </p>
              <p className="text-xs text-center text-muted-foreground">
                First time?{" "}
                <button type="button" onClick={() => { setScreen("signup"); setError(""); }}
                  className="text-primary font-semibold hover:underline">
                  Create your club account
                </button>
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

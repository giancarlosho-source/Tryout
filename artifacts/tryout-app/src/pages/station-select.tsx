import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Delete, LayoutDashboard, Share } from "lucide-react";

// Detect if running as installed PWA (standalone) or in browser
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type StaffMember = { id: number; name: string; role: string };

type Screen = "pick" | "pin" | "setup";

export default function StationSelect() {
  const [, navigate] = useLocation();
  const params = useParams<{ slug?: string }>();
  const slugFromUrl = params.slug ?? new URLSearchParams(window.location.search).get("club");
  if (slugFromUrl) localStorage.setItem("tryoutdesk_club_slug", slugFromUrl);
  const savedSlug = localStorage.getItem("tryoutdesk_club_slug");
  const slug = slugFromUrl ?? savedSlug;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [screen, setScreen] = useState<Screen>(slug ? "pick" : "setup");
  const [clubInput, setClubInput] = useState("");
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (slug) {
      // Slug-based: no token needed, works with any bookmarked URL
      fetch(`${API_BASE}/api/staff/public/${slug}`)
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setStaff(data); })
        .catch(() => {});
    } else {
      // Fallback: token-based for backwards compat with /station
      const token = localStorage.getItem("tryoutdesk_token") ?? "";
      fetch(`${API_BASE}/api/staff`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setStaff(data); })
        .catch(() => {});
    }
  }, [slug]);

  const selectPerson = (member: StaffMember) => {
    setSelected(member);
    setPin("");
    setError("");
    setScreen("pin");
  };

  const appendDigit = (d: string) => {
    if (pin.length >= 4) return;
    setPin((p) => p + d);
    setError("");
  };

  const deleteDigit = () => setPin((p) => p.slice(0, -1));

  const submit = async () => {
    if (pin.length !== 4 || !selected) return;
    setChecking(true);
    setError("");
    try {
      const authUrl = slug
        ? `${API_BASE}/api/staff/public/${slug}/auth`
        : `${API_BASE}/api/staff/auth`;
      const token = localStorage.getItem("tryoutdesk_token") ?? "";
      const res = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(!slug && token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: selected.id, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError("Incorrect PIN. Try again.");
        setPin("");
        return;
      }
      // Store session in localStorage
      localStorage.setItem("tryoutdesk_staff", JSON.stringify({ id: data.id, name: data.name, role: data.role }));
      localStorage.setItem("tryoutdesk_station_mode", data.role);
      // Store club token so station pages can make authenticated API calls (e.g. submit evaluations)
      if (data.clubToken) localStorage.setItem("tryoutdesk_token", data.clubToken);
      const roleRoutes: Record<string, string> = {
        evaluation: "/station/evaluation",
        photo: "/station/photo",
        checkin: "/station/checkin",
        measurements: "/station/measurements",
      };
      navigate(roleRoutes[data.role] ?? "/station/evaluation");
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setChecking(false);
    }
  };


  const goAdmin = () => {
    localStorage.removeItem("tryoutdesk_staff");
    navigate("/");
  };

  // ── Setup screen (first-time PWA open with no club set) ─────────────────────
  if (screen === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-gray-900">TryoutDesk</h1>
            <p className="text-gray-500 font-medium">Enter your club code to get started</p>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="e.g. tribe"
              value={clubInput}
              onChange={(e) => setClubInput(e.target.value.toLowerCase().trim())}
              className="w-full px-4 py-4 rounded-2xl border-2 border-gray-200 text-lg font-mono text-center focus:outline-none focus:border-primary"
            />
            <button
              disabled={!clubInput}
              onClick={() => {
                localStorage.setItem("tryoutdesk_club_slug", clubInput);
                window.location.reload();
              }}
              className="touch-manipulation w-full h-14 rounded-2xl bg-gray-900 text-white text-lg font-bold active:scale-95 transition-all disabled:opacity-40"
            >
              Continue
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">Ask your club director for the club code.</p>
        </div>
      </div>
    );
  }

  // ── PIN screen ──────────────────────────────────────────────────────────────
  if (screen === "pin" && selected) {
    const dots = Array.from({ length: 4 }, (_, i) => i < pin.length);
    const pad = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xs space-y-8">
          <div className="text-center space-y-1">
            <div className="text-4xl font-black text-gray-900">{selected.name}</div>
            <p className="text-gray-500 font-medium">Enter your 4-digit PIN</p>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-4">
            {dots.map((filled, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150
                  ${filled ? "bg-primary border-primary" : "border-gray-300 bg-white"}`}
              />
            ))}
          </div>

          {error && (
            <p className="text-center text-red-600 font-semibold text-sm">{error}</p>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {["1","2","3","4","5","6","7","8","9"].map((key) => (
              <button
                key={key}
                onClick={() => appendDigit(key)}
                disabled={checking}
                className="touch-manipulation flex items-center justify-center h-16 rounded-2xl bg-white border-2 border-gray-200 text-2xl font-bold text-gray-900 hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-40"
              >
                {key}
              </button>
            ))}
            {/* Bottom row: clear · 0 · backspace */}
            <button
              onClick={() => setPin("")}
              disabled={checking || pin.length === 0}
              className="touch-manipulation flex items-center justify-center h-16 rounded-2xl bg-white border-2 border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-30"
            >
              Clear
            </button>
            <button
              onClick={() => appendDigit("0")}
              disabled={checking}
              className="touch-manipulation flex items-center justify-center h-16 rounded-2xl bg-white border-2 border-gray-200 text-2xl font-bold text-gray-900 hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-40"
            >
              0
            </button>
            <button
              onClick={deleteDigit}
              disabled={checking || pin.length === 0}
              className="touch-manipulation flex items-center justify-center h-16 rounded-2xl bg-white border-2 border-gray-200 text-gray-500 hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-30"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>

          {/* Confirm */}
          <button
            onClick={submit}
            disabled={pin.length !== 4 || checking}
            className="touch-manipulation w-full h-14 rounded-2xl bg-primary text-primary-foreground text-lg font-bold active:scale-95 transition-all shadow-md disabled:opacity-40"
          >
            {checking ? "Checking…" : "Confirm"}
          </button>

          <button
            onClick={() => { setScreen("pick"); setPin(""); setError(""); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            ← Back to name selection
          </button>
        </div>
      </div>
    );
  }

  // ── Name picker screen ──────────────────────────────────────────────────────
  const showInstallPrompt = isIOS() && !isStandalone();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
      {showInstallPrompt && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white px-5 py-4 flex items-start gap-3 shadow-2xl z-50">
          <Share className="h-5 w-5 mt-0.5 shrink-0 text-blue-400" />
          <div className="text-sm">
            <p className="font-bold mb-0.5">Add to Home Screen for the best experience</p>
            <p className="text-gray-400">Tap <strong className="text-white">Share</strong> → <strong className="text-white">Add to Home Screen</strong> — opens full screen like a native app.</p>
          </div>
        </div>
      )}
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img
            src="/tribe-logo.png"
            alt="TryoutDesk"
            className="h-16 w-16 object-contain mx-auto"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <h1 className="text-3xl font-black tracking-tight text-gray-900">TryoutDesk</h1>
          <p className="text-gray-500 font-medium">Who are you?</p>
        </div>

        <div className="space-y-2">
          {staff.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No evaluators set up yet.<br />Ask an admin to add you in the Staff & Roles page.
            </div>
          ) : (
            staff.map((m) => (
              <button
                key={m.id}
                onClick={() => selectPerson(m)}
                className="w-full text-left px-5 py-4 rounded-2xl bg-white border-2 border-gray-200 hover:border-primary hover:shadow-md active:scale-[0.98] transition-all font-bold text-lg text-gray-900 touch-manipulation"
              >
                {m.name}
              </button>
            ))
          )}
        </div>

        <div className="pt-2 border-t border-gray-200">
          <button
            onClick={goAdmin}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gray-800 hover:bg-gray-900 text-white font-bold transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Full Admin Console
          </button>
        </div>
      </div>
    </div>
  );
}

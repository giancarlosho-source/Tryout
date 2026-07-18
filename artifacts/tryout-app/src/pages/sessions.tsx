import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Calendar, Download, QrCode, Pencil, Smartphone, Copy, Check, Globe, AlertTriangle } from "lucide-react";

const HELP = {
  title: "Session Management",
  description: "A session defines which tryout event is currently active. The iPad stations use this to filter players by age group and display the event name at check-in.",
  steps: [
    { step: 1, text: "Click New Session and fill in the event name, date, and age group." },
    { step: 2, text: "Click Activate on a session to make it the live session on the iPads." },
    { step: 3, text: "The QR code for the active session can be printed and posted at the door for player self check-in." },
    { step: 4, text: "Only one session can be active at a time. Activating a new one deactivates the previous." },
  ],
  tips: [
    "Set the session before players arrive so the iPads show the correct event and age group.",
    "If no session is active, the check-in iPad will show a warning banner.",
    "You can have sessions for different age groups (e.g. U14, U16) — run them one at a time.",
    "Staff devices work from any network — no shared WiFi needed.",
  ],
};
import { useSession } from "@/contexts/session-context";
import { useAdminAuth } from "@/components/password-gate";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// Always use the deployed Vercel URL — works from any network, no tunnel needed
const APP_URL = window.location.origin;

const EVENT_PRESETS = [
  "12U Tryouts",
  "13U Tryouts",
  "14U Tryouts",
  "15U Tryouts",
  "16U Tryouts",
  "17U Tryouts",
  "18U Tryouts",
  "Make-up Tryouts",
  "Pre-evals",
];

type ActiveSession = { event: string; date: string } | null;

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function Sessions() {
  const { setSession: setGlobalSession } = useSession();
  const { club } = useAdminAuth();
  const [active, setActive] = useState<ActiveSession>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activateError, setActivateError] = useState("");
  const [clearError, setClearError] = useState(false);

  // Form state
  const [selectedEvent, setSelectedEvent] = useState(EVENT_PRESETS[4]); // 16U default
  const [customEvent, setCustomEvent] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrReady, setQrReady] = useState(false);

  const clubParam = club?.slug ? `?club=${club.slug}` : club?.id ? `?clubId=${club.id}` : "";
  const checkinUrl = `${APP_URL}/player${clubParam}`;
  const stationUrl = `${APP_URL}/station${clubParam}`;

  // Load active session on mount
  const loadActiveSession = () => {
    setLoadError(false);
    return fetch(`${API_BASE}/api/settings`)
      .then((r) => { if (!r.ok) throw new Error(`Failed to load settings (${r.status})`); return r.json(); })
      .then((s: Record<string, string>) => {
        if (s["session.event"] && s["session.date"]) {
          setActive({ event: s["session.event"], date: s["session.date"] });
        }
      })
      .catch(() => setLoadError(true));
  };
  useEffect(() => { loadActiveSession(); }, []);

  // Render QR code onto canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    setQrReady(false);
    const canvas = canvasRef.current;
    import("qrcode").then((mod) => {
      const QRCode = mod.default ?? mod;
      return (QRCode as { toCanvas: (el: HTMLCanvasElement, url: string, opts: object) => Promise<void> })
        .toCanvas(canvas, checkinUrl, { width: 280, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } });
    })
      .then(() => setQrReady(true))
      .catch(console.error);
  }, [active, checkinUrl]);

  const handleActivate = async () => {
    const eventName = useCustom ? customEvent.trim() : selectedEvent;
    if (!eventName || !date) return;
    setSaving(true);
    setActivateError("");
    try {
      const r = await fetch(`${API_BASE}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "session.event": eventName, "session.date": date }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        if (data.code === "TRIAL_EVENT_LIMIT") {
          alert("Your free trial is limited to 1 event.\n\nSubscribe to TryoutDesk ($799/year) to run unlimited events.");
          window.location.href = "/billing";
          return;
        }
        throw new Error(data.error ?? "Failed to start session.");
      }
      setActive({ event: eventName, date });
      setGlobalSession({ event: eventName, date });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : "Failed to start session.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearSession = async () => {
    setClearError(false);
    try {
      const r = await fetch(`${API_BASE}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "session.event": "", "session.date": "" }),
      });
      if (!r.ok) throw new Error(`Failed to clear session (${r.status})`);
      setActive(null);
      setGlobalSession(null);
    } catch {
      setClearError(true);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current || !active) return;

    const qrSize = 280;
    const padding = 24;
    const titleH = 44;
    const dateH = 30;
    const footerH = 28;
    const totalH = qrSize + padding * 2 + titleH + dateH + footerH;

    const out = document.createElement("canvas");
    out.width = qrSize + padding * 2;
    out.height = totalH;
    const ctx = out.getContext("2d")!;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(active.event, out.width / 2, padding + 30);

    const displayDate = new Date(active.date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    ctx.fillStyle = "#64748b";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(displayDate, out.width / 2, padding + titleH + 18);

    ctx.drawImage(canvasRef.current, padding, padding + titleH + dateH, qrSize, qrSize);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.fillText(checkinUrl, out.width / 2, out.height - 10);

    const link = document.createElement("a");
    link.download = `${active.event.replace(/\s+/g, "-")}-checkin-qr.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  };

  const formatDate = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

  return (
    <div className="flex flex-col h-full overflow-auto bg-background p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="h-6 w-6 text-primary" /> Session & QR Management
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Set the active tryout session — the check-in station will show this when players scan in.
        </p>
        {loadError && (
          <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 font-semibold max-w-lg">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">Couldn't check for an active session. The status below may be out of date.</span>
            <button onClick={() => loadActiveSession()} className="underline shrink-0">Retry</button>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Left: form */}
        <div className="space-y-5">
          <div className="bg-card border rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-base">Configure Session</h2>

            {/* Event picker */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Event</label>
              <div className="flex flex-wrap gap-2">
                {EVENT_PRESETS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { setSelectedEvent(e); setUseCustom(false); }}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors
                      ${!useCustom && selectedEvent === e
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 hover:bg-muted/60 border-transparent"}`}
                  >
                    {e}
                  </button>
                ))}
                <button
                  onClick={() => setUseCustom(true)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors flex items-center gap-1.5
                    ${useCustom
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 hover:bg-muted/60 border-transparent"}`}
                >
                  <Pencil className="h-3 w-3" /> Custom
                </button>
              </div>
              {useCustom && (
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Club Tryouts Open Gym"
                  value={customEvent}
                  onChange={(e) => setCustomEvent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1"
                />
              )}
            </div>

            {/* Date picker */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <button
              onClick={handleActivate}
              disabled={saving || (!useCustom ? !selectedEvent : !customEvent.trim()) || !date}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saved ? (
                <><CheckCircle2 className="h-4 w-4" /> Session Activated!</>
              ) : saving ? (
                "Activating…"
              ) : (
                "Activate Session"
              )}
            </button>
            {activateError && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {activateError}
              </p>
            )}
          </div>

          {/* Active session status */}
          {active && active.event ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-green-600">Active Session</span>
                <button
                  onClick={handleClearSession}
                  className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="font-black text-lg text-green-800">{active.event}</div>
              <div className="text-sm text-green-700">{formatDate(active.date)}</div>
              {clearError && (
                <p className="text-xs text-red-600 flex items-center gap-1 pt-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> Couldn't clear the session. Try again.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm font-semibold text-amber-700">No active session — check-in station will show a generic banner.</p>
            </div>
          )}
        </div>

        {/* Right: QR preview + download */}
        <div className="bg-card border rounded-2xl p-6 flex flex-col items-center gap-4">
          <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Player Entry QR Code</div>

          <div className="w-full bg-green-50 border border-green-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-green-700 mb-1">
              <Globe className="h-3.5 w-3.5" /> Works from any network
            </div>
            <div className="text-xs font-mono text-foreground break-all">{checkinUrl}</div>
          </div>

          <div className="bg-white border-2 border-dashed border-muted rounded-xl p-4 flex flex-col items-center gap-3">
            {active?.event && (
              <div className="text-center">
                <div className="font-black text-lg">{active.event}</div>
                <div className="text-sm text-muted-foreground">{formatDate(active.date)}</div>
              </div>
            )}
            <canvas ref={canvasRef} className="rounded-lg" />
            <div className="text-[10px] text-muted-foreground font-mono break-all text-center">{checkinUrl}</div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Print this QR code and post it at the door. Players scan it to check in from their own phone — no app install needed.
          </p>
          <button
            onClick={handleDownload}
            disabled={!qrReady || !active?.event}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Download PNG
          </button>
        </div>
      </div>

      {/* Staff Device Setup */}
      <div className="border-t pt-8 space-y-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" /> Staff Device Setup
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Staff can connect from any network — no shared WiFi or hotspot required.
          </p>
        </div>

        <div className="bg-card border rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-bold text-green-600 uppercase tracking-wider flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Cloud — works from any network
              </div>
              <div className="font-mono text-sm break-all text-foreground">{stationUrl}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(stationUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold hover:bg-muted/40 transition-colors shrink-0"
            >
              {copied ? <><Check className="h-3.5 w-3.5 text-green-600" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy URL</>}
            </button>
          </div>
          <div className="text-sm text-muted-foreground space-y-1.5 bg-muted/30 rounded-xl p-3">
            <p className="font-semibold text-foreground">How to connect a staff device:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Open Safari (or any browser) on the iPhone/iPad</li>
              <li>Go to <strong>{stationUrl}</strong></li>
              <li>Select your name and enter your PIN — done!</li>
            </ol>
            <p className="text-xs text-muted-foreground pt-1">
              💡 Bookmark the URL or add it to the home screen for one-tap access at every tryout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

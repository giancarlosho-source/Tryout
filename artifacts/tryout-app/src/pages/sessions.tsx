import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Calendar, Download, QrCode, Pencil, Wifi } from "lucide-react";

const HELP = {
  title: "Session Management",
  description: "A session defines which tryout event is currently active. The iPad stations use this to filter players by age group and display the event name at check-in.",
  steps: [
    { step: 1, text: "Click New Session and fill in the event name, date, and age group." },
    { step: 2, text: "Click Activate on a session to make it the live session on the iPads." },
    { step: 3, text: "The QR code for the active session can be printed and posted at the door for player self check-in (coming soon)." },
    { step: 4, text: "Only one session can be active at a time. Activating a new one deactivates the previous." },
  ],
  tips: [
    "Set the session before players arrive so the iPads show the correct event and age group.",
    "If no session is active, the check-in iPad will show a warning banner.",
    "You can have sessions for different age groups (e.g. U14, U16) — run them one at a time.",
  ],
};
import { useSession } from "@/contexts/session-context";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

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
  const [active, setActive] = useState<ActiveSession>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [selectedEvent, setSelectedEvent] = useState(EVENT_PRESETS[4]); // 16U default
  const [customEvent, setCustomEvent] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [date, setDate] = useState(todayISO());

  // Network URL for QR (editable so user can correct if needed)
  const [baseUrl, setBaseUrl] = useState(window.location.origin);
  const [editingUrl, setEditingUrl] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrReady, setQrReady] = useState(false);

  const checkinUrl = `${baseUrl}/player`;

  // Load active session and detect local network IP on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((s: Record<string, string>) => {
        if (s["session.event"] && s["session.date"]) {
          setActive({ event: s["session.event"], date: s["session.date"] });
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/server-info`)
      .then((r) => r.json())
      .then((info: { ip: string; port: number; tunnelUrl?: string | null }) => {
        if (info.tunnelUrl) {
          // Prefer tunnel URL — works from any network
          setBaseUrl(info.tunnelUrl);
        } else {
          // Fall back to local network IP
          const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
          if (isLocalhost && info.ip && info.ip !== "localhost") {
            setBaseUrl(`http://${info.ip}:${window.location.port || info.port}`);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Render QR code onto canvas — lazy-load qrcode so Node.js internals don't crash the app bundle
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
    try {
      await fetch(`${API_BASE}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "session.event": eventName, "session.date": date }),
      });
      setActive({ event: eventName, date });
      setGlobalSession({ event: eventName, date });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleClearSession = async () => {
    await fetch(`${API_BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "session.event": "", "session.date": "" }),
    });
    setActive(null);
    setGlobalSession(null);
  };

  const handleDownload = () => {
    if (!canvasRef.current || !active) return;

    // Draw final printable image: QR + title + date
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

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);

    // Title
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(active.event, out.width / 2, padding + 30);

    // Date
    const displayDate = new Date(active.date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    ctx.fillStyle = "#64748b";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(displayDate, out.width / 2, padding + titleH + 18);

    // QR
    ctx.drawImage(canvasRef.current, padding, padding + titleH + dateH, qrSize, qrSize);

    // Footer URL
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.fillText(checkinUrl, out.width / 2, out.height - 10);

    // Download
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

          {/* Network URL row */}
          <div className="w-full bg-muted/30 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5" /> QR points to
              </span>
              <button
                onClick={() => setEditingUrl((v) => !v)}
                className="text-xs text-primary font-semibold hover:underline"
              >
                {editingUrl ? "Done" : "Edit"}
              </button>
            </div>
            {editingUrl ? (
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value.trim())}
                className="w-full px-2 py-1.5 rounded-lg border text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            ) : (
              <div className="text-xs font-mono text-foreground break-all">{checkinUrl}</div>
            )}
            {(baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) && (
              <p className="text-[11px] text-amber-600 font-semibold">
                ⚠ This URL only works on this computer. Phones won't be able to scan it — restart the app to auto-detect the tunnel URL, or edit manually.
              </p>
            )}
            {baseUrl.startsWith("https://") && (
              <p className="text-[11px] text-green-600 font-semibold">
                ✓ Tunnel URL — works from any network, not just local WiFi.
              </p>
            )}
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
            This QR code never changes — players scan it to check in or register.
            The event label is just for the printout.
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
    </div>
  );
}

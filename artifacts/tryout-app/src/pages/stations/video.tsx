import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Video, Square, Play, ArrowLeft, Trash2, ChevronRight, UserPlus, CheckCircle2, X } from "lucide-react";
import { saveRecording, listRecordings, getRecording, deleteRecording, type Recording, type PlayerTag } from "@/lib/video-db";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type Player = { id: number; name: string; jerseyNumber?: string | null; position?: string | null; checkedIn?: boolean | null };

const POSITION_LABELS: Record<string, string> = {
  Setter: "Setter",
  OutsideHitter: "Outside Hitter",
  MiddleBlocker: "Middle Blocker",
  Opposite: "Opposite",
  Libero: "Libero / DS",
};

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ── Sub-in / sub-out overlay ─────────────────────────────────────────────────

function SubInOverlay({ allPlayers, courtPlayers, onAdd, onRemove, onClose }: {
  allPlayers: Player[];
  courtPlayers: Player[];
  onAdd: (p: Player) => void;
  onRemove: (id: number) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"in" | "out">("in");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const activeIds = new Set(courtPlayers.map((p) => p.id));

  const available = allPlayers
    .filter((p) => !activeIds.has(p.id))
    .filter((p) =>
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.jerseyNumber ?? "").includes(search)
    )
    .slice(0, 16);

  return (
    <div className="absolute inset-0 bg-black/80 z-50 flex flex-col p-4 gap-3">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          placeholder={tab === "in" ? "Search player to sub in…" : "Search player to remove…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-3 rounded-2xl bg-gray-800 text-white placeholder-gray-500 text-sm focus:outline-none"
        />
        <button onClick={onClose} aria-label="Close" className="p-3 rounded-2xl bg-gray-800 text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tab toggle */}
      <div className="grid grid-cols-2 gap-1 bg-gray-800 rounded-xl p-1">
        {(["in", "out"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSearch(""); }}
            className={`py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-gray-600 text-white" : "text-gray-400"}`}
          >
            {t === "in" ? "Sub In" : "Sub Out"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 overflow-y-auto">
        {tab === "in" ? (
          <>
            {available.map((p) => (
              <button
                key={p.id}
                onClick={() => { onAdd(p); onClose(); }}
                className="px-3 py-3 rounded-2xl bg-gray-800 text-white text-sm font-semibold text-left active:bg-primary active:text-primary-foreground transition-colors touch-manipulation"
              >
                {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}{p.name}
                {p.position && <span className="block text-xs text-gray-400 mt-0.5">{POSITION_LABELS[p.position] ?? p.position}</span>}
              </button>
            ))}
            {available.length === 0 && <p className="col-span-2 text-gray-500 text-sm py-4 text-center">No players found</p>}
          </>
        ) : (
          <>
            {courtPlayers
              .filter((p) =>
                !search.trim() ||
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.jerseyNumber ?? "").includes(search)
              )
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onRemove(p.id); onClose(); }}
                  className="px-3 py-3 rounded-2xl bg-gray-800 text-white text-sm font-semibold text-left active:bg-red-600 transition-colors touch-manipulation flex items-start justify-between gap-2"
                >
                  <span>
                    {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}{p.name}
                  </span>
                  <X className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                </button>
              ))}
            {courtPlayers.length === 0 && <p className="col-span-2 text-gray-500 text-sm py-4 text-center">No players on court</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ── Active recording screen ──────────────────────────────────────────────────

function RecordScreen({ slug, courtPlayers, allPlayers, label, onDone }: {
  slug: string;
  courtPlayers: Player[];
  allPlayers: Player[];
  label: string;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [tags, setTags] = useState<PlayerTag[]>([]);
  const [liveRoster, setLiveRoster] = useState<Player[]>(courtPlayers);
  const [subbedOut, setSubbedOut] = useState<Set<number>>(new Set());
  const [recentTag, setRecentTag] = useState<string | null>(null);
  const [showSubIn, setShowSubIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [jerseySearch, setJerseySearch] = useState("");

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true })
      .then((s) => { setStream(s); if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => setCameraError("Camera access denied. Allow camera in Safari Settings → tryoutdesk.com → Camera."));
    return () => { mediaRecorderRef.current?.stop(); };
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (!recording) return;
    const interval = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 500);
    return () => clearInterval(interval);
  }, [recording]);

  // Physical keyboard support — same dial pad target, but for laptop/desktop
  // setups where typing digits is faster than tapping the on-screen pad.
  useEffect(() => {
    if (!recording || showSubIn) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setJerseySearch((prev) => (prev + e.key).slice(0, 3));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setJerseySearch((prev) => prev.slice(0, -1));
      } else if (e.key === "Escape") {
        setJerseySearch("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [recording, showSubIn]);

  const startRecording = () => {
    if (!stream) return;
    const mimeType = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
    const mr = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(1000);
    mediaRecorderRef.current = mr;
    startTimeRef.current = Date.now();
    setRecording(true);
    setElapsed(0);
    setTags([]);
  };

  const stopAndSave = async () => {
    const mr = mediaRecorderRef.current;
    if (!mr || !recording) return;
    setSaving(true);
    await new Promise<void>((resolve) => { mr.onstop = () => resolve(); mr.stop(); });
    const blob = new Blob(chunksRef.current, { type: mr.mimeType || "video/webm" });
    const rec: Recording = {
      id: crypto.randomUUID(),
      clubSlug: slug,
      date: new Date().toISOString().slice(0, 10),
      label,
      durationMs: Date.now() - startTimeRef.current,
      blob,
      tags,
      createdAt: Date.now(),
    };
    await saveRecording(rec);
    setRecording(false);
    setSaving(false);
    onDone();
  };

  // Tapping to tag always lags the actual rep by a beat of reaction time —
  // back the timestamp up so it lands on the rep instead of on whoever
  // rotated into that spot next.
  const TAG_LOOKBACK_MS = 3500;

  const tagPlayer = useCallback((player: Player) => {
    if (!recording) return;
    setTags((prev) => [...prev, {
      playerId: player.id,
      playerName: player.name,
      jerseyNumber: player.jerseyNumber,
      timestampMs: Math.max(0, Date.now() - startTimeRef.current - TAG_LOOKBACK_MS),
    }]);
    setRecentTag(player.name);
    setTimeout(() => setRecentTag(null), 1800);
  }, [recording]);

  const activeCourt = liveRoster.filter((p) => !subbedOut.has(p.id));
  const jerseyMatches = jerseySearch.trim()
    ? activeCourt.filter((p) =>
        (p.jerseyNumber ?? "").includes(jerseySearch.trim()) ||
        p.name.toLowerCase().includes(jerseySearch.trim().toLowerCase())
      )
    : [];
  const exactJerseyMatch = activeCourt.find((p) => p.jerseyNumber === jerseySearch.trim());

  // As soon as the typed digits uniquely match a jersey number, tag immediately —
  // no extra tap needed once the number is fully entered.
  useEffect(() => {
    if (!exactJerseyMatch) return;
    tagPlayer(exactJerseyMatch);
    setJerseySearch("");
  }, [exactJerseyMatch, tagPlayer]);

  const subIn = (player: Player) => {
    setLiveRoster((prev) => prev.some((p) => p.id === player.id) ? prev : [...prev, player]);
    setSubbedOut((prev) => { const next = new Set(prev); next.delete(player.id); return next; });
  };
  const subOut = (playerId: number) => setSubbedOut((prev) => new Set([...prev, playerId]));

  if (cameraError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <Video className="h-12 w-12 text-red-400 mx-auto" />
          <p className="text-white font-semibold">{cameraError}</p>
          <button onClick={onDone} className="px-6 py-3 rounded-2xl bg-white text-gray-900 font-bold">← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col relative">
      {/* Camera preview */}
      <div className="relative" style={{ height: "38vh" }}>
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover bg-black" />
        {recording && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white font-mono font-bold text-sm">{formatDuration(elapsed)}</span>
            <span className="text-gray-400 text-xs ml-1">· {tags.length} tagged</span>
          </div>
        )}
        {recentTag && (
          <div className="absolute top-3 right-3 bg-green-500 text-white rounded-full px-3 py-1.5 font-bold text-sm flex items-center gap-1.5 shadow-lg">
            <CheckCircle2 className="h-4 w-4" />
            {recentTag}
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <p className="text-white/80 text-xs font-semibold bg-black/50 rounded-full px-3 py-1">{label}</p>
          {recording && (
            <button
              onClick={() => setShowSubIn(true)}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-xs font-bold shadow-lg active:scale-95 transition-all"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Sub in
            </button>
          )}
        </div>
      </div>

      {/* Player tap grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {!recording ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <p className="text-gray-400 text-sm">{liveRoster.length} player{liveRoster.length !== 1 ? "s" : ""} on court</p>
              <div className="flex gap-3">
                <button onClick={onDone} className="h-12 px-5 rounded-2xl bg-gray-800 text-white font-bold flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={startRecording}
                  disabled={!stream}
                  className="h-12 px-8 rounded-2xl bg-red-600 text-white font-bold text-base flex items-center gap-2 active:scale-95 transition-all disabled:opacity-40"
                >
                  <Video className="h-5 w-5" />
                  Start Recording
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-stretch gap-3 mb-3">
              {/* Readout */}
              <div className="w-20 shrink-0 rounded-2xl bg-gray-800 flex items-center justify-center relative">
                <span className="text-3xl font-black text-white tabular-nums">{jerseySearch || "#"}</span>
                {jerseySearch && (
                  <button
                    onClick={() => setJerseySearch("")}
                    className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-gray-700 text-gray-300 flex items-center justify-center"
                    aria-label="Clear"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {/* Dial pad */}
              <div className="grid grid-cols-3 gap-1.5 flex-1">
                {["1","2","3","4","5","6","7","8","9"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setJerseySearch((prev) => (prev + d).slice(0, 3))}
                    className="rounded-xl bg-gray-800 text-white font-bold text-lg active:bg-primary active:text-primary-foreground transition-colors touch-manipulation select-none"
                  >
                    {d}
                  </button>
                ))}
                <button
                  onClick={() => setJerseySearch("")}
                  className="rounded-xl bg-gray-800 text-gray-400 font-bold text-xs active:bg-red-600 active:text-white transition-colors touch-manipulation select-none"
                >
                  Clear
                </button>
                <button
                  onClick={() => setJerseySearch((prev) => (prev + "0").slice(0, 3))}
                  className="rounded-xl bg-gray-800 text-white font-bold text-lg active:bg-primary active:text-primary-foreground transition-colors touch-manipulation select-none"
                >
                  0
                </button>
                <button
                  onClick={() => setJerseySearch((prev) => prev.slice(0, -1))}
                  className="rounded-xl bg-gray-800 text-gray-400 font-bold text-lg active:bg-primary active:text-primary-foreground transition-colors touch-manipulation select-none flex items-center justify-center"
                  aria-label="Backspace"
                >
                  ⌫
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {(jerseySearch.trim() ? jerseyMatches : liveRoster).map((p) => {
                const isOut = subbedOut.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => { tagPlayer(p); setJerseySearch(""); }}
                    className={`px-3 py-4 rounded-2xl font-bold text-base text-left active:bg-primary active:text-primary-foreground transition-colors touch-manipulation select-none ${isOut ? "bg-gray-800/50 text-gray-500" : "bg-gray-800 text-white"}`}
                  >
                    {p.jerseyNumber && <span className={`text-sm font-normal ${isOut ? "text-gray-600" : "text-gray-400"}`}>#{p.jerseyNumber} </span>}
                    {p.name}
                    {isOut && <span className="block text-[10px] text-gray-600 font-normal mt-0.5">subbed out</span>}
                  </button>
                );
              })}
              {jerseySearch.trim() && jerseyMatches.length === 0 && (
                <p className="col-span-2 text-gray-500 text-sm py-4 text-center">No players found</p>
              )}
            </div>
            <button
              onClick={stopAndSave}
              disabled={saving}
              className="w-full h-14 rounded-2xl bg-white text-gray-900 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
            >
              {saving ? "Saving…" : (<><Square className="h-5 w-5 fill-gray-900" /> Stop & Save</>)}
            </button>
          </>
        )}
      </div>

      {showSubIn && (
        <SubInOverlay
          allPlayers={allPlayers}
          courtPlayers={liveRoster.filter((p) => !subbedOut.has(p.id))}
          onAdd={subIn}
          onRemove={subOut}
          onClose={() => setShowSubIn(false)}
        />
      )}
    </div>
  );
}

// ── Court setup screen ───────────────────────────────────────────────────────

type SetupMode = "position" | "custom";

function SetupScreen({ allPlayers: initialPlayers, onStart }: {
  allPlayers: Player[];
  onStart: (label: string, courtPlayers: Player[]) => void;
}) {
  const [mode, setMode] = useState<SetupMode>("position");
  const [position, setPosition] = useState("");
  const [courtLabel, setCourtLabel] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [allPlayers, setAllPlayers] = useState<Player[]>(initialPlayers);

  // Fetch fresh on mount so counts are accurate even if parent hadn't loaded yet
  useEffect(() => {
    const slug = localStorage.getItem("tryoutdesk_club_slug");
    if (!slug) return;
    fetch(`${API_BASE}/api/players/public/${slug}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAllPlayers(data); })
      .catch(() => {});
  }, []);

  // Always show all standard positions; counts come from player data
  const positions = Object.keys(POSITION_LABELS);

  const checkedIn = allPlayers.filter((p) => p.checkedIn);
  const notCheckedIn = allPlayers.filter((p) => !p.checkedIn);

  // Position mode: auto-select checked-in players at that position
  const positionPlayers = position
    ? [
        ...checkedIn.filter((p) => p.position === position),
        ...notCheckedIn.filter((p) => p.position === position),
      ]
    : [];

  // Custom mode: filter for search
  const searchFiltered = search.trim()
    ? allPlayers.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.jerseyNumber ?? "").includes(search)
      )
    : [...checkedIn, ...notCheckedIn];

  const togglePick = (id: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const buildLabel = () => {
    const parts = [];
    if (mode === "position" && position) parts.push(POSITION_LABELS[position] ?? position);
    if (courtLabel.trim()) parts.push(courtLabel.trim());
    return parts.join(" – ") || "Court Recording";
  };

  const canStart = mode === "position"
    ? positionPlayers.length > 0
    : picked.size > 0;

  const handleStart = () => {
    const courtPlayers = mode === "position"
      ? positionPlayers
      : allPlayers.filter((p) => picked.has(p.id));
    onStart(buildLabel(), courtPlayers);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-gray-900 text-white px-5 py-4">
        <p className="text-xs text-gray-400 font-medium">Video Station</p>
        <p className="font-bold text-lg">Set Up Court</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 bg-gray-200 rounded-2xl p-1">
          {(["position", "custom"] as SetupMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`py-2.5 rounded-xl font-semibold text-sm transition-all ${mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
            >
              {m === "position" ? "By Position" : "Custom Pick"}
            </button>
          ))}
        </div>

        {/* Court label */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Court label</label>
          <input
            type="text"
            placeholder="e.g. Court 1, Main Gym"
            value={courtLabel}
            onChange={(e) => setCourtLabel(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 text-sm focus:outline-none focus:border-primary bg-white"
          />
        </div>

        {mode === "position" ? (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Position</label>
              <div className="grid grid-cols-2 gap-2">
                {positions.map((pos) => {
                  const count = checkedIn.filter((p) => p.position === pos).length;
                  return (
                    <button
                      key={pos}
                      onClick={() => setPosition(pos)}
                      className={`px-4 py-3 rounded-2xl border-2 text-sm font-semibold text-left transition-all ${position === pos ? "border-primary bg-primary/5 text-primary" : "border-gray-200 bg-white text-gray-700"}`}
                    >
                      {POSITION_LABELS[pos] ?? pos}
                      <span className="block text-xs font-normal text-gray-400 mt-0.5">{count} checked in</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {positionPlayers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Players on this court ({positionPlayers.filter(p => p.checkedIn).length} checked in)
                </p>
                <div className="space-y-1.5">
                  {positionPlayers.map((p) => (
                    <div key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${p.checkedIn ? "bg-white" : "bg-gray-100 opacity-50"}`}>
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${p.checkedIn ? "bg-green-500" : "bg-gray-300"}`} />
                      <span className="font-semibold text-gray-900 text-sm">
                        {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}{p.name}
                      </span>
                      {!p.checkedIn && <span className="text-xs text-gray-400 ml-auto">not checked in</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Select players ({picked.size} picked)
              </label>
              <input
                type="text"
                placeholder="Search by name or jersey…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 text-sm focus:outline-none focus:border-primary bg-white mb-2"
              />
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {searchFiltered.map((p) => {
                  const isPicked = picked.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePick(p.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all touch-manipulation ${isPicked ? "bg-primary/10 border-2 border-primary" : "bg-white border-2 border-transparent"} ${!p.checkedIn ? "opacity-50" : ""}`}
                    >
                      <span className={`h-5 w-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${isPicked ? "bg-primary border-primary" : "border-gray-300"}`}>
                        {isPicked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                      </span>
                      <span className="font-semibold text-gray-900 text-sm flex-1">
                        {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}{p.name}
                      </span>
                      <span className="text-xs text-gray-400">{POSITION_LABELS[p.position ?? ""] ?? p.position ?? ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="p-5 border-t border-gray-200 bg-white">
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full h-14 rounded-2xl bg-red-600 text-white font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 shadow-md"
        >
          <Video className="h-5 w-5" />
          {canStart ? `Record — ${buildLabel()}` : "Select players to continue"}
        </button>
      </div>
    </div>
  );
}

// ── Review screen ────────────────────────────────────────────────────────────

function ReviewScreen({ recordingId, onBack }: { recordingId: string; onBack: () => void }) {
  const [rec, setRec] = useState<Recording | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    getRecording(recordingId).then((r) => {
      if (!r) return;
      setRec(r);
      setVideoUrl(URL.createObjectURL(r.blob));
    });
  }, [recordingId]);

  useEffect(() => {
    return () => { if (videoUrl) URL.revokeObjectURL(videoUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playerIds = rec ? [...new Set(rec.tags.map((t) => t.playerId))] : [];
  const playerMap = rec
    ? Object.fromEntries(rec.tags.map((t) => [t.playerId, { name: t.playerName, jersey: t.jerseyNumber }]))
    : {};

  const jumpTo = (ms: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = ms / 1000;
    videoRef.current.play();
  };

  if (!rec || !videoUrl) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <video ref={videoRef} src={videoUrl} controls playsInline className="w-full bg-black" style={{ maxHeight: "45vh" }} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-gray-800 text-white"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <p className="text-white font-bold">{rec.label}</p>
            <p className="text-gray-400 text-xs">{formatDate(rec.createdAt)} · {formatDuration(rec.durationMs)}</p>
          </div>
        </div>

        {playerIds.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No players were tagged in this recording.</p>
        ) : (
          <>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Tagged Players</p>
            {playerIds.map((pid) => {
              const info = playerMap[pid];
              const ptags = rec.tags.filter((t) => t.playerId === pid).sort((a, b) => a.timestampMs - b.timestampMs);
              const isOpen = selectedPlayer === pid;
              return (
                <div key={pid} className="rounded-2xl bg-gray-900 overflow-hidden">
                  <button
                    onClick={() => setSelectedPlayer(isOpen ? null : pid)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div>
                      <p className="text-white font-semibold">{info.jersey ? `#${info.jersey} ` : ""}{info.name}</p>
                      <p className="text-gray-400 text-xs">{ptags.length} moment{ptags.length !== 1 ? "s" : ""}</p>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 space-y-2">
                      {ptags.map((tag, i) => (
                        <button
                          key={i}
                          onClick={() => jumpTo(tag.timestampMs)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-800 text-white hover:bg-primary hover:text-primary-foreground transition-colors text-left"
                        >
                          <Play className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="font-mono text-sm">{formatDuration(tag.timestampMs)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ── Home screen ──────────────────────────────────────────────────────────────

type Screen = "home" | "setup" | "record" | "review";

export default function VideoStation() {
  const [, navigate] = useLocation();
  const [screen, setScreen] = useState<Screen>("home");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [courtPlayers, setCourtPlayers] = useState<Player[]>([]);
  const [courtLabel, setCourtLabel] = useState("");
  const [recordings, setRecordings] = useState<Omit<Recording, "blob">[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const slug = localStorage.getItem("tryoutdesk_club_slug") ?? "";

  const loadRecordings = useCallback(() => {
    if (slug) listRecordings(slug).then(setRecordings);
  }, [slug]);

  useEffect(() => { loadRecordings(); }, [loadRecordings]);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_BASE}/api/players/public/${slug}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAllPlayers(data); })
      .catch(() => {});
  }, [slug]);

  const handleSetupDone = (label: string, players: Player[]) => {
    setCourtLabel(label);
    setCourtPlayers(players);
    setScreen("record");
  };

  const staff = (() => { try { return JSON.parse(localStorage.getItem("tryoutdesk_staff") ?? "{}"); } catch { return {}; } })();

  if (screen === "setup") return <SetupScreen allPlayers={allPlayers} onStart={handleSetupDone} />;

  if (screen === "record") {
    return (
      <RecordScreen
        slug={slug}
        courtPlayers={courtPlayers}
        allPlayers={allPlayers}
        label={courtLabel}
        onDone={() => { setScreen("home"); loadRecordings(); }}
      />
    );
  }

  if (screen === "review" && reviewId) {
    return <ReviewScreen recordingId={reviewId} onBack={() => setScreen("home")} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-gray-900 text-white px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 font-medium">Video Station</p>
          <p className="font-bold text-lg">{staff.name ?? "Coach"}</p>
        </div>
        <button onClick={() => navigate("/station")} className="text-xs text-gray-400 hover:text-white transition-colors">Switch role</button>
      </div>

      <div className="p-5">
        <button
          onClick={() => setScreen("setup")}
          className="w-full h-20 rounded-3xl bg-red-600 text-white font-bold text-xl flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"
        >
          <Video className="h-7 w-7" />
          New Recording
        </button>
        <p className="text-center text-xs text-gray-400 mt-3">Select court & players, then record and tag moments</p>
      </div>

      <div className="flex-1 px-5 space-y-3">
        {recordings.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Video className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No recordings yet</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Saved on this device</p>
            {recordings.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => { setReviewId(r.id); setScreen("review"); }}
                  className="w-full flex items-center gap-4 px-4 py-4 text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                    <Play className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{r.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(r.createdAt)} · {formatDuration(r.durationMs)} · {r.tags.length} tag{r.tags.length !== 1 ? "s" : ""}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                </button>
                <div className="border-t border-gray-100 px-4 py-2 flex justify-end">
                  <button
                    onClick={() => deleteRecording(r.id).then(loadRecordings)}
                    className="flex items-center gap-1.5 text-xs text-red-500 font-medium py-1 px-2 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="h-8" />
    </div>
  );
}

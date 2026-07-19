import { useState, useCallback, useRef, useEffect } from "react";
import { useListPlayers, useListCoaches, useUpsertEvaluation, getListRankingsQueryKey, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useActiveSession } from "@/hooks/use-active-session";
import { useQueryClient } from "@tanstack/react-query";
import { StationShell } from "@/components/station-shell";
import { Mic, MicOff, CheckCircle2, User, ChevronDown, Search, AlertTriangle, ListOrdered } from "lucide-react";
import { positionLabel } from "@/lib/positions";
import { StationRankings } from "@/components/station-rankings";

// ── Skills ─────────────────────────────────────────────────────────────────────
const SKILLS: { label: string; skill: string; category: "universal" | "position"; mandatory?: boolean }[] = [
  { label: "Serving",      skill: "Serving",          category: "universal", mandatory: true },
  { label: "Defense",      skill: "Defense",           category: "universal", mandatory: true },
  { label: "Attacking",    skill: "Attacking",         category: "position",  mandatory: true },
  { label: "Srv Receive",  skill: "Serve receive",     category: "position",  mandatory: true },
  { label: "Setting",      skill: "Setting",             category: "position",  mandatory: true },
  { label: "Passing",      skill: "Passing",           category: "universal" },
  { label: "IQ",           skill: "Volleyball IQ",     category: "universal" },
  { label: "Comms",        skill: "Communication",     category: "universal" },
  { label: "Coachability", skill: "Coachability",      category: "universal" },
  { label: "Competitive",  skill: "Competitiveness",   category: "universal" },
  { label: "Consistency",  skill: "Consistency",       category: "universal" },
  { label: "Blocking",     skill: "Blocking",          category: "position" },
  { label: "Transition",   skill: "Transition",        category: "position" },
  { label: "Footwork",     skill: "Footwork",          category: "position" },
  { label: "Leadership",   skill: "Leadership",        category: "position" },
  { label: "Physical",     skill: "Physical upside",   category: "position" },
];

const NUMBER_WORDS: Record<string, number> = {
  one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
  eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,
  sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,
};

function toNumber(t: string): number | null {
  const n = NUMBER_WORDS[t.toLowerCase()];
  if (n !== undefined) return n;
  const p = parseInt(t);
  return isNaN(p) ? null : p;
}

function parseTranscript(transcript: string): { jersey: string; score: number } | null {
  const text = transcript.toLowerCase().replace(/[,\.!?\/]/g, " ").replace(/\s+/g, " ").trim();
  const tokens = text.split(" ").slice(-6);
  const numbers: { idx: number; value: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const n = toNumber(tokens[i]);
    if (n !== null) numbers.push({ idx: i, value: n });
  }
  const jerseyEntry = numbers.find(n => n.value >= 1 && n.value <= 999);
  const scoreEntry = numbers.filter(n => n.value >= 1 && n.value <= 10).pop();
  if (!jerseyEntry || !scoreEntry || jerseyEntry.idx === scoreEntry.idx) return null;
  if (jerseyEntry.idx >= scoreEntry.idx) return null;
  return { jersey: String(jerseyEntry.value), score: scoreEntry.value };
}

// ── Web Speech API hook ─────────────────────────────────────────────────────────
function useBrowserSpeech(onTranscript: (t: string) => void) {
  const [active, setActive] = useState(false);
  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(false);
  const submittedRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const supported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const stop = useCallback(() => {
    activeRef.current = false;
    submittedRef.current = false;
    setActive(false);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (!supported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = "en-US";
    r.maxAlternatives = 5;
    recognitionRef.current = r;
    activeRef.current = true;
    submittedRef.current = false;
    setActive(true);

    r.onresult = (e: any) => {
      if (!activeRef.current || submittedRef.current) return;
      const t = Array.from(e.results).map((res: any) => res[0].transcript).join(" ");
      if (t) onTranscriptRef.current(t);
    };
    r.onend = () => {
      if (activeRef.current) { activeRef.current = false; setActive(false); submittedRef.current = false; }
    };
    r.onerror = () => stop();
    r.start();
  }, [supported, stop]);

  const markSubmitted = useCallback(() => {
    submittedRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { active, start, stop, markSubmitted, supported };
}

// ── Component ───────────────────────────────────────────────────────────────────
interface LogEntry { id: number; jersey: string; name: string; score: number; skill: string; }

export default function EvaluationStation() {
  const queryClient = useQueryClient();
  const [coachName, setCoachName] = useState(() => {
    try {
      const staff = localStorage.getItem("tryoutdesk_staff");
      return staff ? (JSON.parse(staff).name ?? "") : "";
    } catch { return ""; }
  });
  const [showCoachPicker, setShowCoachPicker] = useState(false);
  const [currentSkill, setCurrentSkill] = useState(SKILLS[0]);
  const [showSecondary, setShowSecondary] = useState(false);
  const [scoreScale, setScoreScale] = useState<5 | 10>(5);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: number; name: string; jerseyNumber?: string | null } | null>(null);
  const [flash, setFlash] = useState<{ score: number; name: string } | null>(null);
  const [showRankings, setShowRankings] = useState(false);

  // Voice
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const markSubmittedRef = useRef<() => void>(() => {});

  const upsert = useUpsertEvaluation();
  const { sessionAge } = useActiveSession();

  const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const [publicPlayers, setPublicPlayers] = useState<{ id: number; name: string; jerseyNumber?: string | null; position?: string | null; age?: string | null; checkedIn?: boolean | null }[] | null>(null);
  const [publicPlayersError, setPublicPlayersError] = useState(false);
  useEffect(() => {
    const slug = localStorage.getItem("tryoutdesk_club_slug");
    if (!slug) return;
    fetch(`${API_BASE}/api/players/public/${slug}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPublicPlayers(data); else setPublicPlayersError(true); })
      .catch(() => setPublicPlayersError(true));
  }, [API_BASE]);

  const { data: authedPlayers, isError: authedPlayersError, refetch: refetchPlayers } = useListPlayers({}, { query: { queryKey: getListPlayersQueryKey({}), enabled: publicPlayers === null } });
  const allPlayers = publicPlayers ?? authedPlayers ?? [];
  const playersLoadFailed = publicPlayers === null && publicPlayersError && authedPlayersError;
  const players = sessionAge
    ? allPlayers.filter((p) => !p.age || (p.age ?? "").replace(/U$/i, "") === sessionAge)
    : allPlayers;
  const { data: coaches } = useListCoaches();
  const evaluators = coaches?.filter((c) => c.teamName === "Evaluator") ?? [];

  const submitScore = useCallback((player: { id: number; name: string; jerseyNumber?: string | null }, score: number) => {
    // Show feedback immediately — don't wait for API response
    setFlash({ score, name: player.name });
    setLog((prev) => [
      { id: Date.now(), jersey: player.jerseyNumber ?? "?", name: player.name, score, skill: currentSkill.skill },
      ...prev.slice(0, 9),
    ]);
    setSelectedPlayer(null);
    setSearch("");

    upsert.mutate(
      { data: { playerId: player.id, coachName, skill: currentSkill.skill, category: currentSkill.category, score } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRankingsQueryKey({}) }) }
    );
  }, [coachName, currentSkill, upsert, queryClient]);

  const processTranscript = useCallback((transcript: string) => {
    setLastHeard(transcript);
    const parsed = parseTranscript(transcript);
    if (!parsed || !players.length) return;
    const player = players.find((p) => p.jerseyNumber === parsed.jersey);
    if (!player) return;
    markSubmittedRef.current();
    submitScore(player, parsed.score);
  }, [players, submitScore]);

  const { active, start, stop, markSubmitted, supported } = useBrowserSpeech(processTranscript);
  markSubmittedRef.current = markSubmitted;

  const filteredPlayers = search.trim().length >= 1
    ? players.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.jerseyNumber ?? "").includes(search)
      ).slice(0, 6)
    : [];

  return (
    <StationShell title="Evaluation" color="bg-purple-600">
      {showRankings && <StationRankings onClose={() => setShowRankings(false)} />}
      <div className="max-w-lg mx-auto p-4 space-y-4">

        <button
          onClick={() => setShowRankings(true)}
          className="w-full flex items-center gap-2 bg-white border-2 border-purple-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-purple-700 hover:border-purple-400 transition-colors"
        >
          <ListOrdered className="h-4 w-4" /> View Rankings &amp; Compare Players
        </button>

        {playersLoadFailed && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 font-bold">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="flex-1">Couldn't load players. Check your connection.</span>
            <button onClick={() => refetchPlayers()} className="underline text-sm font-semibold shrink-0">Retry</button>
          </div>
        )}

        {/* Coach selector */}
        <button
          onClick={() => setShowCoachPicker(!showCoachPicker)}
          className="w-full flex items-center gap-3 bg-white border-2 border-purple-200 rounded-xl px-4 py-3 hover:border-purple-400 transition-colors"
        >
          <User className="h-5 w-5 text-purple-500 shrink-0" />
          <span className={`flex-1 text-left font-semibold ${coachName ? "text-foreground" : "text-muted-foreground"}`}>
            {coachName || "Select evaluator…"}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        {showCoachPicker && (
          <div className="bg-white border-2 border-purple-100 rounded-xl shadow-lg p-3 space-y-1.5">
            {evaluators.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">No evaluators found. Add them under Coaches.</p>
            )}
            {evaluators.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCoachName(c.name); setShowCoachPicker(false); }}
                className={`w-full text-left px-4 py-2.5 rounded-lg font-semibold transition-colors
                  ${coachName === c.name ? "bg-purple-100 text-purple-700" : "hover:bg-muted/50"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Skill selector */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {SKILLS.filter((s) => s.mandatory).map((s) => (
              <button key={s.skill} onClick={() => setCurrentSkill(s)}
                className={`px-3 py-1 rounded-full text-sm font-semibold border transition-all
                  ${currentSkill.skill === s.skill
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-500"}`}>
                {s.label}
              </button>
            ))}
            <span className="self-center text-[10px] font-bold uppercase tracking-widest text-amber-600/70 pl-0.5">Required</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {showSecondary && SKILLS.filter((s) => !s.mandatory).map((s) => (
              <button key={s.skill} onClick={() => setCurrentSkill(s)}
                className={`px-3 py-1 rounded-full text-sm font-semibold border transition-all
                  ${currentSkill.skill === s.skill
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:border-border"}`}>
                {s.label}
              </button>
            ))}
            <button onClick={() => { setShowSecondary((v) => !v); if (showSecondary) setCurrentSkill(SKILLS[0]); }}
              className="px-3 py-1 rounded-full text-sm font-semibold border transition-all bg-muted/40 text-muted-foreground border-transparent hover:border-border">
              {showSecondary ? "− Secondary" : "+ Secondary"}
            </button>
          </div>
        </div>

        {/* ── Tap UI ── */}
        <div className="bg-white border-2 border-purple-100 rounded-2xl p-4 space-y-3">
          {/* Player search */}
          {!selectedPlayer ? (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Player</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Name or jersey #…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              {filteredPlayers.length > 0 && (
                <div className="space-y-1">
                  {filteredPlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPlayer(p); setSearch(""); setFlash(null); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-purple-50 text-left transition-colors"
                    >
                      <span className="font-black text-purple-600 w-8 text-center">#{p.jerseyNumber ?? "?"}</span>
                      <span className="font-semibold text-sm">{p.name}</span>
                      {p.position && <span className="text-xs text-muted-foreground ml-auto">{positionLabel(p.position)}</span>}
                    </button>
                  ))}
                </div>
              )}
              {search.trim().length >= 1 && filteredPlayers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">No players found</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-black text-2xl text-purple-600">#{selectedPlayer.jerseyNumber ?? "?"}</span>
                  <span className="font-bold">{selectedPlayer.name}</span>
                </div>
                <button onClick={() => setSelectedPlayer(null)} className="text-xs text-muted-foreground hover:text-foreground underline">
                  Change
                </button>
              </div>

              {/* Score buttons */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Score — {currentSkill.label}
                  </label>
                  <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
                    {([5, 10] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setScoreScale(s)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all
                          ${scoreScale === s ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}
                      >
                        1–{s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={`grid gap-2 ${scoreScale === 5 ? "grid-cols-5" : "grid-cols-5"}`}>
                  {Array.from({ length: scoreScale }, (_, i) => i + 1).map((score) => {
                    const pct = score / scoreScale;
                    const color = pct >= 0.7
                      ? "bg-green-100 text-green-700 hover:bg-green-200 border-2 border-green-200"
                      : pct >= 0.4
                      ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-2 border-yellow-200"
                      : "bg-red-50 text-red-600 hover:bg-red-100 border-2 border-red-200";
                    return (
                      <button
                        key={score}
                        onClick={() => submitScore(selectedPlayer, score)}
                        disabled={upsert.isPending}
                        className={`py-3 rounded-xl font-black text-lg transition-all active:scale-95 disabled:opacity-50 ${color}`}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Last score confirmation — stays visible until next player is selected */}
        {flash && (
          <div className="flex items-center gap-4 bg-green-50 border-2 border-green-200 rounded-2xl px-5 py-4 animate-in fade-in">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-green-600 mb-0.5">Score saved</p>
              <p className="font-bold text-green-900 truncate">{flash.name}</p>
            </div>
            <div className="text-4xl font-black text-green-600 tabular-nums">{flash.score}</div>
          </div>
        )}

        {/* ── Voice toggle ── */}
        <div className="border-t pt-3">
          <button
            onClick={() => { setVoiceEnabled((v) => !v); if (active) stop(); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mic className="h-4 w-4" />
            {voiceEnabled ? "Disable voice input" : "Enable voice input (experimental)"}
          </button>

          {voiceEnabled && (
            <div className="mt-3 flex flex-col items-center gap-3 py-4">
              {!supported ? (
                <p className="text-sm text-red-500 font-semibold">Voice not supported. Use Chrome or Safari.</p>
              ) : (
                <>
                  <button
                    onClick={active ? stop : start}
                    disabled={!coachName}
                    className={`relative flex items-center justify-center w-20 h-20 rounded-full border-4 transition-all shadow-lg active:scale-95 disabled:opacity-40
                      ${active ? "bg-red-500 border-red-600 text-white" : "bg-purple-600 border-purple-700 text-white"}`}
                  >
                    {active && <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />}
                    {active ? <MicOff className="h-7 w-7 relative z-10" /> : <Mic className="h-7 w-7 relative z-10" />}
                  </button>
                  <p className="text-xs text-muted-foreground text-center">
                    {active ? <span className="text-red-500 font-bold">Listening… say jersey + score</span>
                      : 'Tap · say "21 seven" · tap again'}
                  </p>
                  {lastHeard && <p className="text-xs text-muted-foreground/60 truncate max-w-xs">Heard: <em>"{lastHeard}"</em></p>}
                </>
              )}
            </div>
          )}
        </div>

        {/* Log */}
        {log.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent</p>
            {log.map((entry, idx) => (
              <button key={entry.id}
                onClick={() => {
                  const p = allPlayers.find(p => p.jerseyNumber === entry.jersey);
                  if (p) { setSelectedPlayer({ id: p.id, name: p.name, jerseyNumber: p.jerseyNumber }); setSearch(""); }
                }}
                className={`touch-manipulation w-full flex items-center gap-3 p-3 rounded-xl border transition-opacity text-left active:scale-95
                  ${idx === 0 ? "bg-white border-border" : "bg-transparent border-transparent opacity-40"}`}>
                <span className="font-black text-xl text-purple-600 tabular-nums w-8 text-center">#{entry.jersey}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-sm truncate block">{entry.name}</span>
                  <span className="text-xs text-muted-foreground">{entry.skill}</span>
                </div>
                <span className={`text-2xl font-black tabular-nums ${entry.score >= 8 ? "text-green-600" : entry.score >= 5 ? "text-yellow-600" : "text-red-500"}`}>
                  {entry.score}
                </span>
                {idx === 0 && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
              </button>
            ))}
          </div>
        )}

      </div>
    </StationShell>
  );
}

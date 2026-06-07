import { useState, useCallback, useRef, useEffect } from "react";
import { useListPlayers, useUpsertEvaluation, getListRankingsQueryKey } from "@workspace/api-client-react";
import { useActiveSession } from "@/hooks/use-active-session";
import { useQueryClient } from "@tanstack/react-query";
import { StationShell } from "@/components/station-shell";
import { useStaffAuth } from "@/components/staff-gate";
import { Mic, MicOff, CheckCircle2, Hand } from "lucide-react";
import { positionLabel } from "@/lib/positions";
import { HelpButton } from "@/components/help-modal";

const HELP = {
  title: "Evaluation Station",
  description: "Score players on individual skills during the tryout. Scores sync to the admin console in real time.",
  steps: [
    { step: 1, text: "Select your name from the evaluator dropdown at the top." },
    { step: 2, text: "Pick the skill you are currently evaluating (e.g. Serving, Defense)." },
    { step: 3, text: "Choose Voice or Tap mode depending on your preference." },
    { step: 4, text: "Voice: tap the mic button, say the jersey number then the score (e.g. \"21 seven\"), tap again to stop." },
    { step: 5, text: "Tap: find the player in the list, tap their name, then tap the score 1–10." },
  ],
  tips: [
    "Scores are on a 1–10 scale. Green = 8–10, Yellow = 5–7, Red = 1–4.",
    "Use Voice mode when players are moving quickly and you can't look at the screen.",
    "Use Tap mode when the gym is noisy or you want to be precise.",
    "The activity log at the bottom shows your last 10 entries. The top entry is the most recent.",
    "Tap '+ Secondary' to unlock additional skills like Blocking, Footwork, and Leadership.",
    "You can score the same player on multiple skills — each is saved separately.",
  ],
};

// ── Skills ─────────────────────────────────────────────────────────────────────
const SKILLS: { label: string; skill: string; category: "universal" | "position"; mandatory?: boolean }[] = [
  { label: "Serving",     skill: "Serving",      category: "universal", mandatory: true },
  { label: "Defense",     skill: "Defense",       category: "universal", mandatory: true },
  { label: "Attacking",   skill: "Attacking",     category: "position",  mandatory: true },
  { label: "Srv Receive", skill: "Serve receive", category: "position",  mandatory: true },
  { label: "Setting",     skill: "Hands",         category: "position",  mandatory: true },
  { label: "Passing",     skill: "Passing",       category: "universal" },
  { label: "IQ",          skill: "Volleyball IQ", category: "universal" },
  { label: "Comms",       skill: "Communication", category: "universal" },
  { label: "Coachability",skill: "Coachability",  category: "universal" },
  { label: "Competitive", skill: "Competitiveness",category: "universal" },
  { label: "Consistency", skill: "Consistency",   category: "universal" },
  { label: "Blocking",    skill: "Blocking",      category: "position" },
  { label: "Transition",  skill: "Transition",    category: "position" },
  { label: "Footwork",    skill: "Footwork",      category: "position" },
  { label: "Leadership",  skill: "Leadership",    category: "position" },
  { label: "Physical",    skill: "Physical upside",category: "position" },
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
  const { staff } = useStaffAuth();
  const coachName = staff?.name ?? "";
  const [currentSkill, setCurrentSkill] = useState(SKILLS[0]);
  const [showSecondary, setShowSecondary] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const markSubmittedRef = useRef<() => void>(() => {});
  const upsert = useUpsertEvaluation();
  const { sessionAge } = useActiveSession();
  const { data: allPlayers } = useListPlayers({});
  const players = sessionAge
    ? (allPlayers ?? []).filter((p) => (p.age ?? "") === sessionAge)
    : (allPlayers ?? []);

  const processTranscript = useCallback((transcript: string) => {
    setLastHeard(transcript);
    const parsed = parseTranscript(transcript);
    if (!parsed || !players.length) return;
    const player = players.find((p) => p.jerseyNumber === parsed.jersey);
    if (!player) return;
    markSubmittedRef.current();
    upsert.mutate(
      { data: { playerId: player.id, coachName, skill: currentSkill.skill, category: currentSkill.category, score: parsed.score } },
      {
        onSuccess: () => {
          setLog((prev) => [{ id: Date.now(), jersey: parsed.jersey, name: player.name, score: parsed.score, skill: currentSkill.skill }, ...prev.slice(0, 9)]);
          queryClient.invalidateQueries({ queryKey: getListRankingsQueryKey({}) });
        },
      }
    );
  }, [players, coachName, currentSkill, upsert, queryClient]);

  const { active, start, stop, markSubmitted, supported } = useBrowserSpeech(processTranscript);
  markSubmittedRef.current = markSubmitted;

  const [inputMode, setInputMode] = useState<"voice" | "tap">("voice");
  const [tapPlayer, setTapPlayer] = useState<(typeof players)[0] | null>(null);

  const submitTapScore = (score: number) => {
    if (!tapPlayer) return;
    upsert.mutate(
      { data: { playerId: tapPlayer.id, coachName, skill: currentSkill.skill, category: currentSkill.category, score } },
      {
        onSuccess: () => {
          setLog((prev) => [{ id: Date.now(), jersey: tapPlayer.jerseyNumber ?? "", name: tapPlayer.name, score, skill: currentSkill.skill }, ...prev.slice(0, 9)]);
          queryClient.invalidateQueries({ queryKey: getListRankingsQueryKey({}) });
          setTapPlayer(null);
        },
      }
    );
  };

  const startSession = () => { start(); };

  return (
    <StationShell title="Evaluation" color="bg-purple-600" actions={<HelpButton {...HELP} />}>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Skill selector */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {SKILLS.filter((s) => s.mandatory).map((s) => (
              <button key={s.skill} onClick={() => setCurrentSkill(s)}
                className={`px-3 py-1 rounded-full text-sm font-semibold border transition-all
                  ${currentSkill.skill === s.skill ? "bg-primary text-primary-foreground border-primary"
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
                  ${currentSkill.skill === s.skill ? "bg-primary text-primary-foreground border-primary"
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

        {/* Mode toggle */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => { setInputMode("voice"); stop(); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all
              ${inputMode === "voice" ? "bg-purple-600 text-white border-purple-700" : "bg-white text-muted-foreground border-border hover:border-purple-300"}`}
          >
            <Mic className="h-4 w-4" /> Voice
          </button>
          <button
            onClick={() => { setInputMode("tap"); stop(); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all
              ${inputMode === "tap" ? "bg-purple-600 text-white border-purple-700" : "bg-white text-muted-foreground border-border hover:border-purple-300"}`}
          >
            <Hand className="h-4 w-4" /> Tap
          </button>
        </div>

        {/* Voice mode */}
        {inputMode === "voice" && (
          <div className="flex flex-col items-center py-6 gap-3">
            <button
              onClick={active ? stop : startSession}
              className={`relative flex items-center justify-center w-28 h-28 rounded-full border-4 transition-all shadow-lg active:scale-95
                ${active ? "bg-red-500 border-red-600 text-white shadow-red-200" : "bg-purple-600 border-purple-700 text-white shadow-purple-200"}`}
            >
              {active && <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />}
              {active ? <MicOff className="h-10 w-10 relative z-10" /> : <Mic className="h-10 w-10 relative z-10" />}
            </button>
            <div className="text-center">
              {!supported ? (
                <p className="text-sm text-red-500 font-semibold">Voice not supported in this browser. Use Chrome or Safari.</p>
              ) : active ? (
                <p className="text-red-500 font-bold text-sm">Listening… say jersey + score</p>
              ) : (
                <p className="text-sm text-muted-foreground">Tap · say <strong className="text-foreground">"21 seven"</strong> · tap again</p>
              )}
              {lastHeard && <p className="text-xs text-muted-foreground/60 mt-1 truncate max-w-xs">Heard: <em>"{lastHeard}"</em></p>}
            </div>
          </div>
        )}

        {/* Tap mode */}
        {inputMode === "tap" && (
          <div className="space-y-3">
            {tapPlayer ? (
              /* Score picker */
              <div className="bg-white border-2 border-purple-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-lg text-purple-700">#{tapPlayer.jerseyNumber} {tapPlayer.name}</p>
                    <p className="text-xs text-muted-foreground">{currentSkill.label}</p>
                  </div>
                  <button onClick={() => setTapPlayer(null)} className="text-xs text-muted-foreground hover:text-foreground underline">Back</button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <button
                      key={n}
                      onClick={() => submitTapScore(n)}
                      className={`py-3 rounded-xl font-black text-lg border-2 transition-all active:scale-95
                        ${n >= 8 ? "border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
                          : n >= 5 ? "border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100"
                          : "border-red-200 text-red-600 bg-red-50 hover:bg-red-100"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Player list */
              <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
                {players.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No players in this session.</p>
                )}
                {players
                  .slice()
                  .sort((a, b) => (parseInt(a.jerseyNumber ?? "0") || 0) - (parseInt(b.jerseyNumber ?? "0") || 0))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setTapPlayer(p)}
                      className="w-full flex items-center gap-3 bg-white border border-border rounded-xl px-4 py-3 hover:border-purple-300 hover:bg-purple-50 transition-colors active:scale-[0.99] text-left"
                    >
                      <span className="font-black text-purple-600 w-10 text-center tabular-nums">#{p.jerseyNumber}</span>
                      <span className="flex-1 font-semibold text-sm">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{positionLabel(p.position ?? "")}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div className="space-y-2">
            {log.map((entry, idx) => (
              <div key={entry.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-opacity
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
              </div>
            ))}
          </div>
        )}
      </div>
    </StationShell>
  );
}

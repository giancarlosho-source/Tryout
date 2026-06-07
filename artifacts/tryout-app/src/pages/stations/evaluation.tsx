import { useState, useCallback, useRef, useEffect } from "react";
import { useListPlayers, useListCoaches, useUpsertEvaluation, getListRankingsQueryKey } from "@workspace/api-client-react";
import { useActiveSession } from "@/hooks/use-active-session";
import { useQueryClient } from "@tanstack/react-query";
import { StationShell } from "@/components/station-shell";
import { Mic, MicOff, CheckCircle2, User, ChevronDown } from "lucide-react";
import { positionLabel } from "@/lib/positions";

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
  const [coachName, setCoachName] = useState("");
  const [showCoachPicker, setShowCoachPicker] = useState(false);
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
  const { data: coaches } = useListCoaches();
  const evaluators = coaches?.filter((c) => c.teamName === "Evaluator") ?? [];

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

  const startSession = () => {
    if (!coachName) { setShowCoachPicker(true); return; }
    start();
  };

  return (
    <StationShell title="Evaluation" color="bg-purple-600">
      <div className="max-w-lg mx-auto p-4 space-y-4">
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
              <p className="text-sm text-muted-foreground text-center py-2">No evaluators found. Add them in the console under Coaches.</p>
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

        {/* Mic */}
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

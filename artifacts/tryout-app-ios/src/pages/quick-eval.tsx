import { useState, useCallback, useRef } from "react";
import { useListPlayers, useUpsertEvaluation, getListRankingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Undo2, CheckCircle2, User, Zap } from "lucide-react";
import { CoachPicker } from "@/components/coach-picker";
import { useAlwaysOnSpeech } from "@/hooks/use-speech";

// ── Skills ────────────────────────────────────────────────────────────────────

const SKILLS: { label: string; skill: string; category: "universal" | "position"; mandatory?: boolean }[] = [
  { label: "Serving", skill: "Serving", category: "universal", mandatory: true },
  { label: "Defense", skill: "Defense", category: "universal", mandatory: true },
  { label: "Attacking", skill: "Attacking", category: "position", mandatory: true },
  { label: "Srv Receive", skill: "Serve receive", category: "position", mandatory: true },
  { label: "Setting", skill: "Hands", category: "position", mandatory: true },
  { label: "Passing", skill: "Passing", category: "universal" },
  { label: "IQ", skill: "Volleyball IQ", category: "universal" },
  { label: "Comms", skill: "Communication", category: "universal" },
  { label: "Coachability", skill: "Coachability", category: "universal" },
  { label: "Competitive", skill: "Competitiveness", category: "universal" },
  { label: "Consistency", skill: "Consistency", category: "universal" },
  { label: "Blocking", skill: "Blocking", category: "position" },
  { label: "Transition", skill: "Transition", category: "position" },
  { label: "Footwork", skill: "Footwork", category: "position" },
  { label: "Leadership", skill: "Leadership", category: "position" },
  { label: "Physical", skill: "Physical upside", category: "position" },
];

// ── Parse jersey + score only (skill set separately) ─────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

function toNumber(token: string): number | null {
  const n = NUMBER_WORDS[token.toLowerCase()];
  if (n !== undefined) return n;
  const parsed = parseInt(token);
  return isNaN(parsed) ? null : parsed;
}

function parseTranscript(transcript: string): { jersey: string; score: number } | null {
  const text = transcript.toLowerCase().replace(/[,\.!?\/]/g, " ").replace(/\s+/g, " ").trim();
  // Only look at the last 6 tokens to avoid matching stale accumulated speech
  const tokens = text.split(" ").slice(-6);

  const numbers: { idx: number; value: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const n = toNumber(tokens[i]);
    if (n !== null) numbers.push({ idx: i, value: n });
  }

  // Need at least 2 numbers: jersey (1-999) and score (1-10)
  // Jersey = first number in valid range, score = last number 1-10
  const jerseyEntry = numbers.find(n => n.value >= 1 && n.value <= 999);
  if (!jerseyEntry) return null;

  const scoreEntry = [...numbers].reverse().find(n => n.value >= 1 && n.value <= 10 && n.idx !== jerseyEntry.idx);
  if (!scoreEntry) return null;

  return { jersey: String(jerseyEntry.value), score: scoreEntry.value };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  playerName: string;
  jersey: string;
  skill: string;
  score: number;
  timestamp: Date;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuickEval() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [coachName, setCoachName] = useState("");
  const [coachDialogOpen, setCoachDialogOpen] = useState(false);
  const [currentSkill, setCurrentSkill] = useState(SKILLS[0]);
  const [showSecondary, setShowSecondary] = useState(false);

  const queryClient = useQueryClient();
  const { data: players } = useListPlayers({});
  const upsert = useUpsertEvaluation();

  // Ref so processTranscript can call markSubmitted without a circular TDZ
  const markSubmittedRef = useRef<() => void>(() => {});

  const processTranscript = useCallback((transcript: string) => {
    setLastHeard(transcript);
    const parsed = parseTranscript(transcript);
    if (!parsed || !players) return;

    const player = players.find((p) => p.jerseyNumber === parsed.jersey);
    if (!player) return;

    // Gate immediately so no duplicate partials sneak in before onSuccess fires
    markSubmittedRef.current();

    upsert.mutate(
      {
        data: {
          playerId: player.id,
          category: currentSkill.category,
          skill: currentSkill.skill,
          score: parsed.score,
          ...(coachName ? { coachName } : {}),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRankingsQueryKey() });
          setLog((prev) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              playerName: player.name,
              jersey: parsed.jersey,
              skill: currentSkill.skill,
              score: parsed.score,
              timestamp: new Date(),
            },
            ...prev.slice(0, 49),
          ]);
        },
      }
    );
  }, [players, coachName, currentSkill, upsert, queryClient]);

  const { active, start: startSpeech, stop: stopSpeech, markSubmitted } = useAlwaysOnSpeech(processTranscript);
  markSubmittedRef.current = markSubmitted;

  const startSession = useCallback(() => {
    setLog([]);
    setLastHeard(null);
    startSpeech();
  }, [startSpeech]);

  const undoLast = useCallback(() => {
    setLog((prev) => prev.slice(1));
  }, []);

  const scoreColor = (s: number) => {
    if (s >= 9) return "bg-emerald-100 text-emerald-700 border-emerald-300";
    if (s >= 7) return "bg-green-100 text-green-700 border-green-300";
    if (s >= 5) return "bg-yellow-100 text-yellow-700 border-yellow-300";
    if (s >= 3) return "bg-orange-100 text-orange-700 border-orange-300";
    return "bg-red-100 text-red-700 border-red-300";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-none p-4 pb-3 border-b">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Quick Eval
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 font-semibold" onClick={() => setCoachDialogOpen(true)}>
              <User className="h-4 w-4" />
              {coachName || "Coach"}
            </Button>
            {log.length > 0 && !active && (
              <Badge variant="outline" className="text-sm font-bold px-3 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                {log.length}
              </Badge>
            )}
          </div>
        </div>

        {/* Skill selector */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {SKILLS.filter((s) => s.mandatory).map((s) => (
              <button
                key={s.skill}
                onClick={() => setCurrentSkill(s)}
                className={`px-3 py-1 rounded-full text-sm font-semibold border transition-all
                  ${currentSkill.skill === s.skill
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-500"
                  }`}
              >
                {s.label}
              </button>
            ))}
            <span className="self-center text-[10px] font-bold uppercase tracking-widest text-amber-600/70 pl-0.5">Required</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {showSecondary && SKILLS.filter((s) => !s.mandatory).map((s) => (
              <button
                key={s.skill}
                onClick={() => setCurrentSkill(s)}
                className={`px-3 py-1 rounded-full text-sm font-semibold border transition-all
                  ${currentSkill.skill === s.skill
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:border-border"
                  }`}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={() => {
                setShowSecondary((v) => !v);
                if (showSecondary && !SKILLS.find((s) => !s.mandatory && s.skill === currentSkill.skill)) return;
                if (showSecondary) setCurrentSkill(SKILLS[0]);
              }}
              className="px-3 py-1 rounded-full text-sm font-semibold border transition-all bg-muted/40 text-muted-foreground border-transparent hover:border-border"
            >
              {showSecondary ? "− Secondary" : "+ Secondary"}
            </button>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mic area */}
        <div className="flex-none flex flex-col items-center justify-center py-8 gap-3 border-b">
          <button
            onClick={active ? stopSpeech : startSession}
            className={`relative flex items-center justify-center w-28 h-28 rounded-full border-4 transition-all shadow-lg active:scale-95
              ${active
                ? "bg-red-500 border-red-600 text-white shadow-red-200"
                : "bg-primary border-primary/80 text-primary-foreground shadow-primary/20"
              }`}
          >
            {active && (
              <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
            )}
            {active
              ? <MicOff className="h-10 w-10 relative z-10" />
              : <Mic className="h-10 w-10 relative z-10" />
            }
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-muted-foreground">
              {active
                ? <span className="text-red-500 font-bold">Listening… say jersey + score</span>
                : <span>Tap · say <span className="font-bold text-foreground">"21 seven"</span> · tap again</span>
              }
            </p>
            {lastHeard && (
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs truncate">
                Heard: <span className="italic">"{lastHeard}"</span>
              </p>
            )}
          </div>
        </div>

        {/* Log feed */}
        <div className="flex-1 overflow-auto px-4 py-3">
          {log.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Mic className="h-8 w-8 opacity-20" />
              <p className="text-sm">Scores will appear here as you speak</p>
            </div>
          ) : (
            <div className="max-w-lg mx-auto space-y-2">
              {log.map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-opacity
                    ${idx === 0 ? "bg-muted/40 border-border" : "bg-transparent border-transparent opacity-50"}`}
                >
                  <span className="font-black text-xl text-primary tabular-nums w-8 text-center">
                    #{entry.jersey}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-sm">{entry.playerName}</span>
                    <span className="text-muted-foreground text-xs"> · {entry.skill}</span>
                  </div>
                  <Badge variant="outline" className={`font-black text-base px-3 tabular-nums border ${scoreColor(entry.score)}`}>
                    {entry.score}
                  </Badge>
                  {idx === 0 && (
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={undoLast} title="Undo">
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CoachPicker
        open={coachDialogOpen}
        onOpenChange={setCoachDialogOpen}
        value={coachName}
        onChange={setCoachName}
      />
    </div>
  );
}

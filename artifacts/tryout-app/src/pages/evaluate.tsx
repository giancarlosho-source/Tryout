import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetPlayer, useUpsertEvaluation, getListRankingsQueryKey, getGetPlayerQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, CheckCircle2, Save, X, Zap, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const UNIVERSAL_SKILLS = [
  "Serving", "Passing", "Defense", "Volleyball IQ",
  "Communication", "Coachability", "Competitiveness", "Consistency",
];

const POSITION_SKILLS: Record<string, string[]> = {
  Setter: ["Hands", "Location", "Decision-making", "Tempo", "Leadership"],
  OutsideHitter: ["Serve receive", "Attacking", "Defense", "Transition", "All-around value"],
  MiddleBlocker: ["Blocking", "Lateral movement", "Quick attack", "Footwork", "Court awareness"],
  Opposite: ["Attacking", "Blocking", "Serving", "Back-row value", "Physical upside"],
  Libero: ["Passing", "Defense", "Reading hitters", "Serve receive", "Communication"],
};

const POSITION_LABELS: Record<string, string> = {
  Setter: "Setter", OutsideHitter: "Outside Hitter",
  MiddleBlocker: "Middle Blocker", Opposite: "Opposite", Libero: "Libero/DS",
};

function ScoreButton({ value, selected, onClick }: { value: number; selected: boolean; onClick: () => void }) {
  const colorMap: Record<number, string> = {
    1: "hover:bg-red-100 hover:border-red-400 hover:text-red-700",
    2: "hover:bg-red-100 hover:border-red-400 hover:text-red-700",
    3: "hover:bg-orange-100 hover:border-orange-400 hover:text-orange-700",
    4: "hover:bg-orange-100 hover:border-orange-400 hover:text-orange-700",
    5: "hover:bg-yellow-100 hover:border-yellow-400 hover:text-yellow-700",
    6: "hover:bg-yellow-100 hover:border-yellow-400 hover:text-yellow-700",
    7: "hover:bg-lime-100 hover:border-lime-400 hover:text-lime-700",
    8: "hover:bg-green-100 hover:border-green-400 hover:text-green-700",
    9: "hover:bg-green-100 hover:border-green-500 hover:text-green-700",
    10: "hover:bg-emerald-100 hover:border-emerald-500 hover:text-emerald-700",
  };
  const selectedColorMap: Record<number, string> = {
    1: "bg-red-500 border-red-600 text-white",
    2: "bg-red-500 border-red-600 text-white",
    3: "bg-orange-500 border-orange-600 text-white",
    4: "bg-orange-500 border-orange-600 text-white",
    5: "bg-yellow-500 border-yellow-600 text-white",
    6: "bg-yellow-500 border-yellow-600 text-white",
    7: "bg-lime-500 border-lime-600 text-white",
    8: "bg-green-500 border-green-600 text-white",
    9: "bg-green-600 border-green-700 text-white",
    10: "bg-emerald-600 border-emerald-700 text-white",
  };

  return (
    <button
      onClick={onClick}
      className={`h-14 w-full rounded-lg border-2 text-xl font-black transition-all active:scale-95 select-none
        ${selected ? selectedColorMap[value] : `bg-background border-border text-foreground ${colorMap[value]}`}
      `}
    >
      {value}
    </button>
  );
}

function SkillRow({
  skill,
  category,
  currentScore,
  onScore,
  saving,
  saved,
}: {
  skill: string;
  category: "universal" | "position";
  currentScore: number | null;
  onScore: (skill: string, category: "universal" | "position", score: number) => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <div className="py-4 border-b last:border-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base">{skill}</span>
          {saved && currentScore != null && (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
        </div>
        {currentScore != null && (
          <Badge variant="outline" className="font-black text-base px-3 py-1 tabular-nums">
            {currentScore}/10
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-10 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
          <ScoreButton
            key={v}
            value={v}
            selected={currentScore === v}
            onClick={() => !saving && onScore(skill, category, v)}
          />
        ))}
      </div>
    </div>
  );
}

interface EvalQueue {
  ids: number[];
  label: string;
  coachName?: string;
}

function readQueue(): EvalQueue | null {
  try {
    const raw = sessionStorage.getItem("evalQueue");
    if (!raw) return null;
    return JSON.parse(raw) as EvalQueue;
  } catch {
    return null;
  }
}

export default function Evaluate() {
  const [, params] = useRoute("/evaluate/:playerId");
  const playerId = params?.playerId ? parseInt(params.playerId) : null;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: playerDetail, isLoading } = useGetPlayer(playerId!, {
    query: { enabled: !!playerId, queryKey: getGetPlayerQueryKey(playerId!) },
  });

  const upsert = useUpsertEvaluation();

  const [scores, setScores] = useState<Record<string, number>>({});
  const [savedSkills, setSavedSkills] = useState<Set<string>>(new Set());

  const queue = readQueue();
  const coachName = queue?.coachName ?? null;

  useEffect(() => {
    if (playerDetail?.evaluations) {
      const map: Record<string, number> = {};
      playerDetail.evaluations
        .filter((e) => (coachName ? e.coachName === coachName : !e.coachName))
        .forEach((e) => {
          map[`${e.category}:${e.skill}`] = e.score;
        });
      setScores(map);
      setSavedSkills(new Set(Object.keys(map)));
    }
  }, [playerDetail?.evaluations, coachName]);

  // Reset scores when player changes
  useEffect(() => {
    setScores({});
    setSavedSkills(new Set());
  }, [playerId]);

  const handleScore = (skill: string, category: "universal" | "position", score: number) => {
    const key = `${category}:${skill}`;
    setScores((prev) => ({ ...prev, [key]: score }));

    upsert.mutate(
      { data: { playerId: playerId!, category, skill, score, ...(coachName ? { coachName } : {}) } },
      {
        onSuccess: () => {
          setSavedSkills((prev) => new Set([...prev, key]));
          queryClient.invalidateQueries({ queryKey: getListRankingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(playerId!) });
        },
        onError: () => {
          toast({ title: "Save failed", description: "Could not save score. Try again.", variant: "destructive" });
        },
      }
    );
  };

  const queueIndex = queue ? queue.ids.indexOf(playerId ?? -1) : -1;
  const inQueue = queueIndex !== -1;
  const prevId = inQueue && queueIndex > 0 ? queue!.ids[queueIndex - 1] : null;
  const nextId = inQueue && queueIndex < queue!.ids.length - 1 ? queue!.ids[queueIndex + 1] : null;

  const goTo = (id: number) => navigate(`/evaluate/${id}`);
  const endSession = () => {
    sessionStorage.removeItem("evalQueue");
    navigate("/players");
  };

  if (!playerId) return <div className="p-6 text-muted-foreground">Invalid player ID.</div>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading player...</p>
        </div>
      </div>
    );
  }

  if (!playerDetail) return <div className="p-6 text-muted-foreground">Player not found.</div>;

  const primaryPosition = playerDetail.position?.split("/")[0] ?? "";
  const positionSkills = POSITION_SKILLS[primaryPosition] ?? POSITION_SKILLS[playerDetail.position] ?? [];
  const universalDone = UNIVERSAL_SKILLS.filter((s) => scores[`universal:${s}`] != null).length;
  const positionDone = positionSkills.filter((s) => scores[`position:${s}`] != null).length;
  const totalSkills = UNIVERSAL_SKILLS.length + positionSkills.length;
  const totalDone = universalDone + positionDone;
  const allDone = totalDone === totalSkills && totalSkills > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Queue session bar */}
      {inQueue && (
        <div className="flex-none bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-3">
          <Zap className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-xs font-bold text-amber-800 truncate flex-1">
            Eval Session: {queue!.label}
          </span>
          {coachName && (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-2 py-0.5 shrink-0">
              <User className="h-3 w-3" />{coachName}
            </span>
          )}
          {/* Progress numbers */}
          <span className="text-xs font-black text-amber-700 tabular-nums shrink-0">
            {queueIndex + 1} / {queue!.ids.length}
          </span>
          {/* Progress bar */}
          <div className="w-24 h-2 bg-amber-200 rounded-full shrink-0 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${((queueIndex + 1) / queue!.ids.length) * 100}%` }}
            />
          </div>
          {/* Prev */}
          <Button
            size="sm" variant="outline"
            className="h-7 px-2 border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0"
            disabled={!prevId}
            onClick={() => goTo(prevId!)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {/* Next */}
          <Button
            size="sm"
            className={`h-7 px-3 shrink-0 font-bold ${allDone ? "bg-green-600 hover:bg-green-700" : ""}`}
            disabled={!nextId}
            onClick={() => nextId && goTo(nextId)}
          >
            {allDone ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : null}
            Next <ChevronRight className="h-4 w-4 ml-0.5" />
          </Button>
          {/* End session */}
          <Button
            size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-amber-600 hover:text-amber-900 hover:bg-amber-100 shrink-0"
            title="End session"
            onClick={endSession}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Player header */}
      <div className="flex-none p-6 pb-4 border-b">
        <div className="flex items-center gap-4">
          {inQueue ? (
            <Button variant="ghost" size="sm" className="h-9" onClick={endSession}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Players
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild className="h-9">
              <Link href="/players">
                <ChevronLeft className="h-4 w-4 mr-1" /> Players
              </Link>
            </Button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-primary tabular-nums">#{playerDetail.jerseyNumber}</span>
              <h1 className="text-2xl font-bold">{playerDetail.name}</h1>
              <Badge variant="outline" className="text-sm font-semibold">
                {playerDetail.position?.split("/").map((p) => POSITION_LABELS[p] ?? p).join(" / ")}
              </Badge>
              {playerDetail.checkedIn && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Checked In
                </Badge>
              )}
            </div>
            <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
              <span>Universal: <strong className="text-foreground">{universalDone}/{UNIVERSAL_SKILLS.length}</strong></span>
              <span>Position: <strong className="text-foreground">{positionDone}/{positionSkills.length}</strong></span>
              {upsert.isPending && <span className="flex items-center gap-1"><Save className="h-3.5 w-3.5 animate-pulse text-primary" /> Saving...</span>}
              {allDone && <span className="flex items-center gap-1 text-green-600 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Complete</span>}
            </div>
          </div>

          {/* In-header next button for quick advancement */}
          {inQueue && nextId && (
            <Button
              className={`font-bold gap-1 ${allDone ? "bg-green-600 hover:bg-green-700" : ""}`}
              onClick={() => goTo(nextId)}
            >
              {allDone ? <CheckCircle2 className="h-4 w-4" /> : null}
              Next Player <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {inQueue && !nextId && (
            <Button variant="outline" className="font-bold gap-1 border-green-400 text-green-700" onClick={endSession}>
              <CheckCircle2 className="h-4 w-4" /> Done
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Tabs defaultValue="universal" className="h-full flex flex-col">
          <div className="flex-none px-6 pt-4 border-b">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="universal" className="px-6 py-2 font-semibold">
                Universal Skills
                {universalDone === UNIVERSAL_SKILLS.length && (
                  <CheckCircle2 className="h-3.5 w-3.5 ml-2 text-green-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="position" className="px-6 py-2 font-semibold">
                {POSITION_LABELS[primaryPosition] || primaryPosition || "Position"} Skills
                {positionDone === positionSkills.length && positionSkills.length > 0 && (
                  <CheckCircle2 className="h-3.5 w-3.5 ml-2 text-green-500" />
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="universal" className="flex-1 overflow-auto mt-0 px-6">
            <div className="max-w-2xl py-2">
              {UNIVERSAL_SKILLS.map((skill) => (
                <SkillRow
                  key={skill}
                  skill={skill}
                  category="universal"
                  currentScore={scores[`universal:${skill}`] ?? null}
                  onScore={handleScore}
                  saving={upsert.isPending}
                  saved={savedSkills.has(`universal:${skill}`)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="position" className="flex-1 overflow-auto mt-0 px-6">
            <div className="max-w-2xl py-2">
              {positionSkills.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No position-specific skills defined.</div>
              ) : (
                positionSkills.map((skill) => (
                  <SkillRow
                    key={skill}
                    skill={skill}
                    category="position"
                    currentScore={scores[`position:${skill}`] ?? null}
                    onScore={handleScore}
                    saving={upsert.isPending}
                    saved={savedSkills.has(`position:${skill}`)}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

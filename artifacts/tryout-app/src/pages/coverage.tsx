import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListPlayers, useListEvaluations, useListCoaches } from "@workspace/api-client-react";

const HELP = {
  title: "Evaluation Coverage",
  description: "See which players still need to be evaluated and which evaluators have submitted scores — a real-time completeness check.",
  steps: [
    { step: 1, text: "Green checkmarks mean a player has been scored on that skill by at least one evaluator." },
    { step: 2, text: "Red or empty cells mean the skill hasn't been scored yet for that player." },
    { step: 3, text: "Use the filter at the top to focus on a specific evaluator or skill." },
    { step: 4, text: "Click a player's name to open their profile and score them directly from here." },
  ],
  tips: [
    "Check this page mid-tryout to catch players who slipped through without being evaluated.",
    "Sort by 'least evaluated' to find the players who need the most attention.",
    "All mandatory skills (Serving, Defense, Attacking, etc.) should be green before rankings are finalized.",
  ],
};
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle, ChevronDown } from "lucide-react";

const MANDATORY_SKILLS = ["Serving", "Defense", "Attacking", "Serve receive", "Hands"];
const ALL_SKILLS = [
  "Serving", "Defense", "Attacking", "Serve receive", "Hands",
  "Passing", "Volleyball IQ", "Communication", "Coachability", "Competitiveness",
  "Consistency", "Blocking", "Transition", "Footwork", "Leadership", "Physical upside",
];

const SKILL_LABELS: Record<string, string> = {
  "Serving": "Serve",
  "Defense": "Def",
  "Attacking": "Atk",
  "Serve receive": "SrvRcv",
  "Hands": "Set",
  "Passing": "Pass",
  "Volleyball IQ": "IQ",
  "Communication": "Comms",
  "Coachability": "Coach",
  "Competitiveness": "Comp",
  "Consistency": "Cons",
  "Blocking": "Block",
  "Transition": "Trans",
  "Footwork": "Ftwork",
  "Leadership": "Lead",
  "Physical upside": "Phys",
};

type CellStatus = "done" | "partial" | "missing";

export default function Coverage() {
  const [showAll, setShowAll] = useState(false);
  const [filterCoach, setFilterCoach] = useState<string>("__all__");
  const [ageFilter, setAgeFilter] = useState<string>("All");
  const [checkedInOnly, setCheckedInOnly] = useState(false);
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [coachMenuOpen, setCoachMenuOpen] = useState(false);

  const { data: players } = useListPlayers({});
  const { data: evaluations } = useListEvaluations();
  const { data: coaches } = useListCoaches();

  const evaluators = useMemo(
    () => coaches?.filter((c) => c.teamName === "Evaluator") ?? [],
    [coaches]
  );

  const skills = showAll ? ALL_SKILLS : MANDATORY_SKILLS;
  const ageGroups = Array.from(new Set((players ?? []).map((p) => p.age).filter(Boolean))).sort() as string[];

  // Build a lookup: playerId → skill → coachName[] with scores
  const evalMap = useMemo(() => {
    const map: Record<number, Record<string, { coachName: string | null; score: number }[]>> = {};
    for (const e of evaluations ?? []) {
      if (!map[e.playerId]) map[e.playerId] = {};
      if (!map[e.playerId][e.skill]) map[e.playerId][e.skill] = [];
      map[e.playerId][e.skill].push({ coachName: e.coachName ?? null, score: e.score });
    }
    return map;
  }, [evaluations]);

  const visiblePlayers = useMemo(() => {
    let list = [...(players ?? [])];
    if (ageFilter !== "All") list = list.filter((p) => (p.age ?? "") === ageFilter);
    if (checkedInOnly) list = list.filter((p) => p.checkedIn);
    list.sort((a, b) => {
      const an = parseInt(a.jerseyNumber ?? "9999");
      const bn = parseInt(b.jerseyNumber ?? "9999");
      return an - bn;
    });
    if (incompleteOnly) {
      list = list.filter((p) => {
        const pEvals = evalMap[p.id] ?? {};
        return MANDATORY_SKILLS.some((skill) => {
          if (filterCoach === "__all__") return !pEvals[skill]?.length;
          return !pEvals[skill]?.some((e) => e.coachName === (filterCoach === "__null__" ? null : filterCoach));
        });
      });
    }
    return list;
  }, [players, ageFilter, checkedInOnly, incompleteOnly, evalMap, filterCoach]);

  function getCell(playerId: number, skill: string): { status: CellStatus; score: number | null; coachCount: number } {
    const entries = evalMap[playerId]?.[skill] ?? [];
    if (filterCoach !== "__all__") {
      const targetCoach = filterCoach === "__null__" ? null : filterCoach;
      const entry = entries.find((e) => e.coachName === targetCoach);
      return entry
        ? { status: "done", score: entry.score, coachCount: 1 }
        : { status: "missing", score: null, coachCount: 0 };
    }
    if (entries.length === 0) return { status: "missing", score: null, coachCount: 0 };
    const avg = entries.reduce((s, e) => s + e.score, 0) / entries.length;
    return { status: "done", score: avg, coachCount: entries.length };
  }

  function rowStatus(playerId: number): "complete" | "partial" | "empty" {
    const pEvals = evalMap[playerId] ?? {};
    const covered = MANDATORY_SKILLS.filter((skill) => {
      if (filterCoach === "__all__") return (pEvals[skill]?.length ?? 0) > 0;
      const targetCoach = filterCoach === "__null__" ? null : filterCoach;
      return pEvals[skill]?.some((e) => e.coachName === targetCoach);
    });
    if (covered.length === 0) return "empty";
    if (covered.length === MANDATORY_SKILLS.length) return "complete";
    return "partial";
  }

  const summary = useMemo(() => {
    const total = visiblePlayers.length;
    const complete = visiblePlayers.filter((p) => rowStatus(p.id) === "complete").length;
    const partial = visiblePlayers.filter((p) => rowStatus(p.id) === "partial").length;
    const empty = visiblePlayers.filter((p) => rowStatus(p.id) === "empty").length;
    return { total, complete, partial, empty };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePlayers, evalMap, filterCoach]);

  const selectedCoachLabel =
    filterCoach === "__all__" ? "All coaches"
    : filterCoach === "__null__" ? "Unassigned"
    : filterCoach;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-none p-6 pb-4 border-b">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Evaluation Coverage</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Track which players still need to be evaluated</p>
          </div>

          {/* Summary chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200">
              <CheckCircle2 className="h-3.5 w-3.5" /> {summary.complete} complete
            </span>
            <span className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <AlertCircle className="h-3.5 w-3.5" /> {summary.partial} partial
            </span>
            <span className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200">
              <XCircle className="h-3.5 w-3.5" /> {summary.empty} not started
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {/* Coach filter */}
          <div className="relative">
            <button
              onClick={() => setCoachMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold bg-white hover:bg-muted/40 transition-colors"
            >
              {selectedCoachLabel}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {coachMenuOpen && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-white border rounded-xl shadow-lg p-1.5 min-w-[180px] space-y-0.5">
                {[
                  { value: "__all__", label: "All coaches" },
                  { value: "__null__", label: "Unassigned" },
                  ...evaluators.map((c) => ({ value: c.name, label: c.name })),
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilterCoach(opt.value); setCoachMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors
                      ${filterCoach === opt.value ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {ageGroups.length > 1 && ["All", ...ageGroups].map((age) => (
            <button
              key={age}
              onClick={() => setAgeFilter(age)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors
                ${ageFilter === age
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white hover:bg-muted/40"}`}
            >
              {age === "All" ? "All Ages" : age}
            </button>
          ))}

          <button
            onClick={() => setCheckedInOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors
              ${checkedInOnly ? "bg-primary text-primary-foreground border-primary" : "bg-white hover:bg-muted/40"}`}
          >
            Checked-in only
          </button>

          <button
            onClick={() => setIncompleteOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors
              ${incompleteOnly ? "bg-amber-500 text-white border-amber-500" : "bg-white hover:bg-muted/40"}`}
          >
            Incomplete only
          </button>

          <button
            onClick={() => setShowAll((v) => !v)}
            className="px-3 py-1.5 rounded-lg border text-sm font-semibold bg-white hover:bg-muted/40 transition-colors"
          >
            {showAll ? "Required only" : "Show all skills"}
          </button>
        </div>
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto">
        {visiblePlayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <CheckCircle2 className="h-10 w-10 opacity-20" />
            <p className="text-sm font-semibold">All players evaluated</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-background border-b">
              <tr>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground w-10">#</th>
                <th className="text-left px-2 py-3 font-bold text-muted-foreground min-w-[140px]">Player</th>
                <th className="px-2 py-3 font-bold text-muted-foreground w-20 text-center">Status</th>
                {skills.map((skill) => (
                  <th key={skill} className="px-1 py-3 font-bold text-muted-foreground text-center whitespace-nowrap">
                    <span className={`text-xs ${MANDATORY_SKILLS.includes(skill) ? "text-foreground" : "text-muted-foreground/60"}`}>
                      {SKILL_LABELS[skill] ?? skill}
                    </span>
                    {MANDATORY_SKILLS.includes(skill) && (
                      <span className="block w-1 h-1 rounded-full bg-amber-400 mx-auto mt-0.5" />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiblePlayers.map((player, idx) => {
                const status = rowStatus(player.id);
                return (
                  <tr
                    key={player.id}
                    className={`border-b transition-colors hover:bg-muted/30 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    <td className="px-4 py-2.5 font-black tabular-nums text-primary">
                      {player.jerseyNumber ? `#${player.jerseyNumber}` : "—"}
                    </td>
                    <td className="px-2 py-2.5">
                      <Link href={`/players/${player.id}`} className="font-semibold hover:text-primary hover:underline transition-colors">
                        {player.name}
                      </Link>
                      {player.checkedIn && (
                        <span className="ml-2 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">IN</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {status === "complete" && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 font-bold">Done</Badge>}
                      {status === "partial" && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 font-bold">Part</Badge>}
                      {status === "empty" && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 font-bold">None</Badge>}
                    </td>
                    {skills.map((skill) => {
                      const cell = getCell(player.id, skill);
                      return (
                        <td key={skill} className="px-1 py-2.5 text-center">
                          {cell.status === "done" ? (
                            <span className={`inline-flex items-center justify-center w-9 h-7 rounded font-black text-xs tabular-nums
                              ${cell.score! >= 8 ? "bg-green-100 text-green-700" : cell.score! >= 5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                              {cell.score!.toFixed(1)}
                              {cell.coachCount > 1 && (
                                <span className="text-[9px] font-bold opacity-60 ml-0.5">×{cell.coachCount}</span>
                              )}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center justify-center w-9 h-7 rounded text-xs
                              ${MANDATORY_SKILLS.includes(skill) ? "bg-red-50 text-red-300" : "bg-muted/30 text-muted-foreground/30"}`}>
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ChevronLeft, Search, X } from "lucide-react";
import { positionColor, positionLabel } from "@/lib/positions";

const POSITIONS = ["All", "Setter", "OutsideHitter", "MiddleBlocker", "Opposite", "Libero", "Undecided"];
const POSITION_TAB_LABELS: Record<string, string> = {
  All: "All", Setter: "S", OutsideHitter: "OH", MiddleBlocker: "MB", Opposite: "OPP", Libero: "L", Undecided: "?",
};

interface RankedPlayer {
  id: number;
  name: string;
  jerseyNumber: string | null;
  position: string;
  checkedIn: boolean | null;
  overallScore: number | null;
  positionScore: number | null;
  potentialScore: number | null;
  physicalScore: number | null;
  rankOverall: number;
  evaluationCount: number;
}

interface PlayerEvaluation {
  skill: string;
  category: "universal" | "position";
  score: number;
}

interface PlayerDetail {
  id: number;
  name: string;
  jerseyNumber: string | null;
  position: string;
  checkedIn: boolean | null;
  overallScore: number | null;
  positionScore: number | null;
  potentialScore: number | null;
  physicalScore: number | null;
  heightInches: number | null;
  verticalJumpInches: number | null;
  evaluations: PlayerEvaluation[];
}

function ScoreCell({ value, otherValue, suffix = "" }: { value: number | null | undefined; otherValue: number | null | undefined; suffix?: string }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const better = otherValue != null && value > otherValue ? "text-green-700" : otherValue != null && value < otherValue ? "text-red-600" : "";
  return (
    <span className={`text-lg font-black tabular-nums ${better}`}>
      {value.toFixed(1)}
      {suffix && <span className="text-xs font-normal text-muted-foreground">{suffix}</span>}
    </span>
  );
}

function SkillBar({ label, score, otherScore }: { label: string; score: number; otherScore?: number }) {
  const pct = (score / 10) * 100;
  const better = otherScore != null ? score >= otherScore : true;
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 text-xs font-medium shrink-0 truncate">{label}</div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${better ? "bg-purple-500" : "bg-muted-foreground/50"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-7 text-right text-xs font-black tabular-nums">{score.toFixed(1)}</div>
    </div>
  );
}

function PlayerCompareColumn({ player, other }: { player: PlayerDetail; other: PlayerDetail | null }) {
  const universal = player.evaluations.filter((e) => e.category === "universal").sort((a, b) => b.score - a.score);
  const position = player.evaluations.filter((e) => e.category === "position").sort((a, b) => b.score - a.score);
  const otherUniversal = other?.evaluations.filter((e) => e.category === "universal") ?? [];
  const otherPosition = other?.evaluations.filter((e) => e.category === "position") ?? [];

  return (
    <div className="flex-1 min-w-0 space-y-3">
      <div className="text-center space-y-1.5 p-3 rounded-xl border bg-muted/20">
        <div className="text-3xl font-black text-purple-600 tabular-nums">#{player.jerseyNumber ?? "?"}</div>
        <div className="text-base font-bold truncate">{player.name}</div>
        <span className={`inline-block text-xs font-semibold border rounded-full px-2 py-0.5 ${positionColor(player.position)}`}>
          {positionLabel(player.position)}
        </span>
      </div>

      <div className="bg-white border rounded-xl p-3 space-y-2">
        {[
          { label: "Overall", value: player.overallScore, other: other?.overallScore },
          { label: "Position", value: player.positionScore, other: other?.positionScore },
          { label: "Potential", value: player.potentialScore, other: other?.potentialScore },
          { label: "Physical", value: player.physicalScore, other: other?.physicalScore },
        ].map(({ label, value, other: otherVal }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
            <ScoreCell value={value} otherValue={otherVal} />
          </div>
        ))}
      </div>

      {universal.length > 0 && (
        <div className="bg-white border rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Universal</p>
          {universal.map((e) => (
            <SkillBar key={e.skill} label={e.skill} score={e.score} otherScore={otherUniversal.find((o) => o.skill === e.skill)?.score} />
          ))}
        </div>
      )}

      {position.length > 0 && (
        <div className="bg-white border rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{positionLabel(player.position)}</p>
          {position.map((e) => (
            <SkillBar key={e.skill} label={e.skill} score={e.score} otherScore={otherPosition.find((o) => o.skill === e.skill)?.score} />
          ))}
        </div>
      )}

      {universal.length === 0 && position.length === 0 && (
        <div className="bg-white border rounded-xl p-4 text-center text-xs text-muted-foreground">No evaluations yet.</div>
      )}
    </div>
  );
}

export function StationRankings({ onClose }: { onClose: () => void }) {
  const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const slug = typeof window !== "undefined" ? localStorage.getItem("tryoutdesk_club_slug") : null;

  const [rankings, setRankings] = useState<RankedPlayer[] | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [details, setDetails] = useState<Record<number, PlayerDetail>>({});
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("All");

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_BASE}/api/rankings/public/${slug}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRankings(data); else setError(true); })
      .catch(() => setError(true));
  }, [API_BASE, slug]);

  const filteredRankings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rankings ?? [])
      .filter((p) => position === "All" || p.position === position)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.jerseyNumber ?? "").includes(q));
  }, [rankings, search, position]);

  const positionCounts = useMemo(() => {
    const counts: Record<string, number> = { All: (rankings ?? []).length };
    for (const pos of POSITIONS) {
      if (pos === "All") continue;
      counts[pos] = (rankings ?? []).filter((p) => p.position === pos).length;
    }
    return counts;
  }, [rankings]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  useEffect(() => {
    if (!slug || selected.length === 0) return;
    selected.forEach((id) => {
      if (details[id]) return;
      fetch(`${API_BASE}/api/players/public/${slug}/${id}`)
        .then((r) => r.json())
        .then((data) => setDetails((prev) => ({ ...prev, [id]: data })))
        .catch(() => {});
    });
  }, [selected, slug, API_BASE, details]);

  if (compareOpen && selected.length === 2) {
    const [aId, bId] = selected;
    const a = details[aId];
    const b = details[bId];
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex-none flex items-center gap-2 border-b p-3">
          <button onClick={() => setCompareOpen(false)} className="p-1.5 rounded-lg hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <ArrowLeftRight className="h-4 w-4 text-purple-600" />
          <span className="font-bold text-sm">Compare Players</span>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {!a || !b ? (
            <div className="text-center text-sm text-muted-foreground py-16">Loading...</div>
          ) : (
            <div className="flex gap-3 items-start max-w-2xl mx-auto">
              <PlayerCompareColumn player={a} other={b} />
              <div className="flex-none w-px bg-border self-stretch" />
              <PlayerCompareColumn player={b} other={a} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex-none flex items-center gap-2 border-b p-3">
        <span className="font-bold text-sm">Rankings</span>
        {selected.length > 0 && (
          <span className="text-xs text-muted-foreground">{selected.length}/2 selected to compare</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {selected.length === 2 && (
            <button
              onClick={() => setCompareOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold bg-purple-600 text-white px-3 py-1.5 rounded-lg"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" /> Compare
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-none max-w-lg mx-auto w-full px-3 pt-3 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map((pos) => {
            const active = position === pos;
            const count = positionCounts[pos] ?? 0;
            return (
              <button
                key={pos}
                onClick={() => setPosition(pos)}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                  active
                    ? pos === "All"
                      ? "bg-foreground text-background border-foreground"
                      : `${positionColor(pos)} border-current`
                    : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground"
                }`}
              >
                {POSITION_TAB_LABELS[pos]}
                <span className={`tabular-nums ${active ? "opacity-80" : "opacity-60"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 max-w-lg mx-auto w-full">
        {error && (
          <div className="text-center text-sm text-red-600 py-8">Couldn't load rankings.</div>
        )}
        {!error && rankings === null && (
          <div className="text-center text-sm text-muted-foreground py-8">Loading...</div>
        )}
        {rankings !== null && rankings.length > 0 && filteredRankings.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No players match your search.</div>
        )}
        {rankings !== null && rankings.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No ranked players yet.</div>
        )}
        <div className="space-y-1.5">
          {filteredRankings.map((p) => {
            const isSelected = selected.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleSelect(p.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                  isSelected ? "bg-purple-50 border-purple-300" : "bg-white border-border hover:border-purple-200"
                }`}
              >
                <span className="text-xs font-bold text-muted-foreground w-5 text-center tabular-nums">{p.rankOverall}</span>
                <span className="font-black text-purple-600 w-9 text-center tabular-nums">#{p.jerseyNumber ?? "?"}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.name}</div>
                  <span className={`inline-block text-[10px] font-bold border rounded-full px-1.5 py-0 ${positionColor(p.position)}`}>
                    {positionLabel(p.position)}
                  </span>
                </div>
                <span className="text-xl font-black tabular-nums text-foreground">
                  {p.overallScore != null ? p.overallScore.toFixed(1) : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

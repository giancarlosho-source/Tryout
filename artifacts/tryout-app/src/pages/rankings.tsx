import { useState } from "react";
import { useListRankings, useOverrideRanking, getListRankingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Unlock, ChevronUp, ChevronDown, User, CheckCircle2, TrendingUp, Zap, Star, Shield } from "lucide-react";
import { useRoster } from "@/contexts/roster-context";

const FLAG_ICONS: Record<string, typeof Zap> = {
  "High Potential": TrendingUp,
  "Raw Athlete": Zap,
  "Skilled but Undersized": Star,
  "Roster Lock Candidate": Shield,
  "Consistent Performer": CheckCircle2,
};

const FLAG_COLORS: Record<string, string> = {
  "High Potential":         "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Raw Athlete":            "bg-blue-100 text-blue-700 border-blue-200",
  "Skilled but Undersized": "bg-orange-100 text-orange-700 border-orange-200",
  "Consistent Performer":   "bg-teal-100 text-teal-700 border-teal-200",
  "Roster Lock Candidate":  "bg-purple-100 text-purple-700 border-purple-200",
  "Position Change Candidate": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Needs More Evaluation":  "bg-gray-100 text-gray-500 border-gray-200",
  "Missing Measurements":   "bg-red-100 text-red-600 border-red-200",
};

const POSITION_COLORS: Record<string, string> = {
  Setter: "bg-purple-100 text-purple-700 border-purple-200",
  OutsideHitter: "bg-blue-100 text-blue-700 border-blue-200",
  MiddleBlocker: "bg-green-100 text-green-700 border-green-200",
  Opposite: "bg-orange-100 text-orange-700 border-orange-200",
  Libero: "bg-pink-100 text-pink-700 border-pink-200",
};

const POSITION_LABELS: Record<string, string> = {
  Setter: "Setter", OutsideHitter: "Outside Hitter",
  MiddleBlocker: "Middle Blocker", Opposite: "Opposite", Libero: "Libero/DS",
};

function ScorePill({ score, dimmed }: { score: number | null | undefined; dimmed?: boolean }) {
  if (score == null) return <span className="text-muted-foreground text-sm">—</span>;
  const color = dimmed
    ? "text-muted-foreground bg-muted border-border"
    : score >= 8
    ? "text-green-700 bg-green-50 border-green-200"
    : score >= 6
    ? "text-yellow-700 bg-yellow-50 border-yellow-200"
    : "text-red-700 bg-red-50 border-red-200";
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-sm font-bold tabular-nums ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

type SortKey = "overall" | "position" | "potential" | "physical" | "height" | "vertical" | "jerseyNumber";

export default function Rankings() {
  const [sortBy, setSortBy] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { isOnRoster, getRosterSlot } = useRoster();

  const queryClient = useQueryClient();
  const { data: players, isLoading } = useListRankings({ sortBy, sortDir });
  const overrideRanking = useOverrideRanking();

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(key); setSortDir("desc"); }
  };

  const handleLockToggle = (playerId: number, current: boolean) => {
    overrideRanking.mutate(
      { playerId, data: { rankOverridePosition: null, rankLocked: !current } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRankingsQueryKey() }) }
    );
  };

  const SortButton = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      className="flex items-center gap-1 font-bold uppercase tracking-wider text-xs hover:text-primary transition-colors"
      onClick={() => handleSort(col)}
    >
      {label}
      {sortBy === col ? (
        sortDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-none p-6 pb-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rankings</h1>
            <p className="text-muted-foreground text-sm mt-1">
              All players sorted by score — lock players to pin their rank.{" "}
              <span className="text-primary font-medium">Greyed rows are already on the active roster.</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-medium">Sort by:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall Score</SelectItem>
                <SelectItem value="position">Position Score</SelectItem>
                <SelectItem value="potential">Potential Score</SelectItem>
                <SelectItem value="physical">Physical Score</SelectItem>
                <SelectItem value="height">Height</SelectItem>
                <SelectItem value="vertical">Vertical Jump</SelectItem>
                <SelectItem value="jerseyNumber">Jersey Number</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              className="w-24"
            >
              {sortDir === "desc" ? <><ChevronDown className="h-4 w-4 mr-1" /> Desc</> : <><ChevronUp className="h-4 w-4 mr-1" /> Asc</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 shadow-sm">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 font-bold uppercase tracking-wider text-xs">Rank</TableHead>
              <TableHead className="w-16 font-bold uppercase tracking-wider text-xs">#</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Name</TableHead>
              <TableHead className="w-36 font-bold uppercase tracking-wider text-xs">Position</TableHead>
              <TableHead className="w-24 text-center"><SortButton col="overall" label="Overall" /></TableHead>
              <TableHead className="w-24 text-center"><SortButton col="position" label="Position" /></TableHead>
              <TableHead className="w-24 text-center"><SortButton col="potential" label="Potential" /></TableHead>
              <TableHead className="w-24 text-center"><SortButton col="physical" label="Physical" /></TableHead>
              <TableHead className="w-28 text-center"><SortButton col="height" label="Height" /></TableHead>
              <TableHead className="w-24 text-center"><SortButton col="vertical" label="Vert" /></TableHead>
              <TableHead className="w-36 font-bold uppercase tracking-wider text-xs text-center">Roster Slot</TableHead>
              <TableHead className="w-28 text-center font-bold uppercase tracking-wider text-xs">Lock</TableHead>
              <TableHead className="w-20 font-bold uppercase tracking-wider text-xs">Profile</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 13 }).map((_, j) => (
                    <TableCell key={j}><div className="h-5 bg-muted rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : players?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-16 text-muted-foreground">
                  No players evaluated yet. Start evaluating players to see rankings.
                </TableCell>
              </TableRow>
            ) : (
              players?.map((player, idx) => {
                const onRoster = isOnRoster(player.id);
                const slot = getRosterSlot(player.id);

                return (
                  <TableRow
                    key={player.id}
                    className={`group transition-colors ${
                      onRoster
                        ? "bg-muted/50 text-muted-foreground hover:bg-muted/60"
                        : player.rankLocked
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <TableCell>
                      <span className={`text-xl font-black tabular-nums ${
                        onRoster ? "text-muted-foreground/50" :
                        idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-amber-600" : "text-muted-foreground"
                      }`}>
                        {idx + 1}
                      </span>
                    </TableCell>
                    <TableCell className={`font-black text-lg tabular-nums ${onRoster ? "text-muted-foreground" : "text-primary"}`}>
                      {player.jerseyNumber}
                    </TableCell>
                    <TableCell>
                      <div className={`font-bold ${onRoster ? "text-muted-foreground" : ""}`}>{player.name}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {player.evaluationCount != null && (
                          <span className="text-xs text-muted-foreground/70">{player.evaluationCount} evals</span>
                        )}
                        {((player.flags as string[] | null) ?? [])
                          .filter((f) => !["Missing Measurements", "Needs More Evaluation"].includes(f))
                          .map((flag) => {
                            const Icon = FLAG_ICONS[flag];
                            if (!Icon) return null;
                            return (
                              <span key={flag} title={flag} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-xs font-semibold ${FLAG_COLORS[flag] ?? "bg-muted text-muted-foreground border-border"} ${onRoster ? "opacity-50" : ""}`}>
                                <Icon className="h-2.5 w-2.5" /> {flag}
                              </span>
                            );
                          })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold ${
                          onRoster ? "bg-muted text-muted-foreground border-border" : POSITION_COLORS[player.position] || ""
                        }`}
                      >
                        {POSITION_LABELS[player.position] || player.position}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center"><ScorePill score={player.overallScore} dimmed={onRoster} /></TableCell>
                    <TableCell className="text-center"><ScorePill score={player.positionScore} dimmed={onRoster} /></TableCell>
                    <TableCell className="text-center"><ScorePill score={player.potentialScore} dimmed={onRoster} /></TableCell>
                    <TableCell className="text-center"><ScorePill score={player.physicalScore} dimmed={onRoster} /></TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      <span className={onRoster ? "opacity-50" : ""}>
                        {player.heightInches
                          ? `${Math.floor(player.heightInches / 12)}'${Math.round(player.heightInches % 12)}"`
                          : <span className="text-muted-foreground">—</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      <span className={onRoster ? "opacity-50" : ""}>
                        {player.verticalJumpInches ? `${player.verticalJumpInches}"` : <span className="text-muted-foreground">—</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {onRoster && slot ? (
                        <Badge className="bg-primary/15 text-primary border-primary/30 font-semibold text-xs whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" />
                          {slot.positionLabel}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/30">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant={player.rankLocked ? "default" : "outline"}
                        className={`w-24 h-9 font-semibold ${player.rankLocked ? "bg-primary text-primary-foreground" : ""} ${onRoster ? "opacity-50" : ""}`}
                        onClick={() => handleLockToggle(player.id, player.rankLocked)}
                        disabled={overrideRanking.isPending}
                      >
                        {player.rankLocked ? (
                          <><Lock className="h-3.5 w-3.5 mr-1.5" /> Locked</>
                        ) : (
                          <><Unlock className="h-3.5 w-3.5 mr-1.5" /> Lock</>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" asChild className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/players/${player.id}`}>
                          <User className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

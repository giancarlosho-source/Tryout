import { useMemo } from "react";
import {
  useListPlayers,
  useListCoaches,
  useListEvaluations,
  useGetAllDraftPicks,
  useGetAllWishlistPicks,
  useGetAllMustHavePicks,
} from "@/lib/api-client-react/src/generated/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  Lock,
  Heart,
  Star,
  Users,
  User,
  LayoutGrid,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import type {
  Player,
  Coach,
  DraftPick,
} from "@/lib/api-client-react/src/generated/api.schemas";

const FAST_REFETCH = { refetchInterval: 5000 };
const SLOW_REFETCH = { refetchInterval: 60000 };

const POSITION_COLORS: Record<string, string> = {
  setter: "bg-purple-100 text-purple-800 border-purple-300",
  outside_hitter: "bg-blue-100 text-blue-800 border-blue-300",
  middle_blocker: "bg-orange-100 text-orange-800 border-orange-300",
  opposite: "bg-red-100 text-red-800 border-red-300",
  libero: "bg-green-100 text-green-800 border-green-300",
};

const POSITION_ABBR: Record<string, string> = {
  setter: "S",
  outside_hitter: "OH",
  middle_blocker: "MB",
  opposite: "OPP",
  libero: "L",
};

const ALL_POSITIONS = ["setter", "outside_hitter", "middle_blocker", "opposite", "libero"];

function posLabel(pos: string) {
  return POSITION_ABBR[pos] ?? pos.slice(0, 3).toUpperCase();
}

function posBg(pos: string) {
  return POSITION_COLORS[pos] ?? "bg-gray-100 text-gray-700 border-gray-300";
}

function fmt(n?: number | null, decimals = 1) {
  return n != null ? n.toFixed(decimals) : "—";
}

function fmtHeight(inches?: number | null) {
  if (!inches) return "—";
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

// ─── Teams Tab ───────────────────────────────────────────────────────────────

type TeamColumnProps = {
  coach: Coach;
  rank: number;
  picks: DraftPick[];
  playerMap: Map<number, Player>;
};

function TeamColumn({ coach, rank, picks, playerMap }: TeamColumnProps) {
  const committed = picks.filter((p) => p.committed).length;
  const counts = Object.fromEntries(ALL_POSITIONS.map((p) => [p, picks.filter((d) => d.position === p).length]));

  return (
    <div className="flex flex-col w-[210px] flex-shrink-0 border rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Team header */}
      <div className="px-3 py-2.5 bg-muted/40 border-b">
        <div className="flex items-center justify-between mb-0.5">
          <p className="font-bold text-sm truncate">{coach.teamName}</p>
          <Badge variant="outline" className="text-[10px] font-bold px-1.5 shrink-0">#{rank}</Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{coach.name}</p>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
          <span>{picks.length} drafted</span>
          {committed > 0 && (
            <span className="flex items-center gap-0.5 text-green-600 font-medium">
              <CheckCircle2 className="h-2.5 w-2.5" />{committed} committed
            </span>
          )}
        </div>
        {/* Position counts */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {ALL_POSITIONS.map((p) => (
            <span key={p} className={`text-[9px] px-1 py-0.5 rounded border font-semibold ${posBg(p)}`}>
              {posLabel(p)}: {counts[p]}
            </span>
          ))}
        </div>
      </div>

      {/* Player rows */}
      <ScrollArea className="flex-1" style={{ maxHeight: 380 }}>
        <div className="p-2 space-y-1">
          {picks.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-6 italic">No players drafted yet</p>
          )}
          {picks.map((pick) => {
            const player = playerMap.get(pick.playerId);
            return (
              <div
                key={pick.playerId}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] border ${
                  pick.committed
                    ? "bg-green-50 border-green-200"
                    : pick.locked
                    ? "bg-blue-50 border-blue-200"
                    : "bg-muted/20 border-transparent"
                }`}
              >
                <span className={`text-[9px] px-1 py-0.5 rounded border font-bold flex-shrink-0 ${posBg(pick.position)}`}>
                  {posLabel(pick.position)}
                </span>
                <span className="flex-1 font-medium truncate">{player?.name ?? `Player ${pick.playerId}`}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  {pick.committed && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                  {pick.locked && !pick.committed && <Lock className="h-3 w-3 text-blue-400" />}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Player Status Matrix Tab ─────────────────────────────────────────────────

type MatrixProps = {
  players: Player[];
  coaches: Coach[];
  draftPicksByCoach: Map<number, Map<number, DraftPick>>;
  wishlistByCoach: Map<number, Set<number>>;
  mustHaveByCoach: Map<number, Set<number>>;
};

function PlayerStatusMatrix({ players, coaches, draftPicksByCoach, wishlistByCoach, mustHaveByCoach }: MatrixProps) {
  const sorted = [...players].sort((a, b) => (a.rankOverall ?? 9999) - (b.rankOverall ?? 9999));

  // Find the committed pick for a player (if any)
  const getCommittedPick = (playerId: number): { pick: DraftPick; rank: number } | null => {
    for (let i = 0; i < coaches.length; i++) {
      const pick = draftPicksByCoach.get(coaches[i].id)?.get(playerId);
      if (pick?.committed) return { pick, rank: i + 1 };
    }
    return null;
  };

  // Highest-ranked (lowest rank number) coach with a must-have on this player
  const getTopMustHave = (playerId: number): { coach: Coach; rank: number } | null => {
    for (let i = 0; i < coaches.length; i++) {
      if (mustHaveByCoach.get(coaches[i].id)?.has(playerId)) {
        return { coach: coaches[i], rank: i + 1 };
      }
    }
    return null;
  };

  return (
    <div className="overflow-auto h-full">
      <table className="text-xs border-collapse min-w-max">
        <thead className="sticky top-0 z-10 bg-white">
          <tr>
            <th className="sticky left-0 bg-white z-20 text-left px-3 py-2 font-semibold border-b border-r min-w-[50px]">Rank</th>
            <th className="sticky left-[50px] bg-white z-20 text-left px-3 py-2 font-semibold border-b border-r min-w-[200px]">Player</th>
            <th className="text-left px-3 py-2 font-semibold border-b border-r min-w-[50px]">Pos</th>
            <th className="text-right px-3 py-2 font-semibold border-b border-r min-w-[44px]">Ovr</th>
            {coaches.map((c, i) => (
              <th key={c.id} className="px-2 py-2 font-semibold border-b border-r text-center min-w-[90px]">
                <div className="text-[10px] font-bold">{c.teamName}</div>
                <div className="text-[9px] text-muted-foreground font-normal">Pick #{i + 1}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((player, idx) => {
            const committedInfo = getCommittedPick(player.id);
            const topMustHave = getTopMustHave(player.id);
            const isTaken = !!committedInfo;

            // Row background: taken = heavily muted, top must-have flagged = amber tint, drafted = blue tint
            const anyDrafted = !isTaken && coaches.some((c) => draftPicksByCoach.get(c.id)?.has(player.id));
            const rowBg = isTaken
              ? "bg-gray-100 opacity-60"
              : topMustHave
              ? "bg-amber-50"
              : anyDrafted
              ? "bg-blue-50/60"
              : idx % 2 === 0
              ? "bg-white"
              : "bg-muted/10";

            return (
              <tr key={player.id} className={`border-b ${rowBg}`}>
                {/* Rank */}
                <td className="sticky left-0 bg-inherit z-10 px-3 py-1.5 text-muted-foreground border-r text-center">
                  {player.rankOverall ?? "—"}
                </td>

                {/* Name + flags */}
                <td className="sticky left-[50px] bg-inherit z-10 px-3 py-1.5 border-r max-w-[200px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-medium truncate ${isTaken ? "line-through text-muted-foreground" : ""}`}>
                      {player.name}
                    </span>
                    {isTaken && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-400 text-white font-bold shrink-0">
                        TAKEN · {committedInfo.pick.teamName}
                      </span>
                    )}
                    {!isTaken && topMustHave && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-400 text-white font-bold shrink-0 flex items-center gap-0.5">
                        <Star className="h-2.5 w-2.5 fill-white" />
                        #{topMustHave.rank} wants
                      </span>
                    )}
                  </div>
                </td>

                {/* Position */}
                <td className="px-3 py-1.5 border-r">
                  <span className={`text-[9px] px-1 py-0.5 rounded border font-bold ${posBg(player.position)}`}>
                    {posLabel(player.position)}
                  </span>
                </td>

                {/* Overall score */}
                <td className="px-3 py-1.5 border-r text-right">
                  {player.overallScore != null ? (
                    <span className={player.overallScore >= 7 ? "text-green-700 font-semibold" : player.overallScore >= 4 ? "text-yellow-700" : "text-red-600"}>
                      {player.overallScore.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                {/* One cell per coach */}
                {coaches.map((coach) => {
                  const pick = draftPicksByCoach.get(coach.id)?.get(player.id);
                  const wishlisted = wishlistByCoach.get(coach.id)?.has(player.id);
                  const mustHave = mustHaveByCoach.get(coach.id)?.has(player.id);
                  // Dim cells for lower-ranked coaches when player is taken
                  const cellMuted = isTaken && !pick;

                  return (
                    <td
                      key={coach.id}
                      className={`px-2 py-1.5 border-r text-center ${cellMuted ? "opacity-30" : ""}`}
                    >
                      {pick ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-[9px] px-1 py-0.5 rounded border font-bold ${posBg(pick.position)}`}>
                            {posLabel(pick.position)}
                          </span>
                          {pick.committed && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                          {pick.locked && !pick.committed && <Lock className="h-3 w-3 text-blue-400" />}
                        </div>
                      ) : mustHave ? (
                        <Star className="h-3.5 w-3.5 text-violet-500 fill-violet-500 mx-auto" />
                      ) : wishlisted ? (
                        <Heart className="h-3.5 w-3.5 text-pink-400 fill-pink-400 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground/30">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── All Players Tab ──────────────────────────────────────────────────────────

type PlayersTabProps = {
  players: Player[];
  draftPickMap: Map<number, DraftPick>;
  evalCountMap: Map<number, number>;
};

function PlayersTab({ players, draftPickMap, evalCountMap }: PlayersTabProps) {
  const sorted = [...players].sort((a, b) => (a.rankOverall ?? 9999) - (b.rankOverall ?? 9999));

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="border-b">
            <th className="text-left px-3 py-2 font-semibold">Rank</th>
            <th className="text-left px-3 py-2 font-semibold">Name</th>
            <th className="text-left px-3 py-2 font-semibold">Pos</th>
            <th className="text-right px-3 py-2 font-semibold">Height</th>
            <th className="text-right px-3 py-2 font-semibold">Reach</th>
            <th className="text-right px-3 py-2 font-semibold">Vert</th>
            <th className="text-right px-3 py-2 font-semibold">Overall</th>
            <th className="text-right px-3 py-2 font-semibold">Pos Score</th>
            <th className="text-right px-3 py-2 font-semibold">Physical</th>
            <th className="text-right px-3 py-2 font-semibold">Evals</th>
            <th className="text-left px-3 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const pick = draftPickMap.get(p.id);
            const evalCount = evalCountMap.get(p.id) ?? 0;
            return (
              <tr
                key={p.id}
                className={`border-b ${
                  pick?.committed ? "bg-green-50" : pick ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-muted/10"
                }`}
              >
                <td className="px-3 py-1.5 text-muted-foreground text-center">{p.rankOverall ?? "—"}</td>
                <td className="px-3 py-1.5 font-medium">{p.name}</td>
                <td className="px-3 py-1.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${posBg(p.position)}`}>
                    {posLabel(p.position)}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtHeight(p.heightInches)}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtHeight(p.standingReachInches)}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">{p.verticalJumpInches ? `${p.verticalJumpInches}"` : "—"}</td>
                <td className="px-3 py-1.5 text-right font-semibold">
                  <span className={p.overallScore != null ? (p.overallScore >= 7 ? "text-green-700" : p.overallScore >= 4 ? "text-yellow-700" : "text-red-600") : "text-muted-foreground"}>
                    {fmt(p.overallScore)}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">{fmt(p.positionScore)}</td>
                <td className="px-3 py-1.5 text-right">{fmt(p.physicalScore)}</td>
                <td className="px-3 py-1.5 text-right">
                  <span className={evalCount === 0 ? "text-red-400 font-semibold" : "text-muted-foreground"}>{evalCount}</span>
                </td>
                <td className="px-3 py-1.5">
                  {pick ? (
                    <span className="flex items-center gap-1">
                      {pick.committed && <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />}
                      {pick.locked && !pick.committed && <Lock className="h-3 w-3 text-blue-400 shrink-0" />}
                      <span className="truncate max-w-[120px] text-blue-700 font-medium">{pick.teamName}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Undrafted</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServerView() {
  const { data: players = [] } = useListPlayers(undefined, { query: FAST_REFETCH });
  const { data: coaches = [] } = useListCoaches({ query: FAST_REFETCH });
  const { data: allDraftPicks = [] } = useGetAllDraftPicks({ query: FAST_REFETCH });
  const { data: allWishlistPicks = [] } = useGetAllWishlistPicks({ query: FAST_REFETCH });
  const { data: allMustHavePicks = [] } = useGetAllMustHavePicks({ query: FAST_REFETCH });
  const { data: evaluations = [] } = useListEvaluations(undefined, { query: SLOW_REFETCH });

  const rankedCoaches = useMemo(
    () => [...coaches].sort((a, b) => a.teamName.localeCompare(b.teamName)),
    [coaches]
  );

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // picks per coach as array (for TeamColumn)
  const picksByCoach = useMemo(() => {
    const map = new Map<number, DraftPick[]>();
    for (const pick of allDraftPicks) {
      if (!map.has(pick.coachId)) map.set(pick.coachId, []);
      map.get(pick.coachId)!.push(pick);
    }
    return map;
  }, [allDraftPicks]);

  // picks per coach as Map<playerId, pick> (for matrix)
  const draftPicksByCoach = useMemo(() => {
    const outer = new Map<number, Map<number, DraftPick>>();
    for (const pick of allDraftPicks) {
      if (!outer.has(pick.coachId)) outer.set(pick.coachId, new Map());
      outer.get(pick.coachId)!.set(pick.playerId, pick);
    }
    return outer;
  }, [allDraftPicks]);

  // flat map for All Players tab
  const draftPickMap = useMemo(() => new Map(allDraftPicks.map((p) => [p.playerId, p])), [allDraftPicks]);

  const wishlistByCoach = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const w of allWishlistPicks) {
      if (!map.has(w.coachId)) map.set(w.coachId, new Set());
      map.get(w.coachId)!.add(w.playerId);
    }
    return map;
  }, [allWishlistPicks]);

  const mustHaveByCoach = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const m of allMustHavePicks) {
      if (!map.has(m.coachId)) map.set(m.coachId, new Set());
      map.get(m.coachId)!.add(m.playerId);
    }
    return map;
  }, [allMustHavePicks]);

  const evalCountMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of evaluations) {
      map.set(e.playerId, (map.get(e.playerId) ?? 0) + 1);
    }
    return map;
  }, [evaluations]);

  const totalDrafted = allDraftPicks.length;
  const totalCommitted = allDraftPicks.filter((p) => p.committed).length;
  const undrafted = players.filter((p) => !draftPickMap.has(p.id)).length;
  const unevaluated = players.filter((p) => (evalCountMap.get(p.id) ?? 0) === 0).length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-4">
          <img src="/tribe-logo.png" alt="Tribe VB" className="h-9 w-9 object-contain" />
          <div>
            <h1 className="text-xl font-black tracking-tight">Command Center</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Live view · all players, rosters, and evaluations</p>
          </div>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <div className="text-center">
            <p className="font-bold text-lg leading-none">{players.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Players</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg leading-none text-blue-600">{totalDrafted}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Drafted</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg leading-none text-green-600">{totalCommitted}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Committed</p>
          </div>
          <div className="text-center">
            <p className={`font-bold text-lg leading-none ${undrafted > 0 ? "text-amber-500" : "text-muted-foreground"}`}>{undrafted}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Undrafted</p>
          </div>
          <div className="text-center">
            <p className={`font-bold text-lg leading-none ${unevaluated > 0 ? "text-red-500" : "text-muted-foreground"}`}>{unevaluated}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">No Evals</p>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground ml-2 border-l pl-4">
            <RefreshCw className="h-3.5 w-3.5 animate-pulse text-green-500" />
            <span className="text-[11px]">Live</span>
          </div>
          <Link href="/">
            <a className="ml-4 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground border rounded px-2 py-1">
              <ExternalLink className="h-3 w-3" />
              Coach View
            </a>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="teams" className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 pt-3 pb-0 border-b bg-white shrink-0">
          <TabsList>
            <TabsTrigger value="teams" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Teams
              <Badge variant="secondary" className="ml-1 px-1.5 h-4 text-[10px]">{rankedCoaches.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="matrix" className="gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" />
              Player Status
            </TabsTrigger>
            <TabsTrigger value="players" className="gap-1.5">
              <User className="h-3.5 w-3.5" />
              All Players
              {unevaluated > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 h-4 text-[10px]">{unevaluated}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Teams tab — hero view */}
        <TabsContent value="teams" className="flex-1 overflow-auto p-4 m-0">
          <div className="flex gap-3 pb-4 w-fit">
            {rankedCoaches.map((coach, i) => (
              <TeamColumn
                key={coach.id}
                coach={coach}
                rank={i + 1}
                picks={picksByCoach.get(coach.id) ?? []}
                playerMap={playerMap}
              />
            ))}
            {rankedCoaches.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No coaches found. Add coaches first.</p>
            )}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-5 text-[11px] text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> Committed</span>
            <span className="flex items-center gap-1"><Lock className="h-3 w-3 text-blue-400" /> Locked</span>
            <span className="flex items-center gap-1 ml-4 text-[10px]">Colors: <span className="px-1 rounded bg-green-50 border border-green-200">green row</span> = committed &nbsp; <span className="px-1 rounded bg-blue-50 border border-blue-200">blue row</span> = locked</span>
          </div>
        </TabsContent>

        {/* Player Status Matrix */}
        <TabsContent value="matrix" className="flex-1 overflow-hidden m-0">
          <PlayerStatusMatrix
            players={players}
            coaches={rankedCoaches}
            draftPicksByCoach={draftPicksByCoach}
            wishlistByCoach={wishlistByCoach}
            mustHaveByCoach={mustHaveByCoach}
          />
          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground px-4 py-2 border-t bg-white shrink-0">
            <span className="flex items-center gap-1"><span className="text-[9px] font-bold px-1 rounded border bg-blue-100 text-blue-800 border-blue-300">OH</span> Drafted (shows position)</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> Committed</span>
            <span className="flex items-center gap-1"><Star className="h-3 w-3 text-violet-500 fill-violet-500" /> Coach's Pick</span>
            <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-pink-400 fill-pink-400" /> Wishlist</span>
            <span className="flex items-center gap-1 text-muted-foreground/40">· Not interested</span>
          </div>
        </TabsContent>

        {/* All Players tab */}
        <TabsContent value="players" className="flex-1 overflow-hidden m-0">
          <PlayersTab
            players={players}
            draftPickMap={draftPickMap}
            evalCountMap={evalCountMap}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState, useMemo } from "react";
import {
  useListCoaches, useCreateCoach, useDeleteCoach, useImportCoachesCsv,
  useGetCoachDraft, useAddPlayerToDraft, useRemovePlayerFromDraft,
  useGetAllDraftPicks, useListPlayers,
  useTogglePlayerLock, useGetAllWishlistPicks, useGetCoachWishlist,
  useAddToWishlist, useRemoveFromWishlist,
  getListCoachesQueryKey, getGetCoachDraftQueryKey, getGetAllDraftPicksQueryKey,
  getGetAllWishlistPicksQueryKey, getGetCoachWishlistQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Plus, Trash2, CheckCircle2, X, Upload, FileText, UserPlus,
  Search, AlertCircle, Ruler, TrendingUp, ArrowUp, ArrowDown, Star,
  Lock, Unlock, Heart, HeartOff, Download, Mail,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const POSITION_LABELS: Record<string, string> = {
  Setter: "S", OutsideHitter: "OH", MiddleBlocker: "MB", Opposite: "OPP", Libero: "L",
};
const POSITION_COLORS: Record<string, string> = {
  Setter: "bg-purple-100 text-purple-700 border-purple-200",
  OutsideHitter: "bg-blue-100 text-blue-700 border-blue-200",
  MiddleBlocker: "bg-green-100 text-green-700 border-green-200",
  Opposite: "bg-orange-100 text-orange-700 border-orange-200",
  Libero: "bg-teal-100 text-teal-700 border-teal-200",
};
const TEAM_COLORS = [
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-cyan-100 text-cyan-700 border-cyan-200",
  "bg-lime-100 text-lime-700 border-lime-200",
  "bg-pink-100 text-pink-700 border-pink-200",
];

const SAMPLE_CSV = `coachName,teamName\nSarah Kim,Team Gold\nMike Torres,Team Black\nJen Park,Team Blue`;

function exportRosterCsv(teamName: string, coachName: string, players: { jerseyNumber: string; name: string; position: string; overallScore?: number | null; locked?: boolean }[]) {
  const header = "Jersey,Name,Position,OVR,Locked";
  const rows = players
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
    .map((p) => `${p.jerseyNumber},${p.name},${p.position},${p.overallScore?.toFixed(1) ?? ""},${p.locked ? "Yes" : "No"}`);
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${teamName.replace(/\s+/g, "_")}_roster.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildMailtoLink(teamName: string, coachName: string, players: { jerseyNumber: string; name: string; position: string; overallScore?: number | null; locked?: boolean }[]) {
  const sorted = [...players].sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));
  const body = [
    `${teamName} — Draft Roster`,
    `Coach: ${coachName}`,
    `Players: ${sorted.length}/12`,
    "",
    ...sorted.map((p) => `#${p.jerseyNumber}  ${p.name}  (${POSITION_LABELS[p.position] ?? p.position})${p.overallScore != null ? `  OVR ${p.overallScore.toFixed(1)}` : ""}${p.locked ? "  🔒" : ""}`),
  ].join("\n");
  return `mailto:?subject=${encodeURIComponent(`${teamName} Draft Roster`)}&body=${encodeURIComponent(body)}`;
}

export default function Draft() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newPriority, setNewPriority] = useState<string[]>([]);
  const [csvText, setCsvText] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [poolPosition, setPoolPosition] = useState<string>("All");
  const [poolSearch, setPoolSearch] = useState("");

  const { data: coaches = [], isLoading: coachesLoading } = useListCoaches({ query: { queryKey: getListCoachesQueryKey() } });
  const { data: allPicks = [] } = useGetAllDraftPicks({ query: { queryKey: getGetAllDraftPicksQueryKey(), refetchInterval: 5000 } });
  const { data: allWishlists = [] } = useGetAllWishlistPicks({ query: { queryKey: getGetAllWishlistPicksQueryKey(), refetchInterval: 5000 } });
  const { data: allPlayers = [] } = useListPlayers();
  const { data: draft, isLoading: draftLoading } = useGetCoachDraft(selectedCoachId!, {
    query: { enabled: !!selectedCoachId, queryKey: getGetCoachDraftQueryKey(selectedCoachId!), refetchInterval: 5000 },
  });
  const { data: myWishlist = [] } = useGetCoachWishlist(selectedCoachId!, {
    query: { enabled: !!selectedCoachId, queryKey: getGetCoachWishlistQueryKey(selectedCoachId!) },
  });

  const createCoach = useCreateCoach();
  const deleteCoach = useDeleteCoach();
  const importCoaches = useImportCoachesCsv();
  const addPlayer = useAddPlayerToDraft();
  const removePlayer = useRemovePlayerFromDraft();
  const toggleLock = useTogglePlayerLock();
  const addWish = useAddToWishlist();
  const removeWish = useRemoveFromWishlist();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListCoachesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAllDraftPicksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAllWishlistPicksQueryKey() });
    if (selectedCoachId) {
      queryClient.invalidateQueries({ queryKey: getGetCoachDraftQueryKey(selectedCoachId) });
      queryClient.invalidateQueries({ queryKey: getGetCoachWishlistQueryKey(selectedCoachId) });
    }
  };

  const handleCreateCoach = () => {
    if (!newName.trim() || !newTeam.trim()) return;
    createCoach.mutate(
      { data: { name: newName.trim(), teamName: newTeam.trim(), draftPriority: newPriority } },
      {
        onSuccess: () => { setNewName(""); setNewTeam(""); setNewPriority([]); setAddDialogOpen(false); invalidateAll(); },
        onError: () => toast({ title: "Failed to create coach", variant: "destructive" }),
      }
    );
  };

  const togglePriority = (pos: string) => {
    setNewPriority((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };
  const movePriority = (idx: number, dir: -1 | 1) => {
    setNewPriority((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const handleDeleteCoach = (id: number) => {
    deleteCoach.mutate({ id }, {
      onSuccess: () => { if (selectedCoachId === id) setSelectedCoachId(null); invalidateAll(); },
    });
  };

  const handleImport = () => {
    importCoaches.mutate(
      { data: { csvData: csvText } },
      {
        onSuccess: (r) => {
          toast({ title: `${r.imported} imported, ${r.updated} updated` });
          setCsvText(""); setImportDialogOpen(false); invalidateAll();
        },
        onError: () => toast({ title: "Import failed", variant: "destructive" }),
      }
    );
  };

  const handleClaim = (playerId: number, position: string) => {
    if (!selectedCoachId) return;
    addPlayer.mutate(
      { id: selectedCoachId, data: { playerId, position } },
      {
        onSuccess: () => invalidateAll(),
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to claim player";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleRelease = (playerId: number) => {
    if (!selectedCoachId) return;
    removePlayer.mutate(
      { id: selectedCoachId, playerId },
      { onSuccess: () => invalidateAll() }
    );
  };

  const handleToggleLock = (playerId: number, currentLocked: boolean) => {
    if (!selectedCoachId) return;
    toggleLock.mutate(
      { id: selectedCoachId, playerId, data: { locked: !currentLocked } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: !currentLocked ? "Player locked" : "Player unlocked" });
        },
        onError: () => toast({ title: "Failed to update lock", variant: "destructive" }),
      }
    );
  };

  const handleToggleWish = (playerId: number) => {
    if (!selectedCoachId) return;
    const isWished = myWishlist.includes(playerId);
    if (isWished) {
      removeWish.mutate(
        { id: selectedCoachId, playerId },
        {
          onSuccess: () => invalidateAll(),
          onError: () => toast({ title: "Failed to update wishlist", variant: "destructive" }),
        }
      );
    } else {
      addWish.mutate(
        { id: selectedCoachId, data: { playerId } },
        {
          onSuccess: () => invalidateAll(),
          onError: () => toast({ title: "Failed to update wishlist", variant: "destructive" }),
        }
      );
    }
  };

  // Build claimed map: playerId -> { teamName, coachName, coachId }
  const claimedMap = new Map<number, { teamName: string; coachName: string; coachId: number }>();
  for (const pick of allPicks) {
    claimedMap.set(pick.playerId, { teamName: pick.teamName, coachName: pick.coachName, coachId: pick.coachId });
  }

  // Build wishlist conflict map: playerId -> how many coaches want this player
  const wishConflictMap = new Map<number, number>();
  for (const w of allWishlists) {
    wishConflictMap.set(w.playerId, (wishConflictMap.get(w.playerId) ?? 0) + 1);
  }

  // Coach color index
  const coachColorMap = new Map<number, string>();
  coaches.forEach((c, i) => coachColorMap.set(c.id, TEAM_COLORS[i % TEAM_COLORS.length]));

  const myWishSet = new Set(myWishlist);

  const POSITIONS = ["All", "Setter", "OutsideHitter", "MiddleBlocker", "Opposite", "Libero"];
  const POSITION_TAB_LABELS: Record<string, string> = {
    All: "All", Setter: "S", OutsideHitter: "OH", MiddleBlocker: "MB", Opposite: "OPP", Libero: "L",
  };

  // Available = not claimed by ANY coach
  const availablePlayers = useMemo(() => allPlayers.filter((p) => !claimedMap.has(p.id)), [allPlayers, claimedMap]);

  // Filtered + searched player list (only available)
  const filteredPlayers = useMemo(() => {
    const q = poolSearch.trim().toLowerCase();
    return availablePlayers
      .filter((p) => poolPosition === "All" || p.position === poolPosition)
      .filter((p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.jerseyNumber.toString().includes(q)
      )
      .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));
  }, [availablePlayers, poolPosition, poolSearch]);

  // Counts per position tab (only available players)
  const positionCounts = useMemo(() => {
    const counts: Record<string, number> = { All: availablePlayers.length };
    for (const p of availablePlayers) {
      counts[p.position] = (counts[p.position] ?? 0) + 1;
    }
    return counts;
  }, [availablePlayers]);

  // Determine next needed priority position for the selected coach
  const nextPriorityPosition = useMemo(() => {
    const selectedCoach = coaches.find((c) => c.id === selectedCoachId);
    if (!selectedCoach) return null;
    const priority: string[] = Array.isArray(selectedCoach.draftPriority) ? selectedCoach.draftPriority : [];
    if (!priority.length) return null;
    for (const pos of priority) {
      const stillAvailable = availablePlayers.some((p) => p.position === pos);
      if (stillAvailable) return pos;
    }
    return null;
  }, [coaches, selectedCoachId, availablePlayers]);

  const selectedCoach = coaches.find((c) => c.id === selectedCoachId);
  const draftPlayers = (draft?.players ?? []) as {
    id: number; jerseyNumber: string; name: string; position: string;
    overallScore?: number | null; locked?: boolean;
  }[];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-none p-6 pb-4 border-b">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Live Draft</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select a coach/team, then tap players from the pool to claim them.
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="font-semibold">
                  <Upload className="h-4 w-4 mr-2" /> Import Coaches
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Import Coaches CSV</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Required columns: <code className="bg-muted px-1 rounded">coachName</code> (or <code className="bg-muted px-1 rounded">name</code>), <code className="bg-muted px-1 rounded">teamName</code> (or <code className="bg-muted px-1 rounded">team</code>)</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCsvText(SAMPLE_CSV)}>
                    <FileText className="h-3.5 w-3.5 mr-1" /> Load sample
                  </Button>
                  <Textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder={"coachName,teamName\nSarah Kim,Team Gold\n..."}
                    className="font-mono text-sm min-h-[120px]"
                  />
                  <Button className="w-full font-bold" disabled={!csvText.trim() || importCoaches.isPending} onClick={handleImport}>
                    {importCoaches.isPending ? "Importing..." : "Import"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) { setNewName(""); setNewTeam(""); setNewPriority([]); } }}>
              <DialogTrigger asChild>
                <Button size="sm" className="font-semibold">
                  <Plus className="h-4 w-4 mr-2" /> Add Coach
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add Coach / Team</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold">Coach Name</label>
                    <Input className="mt-1" placeholder="e.g. Sarah Kim" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Team Name</label>
                    <Input className="mt-1" placeholder="e.g. Team Gold" value={newTeam} onChange={(e) => setNewTeam(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Draft Priority <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-2">Tap positions to add them in priority order. Use arrows to reorder.</p>
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {["Setter", "OutsideHitter", "MiddleBlocker", "Opposite", "Libero"].map((pos) => {
                        const idx = newPriority.indexOf(pos);
                        const selected = idx !== -1;
                        return (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => togglePriority(pos)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                              selected ? `${POSITION_COLORS[pos]} border-current` : "bg-muted/50 text-muted-foreground border-border hover:border-muted-foreground"
                            }`}
                          >
                            {selected && <span className="font-black text-[10px] w-3.5 h-3.5 rounded-full bg-current/20 flex items-center justify-center">{idx + 1}</span>}
                            {POSITION_LABELS[pos]}
                          </button>
                        );
                      })}
                    </div>
                    {newPriority.length > 0 && (
                      <div className="space-y-1 border rounded-lg p-2 bg-muted/20">
                        {newPriority.map((pos, idx) => (
                          <div key={pos} className="flex items-center gap-2">
                            <span className="text-xs font-black text-muted-foreground w-4 text-right">{idx + 1}.</span>
                            <Badge variant="outline" className={`text-xs font-bold flex-1 ${POSITION_COLORS[pos] ?? ""}`}>
                              {POSITION_LABELS[pos]} — {pos.replace(/([A-Z])/g, " $1").trim()}
                            </Badge>
                            <div className="flex gap-0.5">
                              <button type="button" onClick={() => movePriority(idx, -1)} disabled={idx === 0}
                                className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button type="button" onClick={() => movePriority(idx, 1)} disabled={idx === newPriority.length - 1}
                                className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button type="button" onClick={() => togglePriority(pos)}
                                className="p-0.5 rounded text-muted-foreground hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button className="w-full font-bold" disabled={!newName.trim() || !newTeam.trim() || createCoach.isPending} onClick={handleCreateCoach}>
                    <UserPlus className="h-4 w-4 mr-2" /> Add Coach
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Coach list */}
        <div className="w-64 shrink-0 border-r flex flex-col overflow-hidden">
          <div className="flex-none px-4 py-3 border-b bg-muted/30">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teams ({coaches.length})</div>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {coachesLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))
            ) : coaches.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No coaches yet.<br />Add one to start drafting.
              </div>
            ) : (
              coaches.map((coach) => {
                const picks = allPicks.filter((p) => p.coachId === coach.id);
                const isSelected = selectedCoachId === coach.id;
                const color = coachColorMap.get(coach.id) ?? TEAM_COLORS[0];
                return (
                  <div
                    key={coach.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors group ${isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"}`}
                    onClick={() => setSelectedCoachId(coach.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.split(" ")[0]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{coach.teamName}</div>
                        <div className="text-xs text-muted-foreground truncate">{coach.name}</div>
                        <div className="text-xs font-bold text-primary mt-0.5">{picks.length}/12 picked</div>
                      </div>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                        onClick={(e) => { e.stopPropagation(); handleDeleteCoach(coach.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {Array.isArray(coach.draftPriority) && coach.draftPriority.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {coach.draftPriority.map((pos: string, i: number) => (
                          <span key={pos} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${POSITION_COLORS[pos] ?? "bg-muted text-muted-foreground"}`}>
                            <span className="opacity-60">{i + 1}.</span>{POSITION_LABELS[pos] ?? pos}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Player pool */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedCoachId ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <Users className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <div className="text-xl font-bold text-muted-foreground">Select a team to start drafting</div>
                <div className="text-sm text-muted-foreground mt-2">Click a team on the left to open their draft board</div>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="pool" className="flex flex-col h-full">
              <div className="flex-none px-4 pt-4 border-b">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-lg">{selectedCoach?.teamName}</div>
                    <div className="text-sm text-muted-foreground">{selectedCoach?.name}</div>
                  </div>
                  <div className="text-2xl font-black text-primary tabular-nums">
                    {draftPlayers.length}<span className="text-sm font-normal text-muted-foreground">/12</span>
                  </div>
                </div>
                <TabsList className="mb-0">
                  <TabsTrigger value="pool">Player Pool</TabsTrigger>
                  <TabsTrigger value="myteam">
                    My Team ({draftPlayers.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Player Pool tab */}
              <TabsContent value="pool" className="flex-1 overflow-hidden m-0 flex flex-col">
                <div className="flex-none border-b px-4 pt-3 pb-0 space-y-2 bg-background">
                  <div className="flex gap-1.5 flex-wrap pb-1">
                    {POSITIONS.map((pos) => {
                      const active = poolPosition === pos;
                      const count = positionCounts[pos] ?? 0;
                      return (
                        <button
                          key={pos}
                          onClick={() => setPoolPosition(pos)}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                            active
                              ? pos === "All"
                                ? "bg-foreground text-background border-foreground"
                                : `${POSITION_COLORS[pos]} border-current`
                              : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground"
                          }`}
                        >
                          {POSITION_TAB_LABELS[pos]}
                          <span className={`tabular-nums ${active ? "opacity-80" : "opacity-60"}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="relative pb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search by name or #..."
                      value={poolSearch}
                      onChange={(e) => setPoolSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                    {poolSearch && (
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setPoolSearch("")}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4">
                  {filteredPlayers.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground text-sm">
                      {allPlayers.length === 0 ? "No players found. Import players first." : "No players match your search."}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredPlayers.map((player) => {
                        const isPriority = nextPriorityPosition !== null && player.position === nextPriorityPosition;
                        const missingMeasurements = !player.heightInches || !player.verticalJumpInches;
                        const scoreColor = (s: number) =>
                          s >= 8 ? "text-green-600" : s >= 6 ? "text-yellow-600" : "text-red-500";
                        const isWished = myWishSet.has(player.id);
                        const conflictCount = wishConflictMap.get(player.id) ?? 0;
                        const otherTeamsWant = conflictCount - (isWished ? 1 : 0);

                        return (
                          <div
                            key={player.id}
                            className={`rounded-lg border transition-colors ${
                              isPriority
                                ? "bg-amber-50 border-amber-300"
                                : "bg-card border-border"
                            }`}
                          >
                            {/* Top row: jersey + name + badges + actions */}
                            <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                              <span className="text-xl font-black tabular-nums w-10 text-center shrink-0 text-foreground">
                                #{player.jerseyNumber}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm leading-tight flex items-center gap-1.5 flex-wrap">
                                  {player.name}
                                  {isPriority && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full">
                                      <Star className="h-2.5 w-2.5" /> Priority
                                    </span>
                                  )}
                                  {otherTeamsWant > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">
                                      <Heart className="h-2.5 w-2.5" />
                                      {otherTeamsWant} {otherTeamsWant === 1 ? "team" : "teams"} want
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <Badge variant="outline" className={`text-xs font-bold py-0 h-4 ${POSITION_COLORS[player.position] ?? ""}`}>
                                    {POSITION_LABELS[player.position] ?? player.position}
                                  </Badge>
                                  {player.checkedIn ? (
                                    <Badge variant="outline" className="text-xs h-4 py-0 bg-green-50 text-green-700 border-green-200">
                                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> In
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs h-4 py-0 text-muted-foreground">
                                      Not Here
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {/* Actions: wish + claim */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  title={isWished ? "Remove from wishlist" : "Add to wishlist"}
                                  onClick={(e) => { e.stopPropagation(); handleToggleWish(player.id); }}
                                  className={`p-1.5 rounded-md border transition-colors ${
                                    isWished
                                      ? "text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100"
                                      : "text-muted-foreground border-border hover:border-rose-200 hover:text-rose-400"
                                  }`}
                                >
                                  {isWished ? <HeartOff className="h-3.5 w-3.5" /> : <Heart className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClaim(player.id, player.position)}
                                  className={`text-xs flex items-center gap-1 whitespace-nowrap border border-dashed px-2 py-1 rounded-md transition-colors ${
                                    isPriority
                                      ? "border-amber-400 text-amber-700 hover:bg-amber-200"
                                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                                  }`}
                                >
                                  <Plus className="h-3.5 w-3.5" /> Claim
                                </button>
                              </div>
                            </div>

                            {/* Bottom row: scores + measurements */}
                            <div className="flex items-center gap-0 border-t border-border/60 divide-x divide-border/60 text-xs">
                              <div className="flex flex-col items-center px-3 py-1.5 flex-1">
                                <span className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold">OVR</span>
                                <span className={`font-black tabular-nums text-sm ${player.overallScore != null ? scoreColor(player.overallScore) : "text-muted-foreground"}`}>
                                  {player.overallScore != null ? player.overallScore.toFixed(1) : "—"}
                                </span>
                              </div>
                              <div className="flex flex-col items-center px-3 py-1.5 flex-1">
                                <span className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold">POS</span>
                                <span className={`font-black tabular-nums text-sm ${player.positionScore != null ? scoreColor(player.positionScore) : "text-muted-foreground"}`}>
                                  {player.positionScore != null ? player.positionScore.toFixed(1) : "—"}
                                </span>
                              </div>
                              <div className="flex flex-col items-center px-3 py-1.5 flex-1">
                                <span className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold flex items-center gap-0.5"><TrendingUp className="h-2.5 w-2.5" />POT</span>
                                <span className={`font-black tabular-nums text-sm ${player.potentialScore != null ? scoreColor(player.potentialScore) : "text-muted-foreground"}`}>
                                  {player.potentialScore != null ? player.potentialScore.toFixed(1) : "—"}
                                </span>
                              </div>
                              <div className="flex flex-col items-center px-3 py-1.5 flex-[2]">
                                <span className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold flex items-center gap-0.5"><Ruler className="h-2.5 w-2.5" />Measurements</span>
                                {missingMeasurements ? (
                                  <span className="flex items-center gap-0.5 text-red-500 font-semibold">
                                    <AlertCircle className="h-3 w-3" /> Missing
                                  </span>
                                ) : (
                                  <span className="font-medium text-foreground tabular-nums">
                                    {Math.floor(player.heightInches! / 12)}'{player.heightInches! % 12}"
                                    <span className="text-muted-foreground mx-1">·</span>
                                    {player.standingReachInches}"
                                    <span className="text-muted-foreground mx-1">·</span>
                                    {player.verticalJumpInches}"↑
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* My Team tab */}
              <TabsContent value="myteam" className="flex-1 overflow-auto m-0 p-4">
                {draftLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
                  </div>
                ) : draftPlayers.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-center text-muted-foreground">
                    <div>
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <div className="font-semibold">No players claimed yet</div>
                      <div className="text-sm mt-1">Go to Player Pool and tap players to claim them</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Export bar */}
                    <div className="flex items-center justify-between gap-2 pb-1">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {draftPlayers.length} / 12 players
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm" variant="outline"
                          className="h-8 text-xs font-semibold gap-1.5"
                          onClick={() => exportRosterCsv(selectedCoach?.teamName ?? "Team", selectedCoach?.name ?? "", draftPlayers)}
                        >
                          <Download className="h-3.5 w-3.5" /> Export CSV
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-8 text-xs font-semibold gap-1.5"
                          asChild
                        >
                          <a href={buildMailtoLink(selectedCoach?.teamName ?? "Team", selectedCoach?.name ?? "", draftPlayers)}>
                            <Mail className="h-3.5 w-3.5" /> Email Roster
                          </a>
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {draftPlayers
                        .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
                        .map((player) => {
                          const isLocked = player.locked ?? false;
                          return (
                            <Card key={player.id} className={`transition-colors ${isLocked ? "border-primary/40 bg-primary/5" : "border-primary/20"}`}>
                              <CardContent className="p-3 flex items-start gap-3">
                                <span className="text-xl font-black text-primary tabular-nums w-10 shrink-0">#{player.jerseyNumber}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm leading-tight truncate flex items-center gap-1.5">
                                    {player.name}
                                    {isLocked && <Lock className="h-3 w-3 text-primary shrink-0" />}
                                  </div>
                                  <Badge variant="outline" className={`text-xs font-bold mt-1 ${POSITION_COLORS[player.position] ?? ""}`}>
                                    {POSITION_LABELS[player.position] ?? player.position}
                                  </Badge>
                                  {player.overallScore != null && (
                                    <div className="text-xs text-muted-foreground mt-1 font-medium">{player.overallScore.toFixed(1)} overall</div>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                  <button
                                    type="button"
                                    title={isLocked ? "Unlock player" : "Lock player"}
                                    onClick={() => handleToggleLock(player.id, isLocked)}
                                    className={`h-7 w-7 flex items-center justify-center rounded border transition-colors ${
                                      isLocked
                                        ? "bg-primary text-primary-foreground border-primary hover:bg-primary/80"
                                        : "text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                                    }`}
                                  >
                                    {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                  </button>
                                  {!isLocked && (
                                    <Button
                                      size="sm" variant="ghost"
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleRelease(player.id)}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>

                    {/* Position summary */}
                    <Card className="mt-2">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Roster Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3">
                        <div className="flex flex-wrap gap-2">
                          {["Setter", "OutsideHitter", "MiddleBlocker", "Opposite", "Libero"].map((pos) => {
                            const count = draftPlayers.filter((p) => p.position === pos).length;
                            return (
                              <div key={pos} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${count > 0 ? POSITION_COLORS[pos] : "bg-muted text-muted-foreground border-border"}`}>
                                <span>{POSITION_LABELS[pos]}</span>
                                <span className="font-black">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

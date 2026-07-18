import { useState, useRef, useEffect } from "react";

const HELP = {
  title: "Players",
  description: "The Players page is your master roster. Every player registered for the tryout lives here.",
  steps: [
    { step: 1, text: "Add players manually with the New Player button, or use the Import page to load a CSV or Google Sheet." },
    { step: 2, text: "Filter by position or age group using the tabs. Search by name or jersey number." },
    { step: 3, text: "Click a player's name to open their profile — scores, measurements, photo, and notes all live there." },
    { step: 4, text: "Use the quick-eval button (lightning bolt) to start scoring a player directly from this list." },
  ],
  tips: [
    "Jersey numbers must be unique. If two players share a number, voice scoring on the iPad will be ambiguous.",
    "Age group filters sync with the iPad stations — only players in the active session's age group appear on iPads.",
    "Players marked as checked in show a green badge. Use this to verify attendance at a glance.",
  ],
};
import { useListPlayers, useCreatePlayer, useUpdatePlayer, getListPlayersQueryKey, type PlayerInputPosition, type PlayerUpdatePosition } from "@workspace/api-client-react";
import { Link, useLocation, useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, CheckCircle2, AlertCircle, ChevronRight, Activity, Zap, User, X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRoster } from "@/contexts/roster-context";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { positionColor, positionLabel, primaryPosition, secondaryPosition, POSITION_LABELS } from "@/lib/positions";

function startQueue(ids: number[], label: string, coachName: string, navigateTo: (path: string) => void) {
  if (!ids.length) return;
  sessionStorage.setItem("evalQueue", JSON.stringify({ ids, label, coachName: coachName.trim() || undefined }));
  navigateTo(`/evaluate/${ids[0]}`);
}

export default function Players() {
  const [positionFilter, setPositionFilter] = useState<string>("All");
  const [ageFilter, setAgeFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const { isOnRoster, getRosterSlot } = useRoster();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlFilter = new URLSearchParams(searchString).get("filter") ?? "";
  const [activeFilter, setActiveFilter] = useState(urlFilter);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    setActiveFilter(new URLSearchParams(searchString).get("filter") ?? "");
  }, [searchString]);

  // New player dialog
  const [newPlayerOpen, setNewPlayerOpen] = useState(false);
  const [npName, setNpName] = useState("");
  const [npJersey, setNpJersey] = useState("");
  const [npPosition, setNpPosition] = useState("");
  const [npAge, setNpAge] = useState("");
  const createPlayer = useCreatePlayer();

  const handleCreatePlayer = async () => {
    if (!npName.trim()) return;
    await createPlayer.mutateAsync({
      data: {
        name: npName.trim(),
        jerseyNumber: npJersey || undefined,
        position: npPosition ? (npPosition as PlayerInputPosition) : undefined,
        age: npAge || undefined,
      },
    });
    queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey({}) });
    toast({ title: "Player created" });
    setNewPlayerOpen(false);
    setNpName(""); setNpJersey(""); setNpPosition(""); setNpAge("");
  };

  const [coachDialogOpen, setCoachDialogOpen] = useState(false);
  const [coachNameInput, setCoachNameInput] = useState("");
  const [pendingQueue, setPendingQueue] = useState<{ ids: number[]; label: string } | null>(null);
  const coachInputRef = useRef<HTMLInputElement>(null);

  const updatePlayer = useUpdatePlayer();
  const [editingPositionId, setEditingPositionId] = useState<number | null>(null);

  const setPosition = async (playerId: number, position: string) => {
    await updatePlayer.mutateAsync({ id: playerId, data: { position: position as PlayerUpdatePosition } });
    queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey({}) });
    setEditingPositionId(null);
  };

  const { data: players, isLoading } = useListPlayers({
    position: positionFilter !== "All" ? positionFilter : undefined,
  });

  const ageGroups = Array.from(new Set((players ?? []).map((p) => p.age).filter(Boolean))).sort() as string[];

  const filteredPlayers = players?.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.jerseyNumber ?? "").toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (ageFilter !== "All" && (p.age ?? "") !== ageFilter) return false;
    if (activeFilter === "not-checked-in") return !p.checkedIn;
    if (activeFilter === "missing-measurements") return !p.heightInches || !p.standingReachInches || !p.verticalJumpInches;
    if (activeFilter === "not-evaluated") return p.overallScore == null;
    return true;
  }) ?? [];

  const checkedInIds = filteredPlayers.filter((p) => p.checkedIn).map((p) => p.id);
  const allIds = filteredPlayers.map((p) => p.id);

  const sessionLabel =
    positionFilter !== "All"
      ? `${positionFilter}${search ? ` · "${search}"` : ""}`
      : search
        ? `"${search}"`
        : "All Players";

  const openCoachDialog = (ids: number[], label: string) => {
    setPendingQueue({ ids, label });
    setCoachNameInput("");
    setCoachDialogOpen(true);
    setTimeout(() => coachInputRef.current?.focus(), 50);
  };

  const confirmCoachName = () => {
    if (!pendingQueue) return;
    setCoachDialogOpen(false);
    startQueue(pendingQueue.ids, pendingQueue.label, coachNameInput, navigate);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-none p-6 pb-4 border-b space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Players</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => setNewPlayerOpen(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" /> New Player
            </Button>
            {/* Start evaluation session */}
            <div className="flex items-center gap-1.5 border rounded-lg px-1 py-1 bg-muted/30">
              <span className="text-xs text-muted-foreground font-semibold pl-1.5 pr-0.5">
                <Zap className="h-3.5 w-3.5 inline-block mr-0.5 text-amber-500" />
                Eval Session:
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs font-semibold"
                disabled={checkedInIds.length === 0}
                onClick={() => openCoachDialog(checkedInIds, `Checked-In · ${sessionLabel}`)}
              >
                <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                Checked-In ({checkedInIds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs font-semibold"
                disabled={allIds.length === 0}
                onClick={() => openCoachDialog(allIds, sessionLabel)}
              >
                All ({allIds.length})
              </Button>
            </div>
            <div className="w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or jersey..."
                  className="pl-9 bg-muted/50 border-muted"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {activeFilter && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold w-fit
            ${activeFilter === "missing-measurements" ? "bg-red-50 text-red-700 border border-red-200"
            : activeFilter === "not-evaluated" ? "bg-amber-50 text-amber-700 border border-amber-200"
            : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
            {activeFilter === "missing-measurements" ? (
              <><AlertCircle className="h-4 w-4" /> Showing players with missing measurements</>
            ) : activeFilter === "not-evaluated" ? (
              <><Activity className="h-4 w-4" /> Showing players not yet evaluated</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Showing players not yet checked in</>
            )}
            <button onClick={() => navigate("/players")} className="ml-2 hover:opacity-70">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {ageGroups.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {["All", ...ageGroups].map((age) => (
              <button
                key={age}
                onClick={() => setAgeFilter(age)}
                className={`px-3 py-1 rounded-full text-sm font-semibold border transition-all
                  ${ageFilter === age
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:border-border"}`}
              >
                {age === "All" ? "All Ages" : age}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 overflow-x-auto">
          <Tabs value={positionFilter} onValueChange={setPositionFilter} className="flex-1">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="All" className="px-6 py-2 text-sm font-semibold rounded-md">All Positions</TabsTrigger>
              <TabsTrigger value="OutsideHitter" className="px-6 py-2 text-sm font-semibold rounded-md">Outside Hitter</TabsTrigger>
              <TabsTrigger value="MiddleBlocker" className="px-6 py-2 text-sm font-semibold rounded-md">Middle Blocker</TabsTrigger>
              <TabsTrigger value="Opposite" className="px-6 py-2 text-sm font-semibold rounded-md">Opposite</TabsTrigger>
              <TabsTrigger value="Setter" className="px-6 py-2 text-sm font-semibold rounded-md">Setter</TabsTrigger>
              <TabsTrigger value="Libero" className="px-6 py-2 text-sm font-semibold rounded-md">Libero</TabsTrigger>
              <TabsTrigger value="Undecided" className="px-6 py-2 text-sm font-semibold rounded-md">Undecided</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            size="sm"
            className="shrink-0 font-bold gap-1.5 h-9"
            disabled={allIds.length === 0}
            onClick={() => openCoachDialog(allIds, sessionLabel)}
          >
            <Activity className="h-4 w-4" />
            Eval {positionFilter === "All" ? "All" : positionFilter.replace(/([A-Z])/g, " $1").trim()} ({allIds.length})
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 shadow-sm">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 font-bold uppercase tracking-wider text-xs text-muted-foreground/60">No.</TableHead>
              <TableHead className="w-20 font-bold uppercase tracking-wider text-xs">#</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Name</TableHead>
              <TableHead className="w-36 font-bold uppercase tracking-wider text-xs">Position</TableHead>
              <TableHead className="w-20 font-bold uppercase tracking-wider text-xs text-center">Age</TableHead>
              <TableHead className="w-32 font-bold uppercase tracking-wider text-xs text-center">Status</TableHead>
              <TableHead className="w-48 font-bold uppercase tracking-wider text-xs text-center">Measurements</TableHead>
              <TableHead className="w-40 font-bold uppercase tracking-wider text-xs text-center">Roster</TableHead>
              <TableHead className="w-32 text-right font-bold uppercase tracking-wider text-xs">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  <div className="animate-pulse flex flex-col items-center justify-center">
                    <div className="h-8 w-8 rounded-full bg-muted mb-4" />
                    Loading players...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPlayers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  No players found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredPlayers.map((player, index) => {
                const missingMeasurements =
                  !player.heightInches || !player.standingReachInches || !player.verticalJumpInches;
                const onRoster = isOnRoster(player.id);
                const slot = getRosterSlot(player.id);

                return (
                  <TableRow
                    key={player.id}
                    className={`group cursor-pointer transition-colors ${
                      onRoster
                        ? "bg-muted/60 text-muted-foreground hover:bg-muted/70"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <TableCell className="text-xs tabular-nums text-muted-foreground/50 font-normal">
                      {index + 1}
                    </TableCell>
                    <TableCell className={`font-black text-xl tabular-nums ${onRoster ? "text-muted-foreground" : "text-primary"}`}>
                      {player.jerseyNumber}
                    </TableCell>
                    <TableCell className={`font-bold text-base ${onRoster ? "text-muted-foreground" : ""}`}>
                      <Link
                        href={`/players/${player.id}`}
                        className="hover:underline underline-offset-2 hover:text-primary transition-colors"
                      >
                        {player.name}
                      </Link>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {editingPositionId === player.id ? (
                        <select
                          autoFocus
                          className="text-xs border rounded px-1 py-0.5 bg-background"
                          defaultValue={primaryPosition(player.position) ?? ""}
                          onBlur={() => setEditingPositionId(null)}
                          onChange={(e) => { if (e.target.value) setPosition(player.id, e.target.value); }}
                        >
                          <option value="">— pick —</option>
                          {Object.entries(POSITION_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant="secondary"
                            title="Click to edit position"
                            onClick={() => setEditingPositionId(player.id)}
                            className={`font-semibold border w-fit cursor-pointer hover:opacity-80 ${
                              onRoster
                                ? "bg-muted text-muted-foreground border-border"
                                : positionColor(player.position)
                            }`}
                          >
                            {positionLabel(player.position)}
                          </Badge>
                          {secondaryPosition(player.position) && (
                            <span className="text-[10px] text-muted-foreground/60 font-medium pl-0.5">
                              +{POSITION_LABELS[secondaryPosition(player.position)!] || secondaryPosition(player.position)}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium tabular-nums text-muted-foreground">
                      {player.age ?? <span className="text-muted-foreground/30">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {player.checkedIn ? (
                        <Badge variant="outline" className={`${onRoster ? "bg-muted text-muted-foreground border-border" : "bg-green-50 text-green-700 border-green-200"}`}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Checked In
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Not Here</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {missingMeasurements ? (
                        <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                          <AlertCircle className="w-3 h-3 mr-1" /> Missing
                        </Badge>
                      ) : (
                        <span className={`text-sm font-medium flex items-center justify-center gap-2 ${onRoster ? "opacity-50" : ""}`}>
                          <span title="Height">{Math.floor(player.heightInches! / 12)}'{player.heightInches! % 12}"</span>
                          <span className="text-border">•</span>
                          <span title="Reach">{player.standingReachInches}"</span>
                          <span className="text-border">•</span>
                          <span title="Vertical">{player.verticalJumpInches}"</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {onRoster && slot ? (
                        <Badge className="bg-primary/15 text-primary border-primary/30 font-semibold text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {slot.positionLabel}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={`flex justify-end gap-2 transition-opacity ${onRoster ? "opacity-40 group-hover:opacity-70" : "opacity-0 group-hover:opacity-100"}`}>
                        <Button
                          size="sm"
                          variant="default"
                          className="font-bold"
                          onClick={() => {
                            const idx = filteredPlayers.findIndex((p) => p.id === player.id);
                            const queueIds = [
                              ...filteredPlayers.slice(idx).map((p) => p.id),
                              ...filteredPlayers.slice(0, idx).map((p) => p.id),
                            ];
                            openCoachDialog(queueIds, sessionLabel);
                          }}
                        >
                          <Activity className="w-4 h-4 mr-1" /> Eval
                        </Button>
                        <Button size="sm" variant="secondary" asChild>
                          <Link href={`/players/${player.id}`}>
                            Profile <ChevronRight className="w-4 h-4 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* New player dialog */}
      <Dialog open={newPlayerOpen} onOpenChange={setNewPlayerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Add Player
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Full Name *</label>
              <Input value={npName} onChange={(e) => setNpName(e.target.value)} placeholder="e.g. Maria Garcia"
                className="mt-1" onKeyDown={(e) => { if (e.key === "Enter") handleCreatePlayer(); }} autoFocus />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Jersey #</label>
                <Input value={npJersey} onChange={(e) => setNpJersey(e.target.value)} placeholder="e.g. 12" className="mt-1" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Age Group</label>
                <select value={npAge} onChange={(e) => setNpAge(e.target.value)}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">— Select —</option>
                  {["10U","11U","12U","13U","14U","15U","16U","17U","18U"].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Position</label>
              <select value={npPosition} onChange={(e) => setNpPosition(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">— Select —</option>
                {Object.entries(POSITION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewPlayerOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePlayer} disabled={!npName.trim() || createPlayer.isPending} className="font-bold">
              <UserPlus className="h-4 w-4 mr-1" /> {createPlayer.isPending ? "Creating…" : "Create Player"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coach name dialog */}
      <Dialog open={coachDialogOpen} onOpenChange={setCoachDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Who is evaluating?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              ref={coachInputRef}
              placeholder="Your name (e.g. Coach Sarah)"
              value={coachNameInput}
              onChange={(e) => setCoachNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmCoachName(); }}
              className="text-base"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Each coach's scores are kept separate and averaged together for rankings.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCoachDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmCoachName} className="font-bold">
              <Zap className="h-4 w-4 mr-1" /> Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

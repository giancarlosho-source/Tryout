import { useState } from "react";
import { useListPlayers } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, CheckCircle2, AlertCircle, ChevronRight, Activity, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoster } from "@/contexts/roster-context";

const POSITION_COLORS: Record<string, string> = {
  Setter: "bg-purple-100 text-purple-700 border-purple-200",
  OutsideHitter: "bg-blue-100 text-blue-700 border-blue-200",
  MiddleBlocker: "bg-green-100 text-green-700 border-green-200",
  Opposite: "bg-orange-100 text-orange-700 border-orange-200",
  Libero: "bg-pink-100 text-pink-700 border-pink-200",
};

function startQueue(ids: number[], label: string, navigateTo: (path: string) => void) {
  if (!ids.length) return;
  sessionStorage.setItem("evalQueue", JSON.stringify({ ids, label }));
  navigateTo(`/evaluate/${ids[0]}`);
}

export default function Players() {
  const [positionFilter, setPositionFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const { isOnRoster, getRosterSlot } = useRoster();
  const [, navigate] = useLocation();

  const { data: players, isLoading } = useListPlayers({
    position: positionFilter !== "All" ? positionFilter : undefined,
  });

  const filteredPlayers = players?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.jerseyNumber ?? "").toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const checkedInIds = filteredPlayers.filter((p) => p.checkedIn).map((p) => p.id);
  const allIds = filteredPlayers.map((p) => p.id);

  const sessionLabel =
    positionFilter !== "All"
      ? `${positionFilter}${search ? ` · "${search}"` : ""}`
      : search
        ? `"${search}"`
        : "All Players";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-none p-6 pb-4 border-b space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Players</h1>
          <div className="flex items-center gap-3">
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
                onClick={() => startQueue(checkedInIds, `Checked-In · ${sessionLabel}`, navigate)}
              >
                <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                Checked-In ({checkedInIds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs font-semibold"
                disabled={allIds.length === 0}
                onClick={() => startQueue(allIds, sessionLabel, navigate)}
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

        <div className="flex items-center gap-3 overflow-x-auto">
          <Tabs value={positionFilter} onValueChange={setPositionFilter} className="flex-1">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="All" className="px-6 py-2 text-sm font-semibold rounded-md">All Positions</TabsTrigger>
              <TabsTrigger value="OutsideHitter" className="px-6 py-2 text-sm font-semibold rounded-md">Outside Hitter</TabsTrigger>
              <TabsTrigger value="MiddleBlocker" className="px-6 py-2 text-sm font-semibold rounded-md">Middle Blocker</TabsTrigger>
              <TabsTrigger value="Opposite" className="px-6 py-2 text-sm font-semibold rounded-md">Opposite</TabsTrigger>
              <TabsTrigger value="Setter" className="px-6 py-2 text-sm font-semibold rounded-md">Setter</TabsTrigger>
              <TabsTrigger value="Libero" className="px-6 py-2 text-sm font-semibold rounded-md">Libero</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            size="sm"
            className="shrink-0 font-bold gap-1.5 h-9"
            disabled={allIds.length === 0}
            onClick={() => startQueue(allIds, sessionLabel, navigate)}
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
              <TableHead className="w-32 font-bold uppercase tracking-wider text-xs text-center">Status</TableHead>
              <TableHead className="w-48 font-bold uppercase tracking-wider text-xs text-center">Measurements</TableHead>
              <TableHead className="w-40 font-bold uppercase tracking-wider text-xs text-center">Roster</TableHead>
              <TableHead className="w-32 text-right font-bold uppercase tracking-wider text-xs">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <div className="animate-pulse flex flex-col items-center justify-center">
                    <div className="h-8 w-8 rounded-full bg-muted mb-4" />
                    Loading players...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPlayers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
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
                      <button
                        className="text-left hover:underline underline-offset-2 hover:text-primary transition-colors"
                        onClick={() => {
                          const idx = filteredPlayers.findIndex((p) => p.id === player.id);
                          const queueIds = [
                            ...filteredPlayers.slice(idx).map((p) => p.id),
                            ...filteredPlayers.slice(0, idx).map((p) => p.id),
                          ];
                          startQueue(queueIds, sessionLabel, navigate);
                        }}
                      >
                        {player.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`font-semibold border ${
                          onRoster
                            ? "bg-muted text-muted-foreground border-border"
                            : POSITION_COLORS[player.position] || "bg-secondary/10 text-secondary-foreground border-secondary/20"
                        }`}
                      >
                        {player.position}
                      </Badge>
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
                            startQueue(queueIds, sessionLabel, navigate);
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
    </div>
  );
}

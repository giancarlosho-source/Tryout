import { useState } from "react";
import { useListRankings } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, User, Activity } from "lucide-react";

const POSITIONS = [
  { key: "Setter", label: "Setters" },
  { key: "OutsideHitter", label: "Outside Hitters" },
  { key: "MiddleBlocker", label: "Middle Blockers" },
  { key: "Opposite", label: "Opposites" },
  { key: "Libero", label: "Libero / DS" },
];

function ScorePill({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-muted-foreground text-sm">—</span>;
  const color = score >= 8 ? "text-green-700 bg-green-50 border-green-200" : score >= 6 ? "text-yellow-700 bg-yellow-50 border-yellow-200" : "text-red-700 bg-red-50 border-red-200";
  return <span className={`inline-block px-2 py-0.5 rounded border text-sm font-bold tabular-nums ${color}`}>{score.toFixed(1)}</span>;
}

export default function PositionRankings() {
  const [activePosition, setActivePosition] = useState("Setter");

  const { data: players, isLoading } = useListRankings({ position: activePosition, sortBy: "position", sortDir: "desc" });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-none p-6 pb-4 border-b">
        <h1 className="text-3xl font-bold tracking-tight">Rankings by Position</h1>
        <p className="text-muted-foreground text-sm mt-1">Top players ranked within each position group</p>
      </div>

      <div className="flex-none px-6 pt-4 border-b pb-0">
        <Tabs value={activePosition} onValueChange={setActivePosition}>
          <TabsList className="bg-muted/50 p-1">
            {POSITIONS.map((p) => (
              <TabsTrigger key={p.key} value={p.key} className="px-5 py-2 text-sm font-semibold">
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 shadow-sm">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 font-bold uppercase tracking-wider text-xs">Rank</TableHead>
              <TableHead className="w-16 font-bold uppercase tracking-wider text-xs">#</TableHead>
              <TableHead className="font-bold uppercase tracking-wider text-xs">Name</TableHead>
              <TableHead className="w-28 text-center font-bold uppercase tracking-wider text-xs">Overall</TableHead>
              <TableHead className="w-28 text-center font-bold uppercase tracking-wider text-xs">Position</TableHead>
              <TableHead className="w-28 text-center font-bold uppercase tracking-wider text-xs">Potential</TableHead>
              <TableHead className="w-28 text-center font-bold uppercase tracking-wider text-xs">Height</TableHead>
              <TableHead className="w-24 text-center font-bold uppercase tracking-wider text-xs">Vertical</TableHead>
              <TableHead className="w-20 font-bold uppercase tracking-wider text-xs">Status</TableHead>
              <TableHead className="w-24 font-bold uppercase tracking-wider text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}><div className="h-5 bg-muted rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : players?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-16 text-muted-foreground">
                  No {POSITIONS.find((p) => p.key === activePosition)?.label} evaluated yet.
                </TableCell>
              </TableRow>
            ) : (
              players?.map((player, idx) => (
                <TableRow key={player.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <span className={`text-xl font-black tabular-nums ${idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {idx + 1}
                    </span>
                  </TableCell>
                  <TableCell className="font-black text-lg tabular-nums text-primary">{player.jerseyNumber}</TableCell>
                  <TableCell>
                    <div className="font-bold">{player.name}</div>
                    {(player.evaluationCount ?? 0) > 0 && (
                      <div className="text-xs text-muted-foreground">{player.evaluationCount} evals</div>
                    )}
                  </TableCell>
                  <TableCell className="text-center"><ScorePill score={player.overallScore} /></TableCell>
                  <TableCell className="text-center"><ScorePill score={player.positionScore} /></TableCell>
                  <TableCell className="text-center"><ScorePill score={player.potentialScore} /></TableCell>
                  <TableCell className="text-center text-sm font-medium">
                    {player.heightInches
                      ? `${Math.floor(player.heightInches / 12)}'${Math.round(player.heightInches % 12)}"`
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium">
                    {player.verticalJumpInches ? `${player.verticalJumpInches}"` : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {player.rankLocked && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                        <Lock className="h-3 w-3 mr-1" /> Locked
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="default" className="h-8 px-2 font-bold" asChild>
                        <Link href={`/evaluate/${player.id}`}>
                          <Activity className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" asChild>
                        <Link href={`/players/${player.id}`}>
                          <User className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { useSuggestRoster, useCreateRoster, useAddPlayerToRoster, getListRostersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, AlertCircle, User, Lock, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRoster } from "@/contexts/roster-context";

import { positionColor, positionLabel } from "@/lib/positions";

const POSITION_LABELS: Record<string, string> = {
  Setter: "Setter", OutsideHitter: "Outside Hitter",
  MiddleBlocker: "Middle Blocker", Opposite: "Opposite", Libero: "Libero/DS",
  Undecided: "Undecided",
};

const POSITION_ORDER = ["Setter", "OutsideHitter", "MiddleBlocker", "Opposite", "Libero", "Undecided"];

function ScorePill({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const color = score >= 8 ? "text-green-700 bg-green-50 border-green-200" : score >= 6 ? "text-yellow-700 bg-yellow-50 border-yellow-200" : "text-red-700 bg-red-50 border-red-200";
  return <span className={`inline-block px-1.5 py-0.5 rounded border text-xs font-bold tabular-nums ${color}`}>{score.toFixed(1)}</span>;
}

export default function Roster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setRoster } = useRoster();

  const { data: suggestion, isLoading: suggestLoading, isFetching: suggestFetching, refetch: refetchSuggestion } = useSuggestRoster({ query: { enabled: false } });
  const createRoster = useCreateRoster();
  const addPlayer = useAddPlayerToRoster();

  // Sync roster suggestion into global context whenever it changes
  useEffect(() => {
    if (suggestion?.players) {
      setRoster(
        suggestion.players.map((s) => ({
          playerId: s.playerId,
          position: s.position,
          positionLabel: POSITION_LABELS[s.position] || s.position,
        }))
      );
    }
  }, [suggestion, setRoster]);

  const handleSaveRoster = async () => {
    if (!suggestion) return;
    const { data: roster } = await createRoster.mutateAsync({ data: { name: `Roster ${new Date().toLocaleString()}` } });
    for (const slot of suggestion.players) {
      await addPlayer.mutateAsync({ id: roster.id, data: { playerId: slot.playerId, position: slot.position, locked: slot.locked } });
    }
    queryClient.invalidateQueries({ queryKey: getListRostersQueryKey() });
    toast({ title: "Roster saved", description: "Roster has been saved successfully." });
  };

  const grouped = POSITION_ORDER.map((pos) => ({
    position: pos,
    label: POSITION_LABELS[pos],
    slots: suggestion?.players.filter((s) => s.position === pos) ?? [],
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-none p-6 pb-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Roster Builder</h1>
            <p className="text-muted-foreground text-sm mt-1">AI-suggested 12-player roster based on scores</p>
          </div>
          <div className="flex gap-3">
            {suggestion && (
              <Button variant="outline" onClick={() => refetchSuggestion()} disabled={suggestFetching}>
                <RefreshCw className={`h-4 w-4 mr-2 ${suggestFetching ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
            )}
            {suggestion ? (
              <Button
                onClick={handleSaveRoster}
                disabled={createRoster.isPending || addPlayer.isPending}
                className="font-semibold"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {createRoster.isPending || addPlayer.isPending ? "Saving..." : "Save Roster"}
              </Button>
            ) : (
              <Button
                onClick={() => refetchSuggestion()}
                disabled={suggestFetching}
                className="font-semibold"
              >
                <Sparkles className={`h-4 w-4 mr-2 ${suggestFetching ? "animate-spin" : ""}`} />
                {suggestFetching ? "Generating..." : "Generate Suggestion"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {suggestFetching ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 space-y-3">
                  <div className="h-5 bg-muted rounded w-1/2" />
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div key={j} className="h-14 bg-muted rounded" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !suggestion ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-24">
            <div className="rounded-full bg-muted p-5">
              <ClipboardList className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold">No roster generated yet</h2>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                Click <strong>Generate Suggestion</strong> to build a 12-player roster from your current rankings.
              </p>
            </div>
            <Button size="lg" className="font-semibold" onClick={() => refetchSuggestion()}>
              <Sparkles className="h-5 w-5 mr-2" />
              Generate Suggestion
            </Button>
          </div>
        ) : (
          <>
            {suggestion?.missingPositions && suggestion.missingPositions.length > 0 && (
              <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-yellow-800">Missing positions</div>
                  <div className="text-sm text-yellow-700 mt-1">
                    Not enough players at: {[...new Set(suggestion.missingPositions)].map((p) => POSITION_LABELS[p] || p).join(", ")}.
                    Add more players or adjust evaluation scores.
                  </div>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {grouped.map(({ position, label, slots }) => (
                <Card key={position} className={slots.length === 0 ? "border-dashed border-muted-foreground/30" : ""}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center justify-between">
                      <Badge variant="outline" className={`text-xs font-bold ${positionColor(position) || ""}`}>
                        {label}
                      </Badge>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {slots.length} player{slots.length !== 1 ? "s" : ""}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {slots.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground text-sm">
                        <AlertCircle className="h-5 w-5 mx-auto mb-2 text-muted-foreground/50" />
                        No {label} available
                      </div>
                    ) : (
                      slots.map((slot) => (
                        <div
                          key={slot.playerId}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors group"
                        >
                          <span className="text-xl font-black text-primary tabular-nums w-8 shrink-0">
                            #{slot.player?.jerseyNumber}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate">{slot.player?.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {slot.player?.overallScore != null && <ScorePill score={slot.player.overallScore} />}
                              {slot.player?.heightInches && (
                                <span className="text-xs text-muted-foreground">
                                  {Math.floor(slot.player.heightInches / 12)}'{Math.round(slot.player.heightInches % 12)}"
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {slot.locked && <Lock className="h-3.5 w-3.5 text-primary" />}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                              <Link href={`/players/${slot.playerId}`}>
                                <User className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {suggestion?.explanation && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Roster Explanation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{suggestion.explanation}</p>
                </CardContent>
              </Card>
            )}

            {suggestion?.bubblePlayers && suggestion.bubblePlayers.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold">Bubble Players</CardTitle>
                  <p className="text-sm text-muted-foreground">Next-best available — strong candidates if roster spots open up</p>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {suggestion.bubblePlayers.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group">
                        <span className="text-lg font-black text-primary tabular-nums w-8 shrink-0">#{p.jerseyNumber}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{p.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className={`text-xs py-0 ${positionColor(p.position) || ""}`}>
                              {POSITION_LABELS[p.position] || p.position}
                            </Badge>
                            <ScorePill score={p.overallScore} />
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                          <Link href={`/players/${p.id}`}><User className="h-3.5 w-3.5" /></Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetPlayer, useGeneratePlayerSummary, useCreateNote, useDeleteNote,
  useListNotes, getGetPlayerQueryKey, getListNotesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Activity, Sparkles, Trash2, AlertCircle, CheckCircle2, Zap, Star, TrendingUp, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const POSITION_LABELS: Record<string, string> = {
  Setter: "Setter", OutsideHitter: "Outside Hitter",
  MiddleBlocker: "Middle Blocker", Opposite: "Opposite", Libero: "Libero/DS",
};

const FLAG_STYLES: Record<string, { color: string; icon: typeof Zap }> = {
  "High Potential":         { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: TrendingUp },
  "Raw Athlete":            { color: "bg-blue-100 text-blue-700 border-blue-200", icon: Zap },
  "Skilled but Undersized": { color: "bg-orange-100 text-orange-700 border-orange-200", icon: Star },
  "Consistent Performer":   { color: "bg-teal-100 text-teal-700 border-teal-200", icon: CheckCircle2 },
  "Roster Lock Candidate":  { color: "bg-purple-100 text-purple-700 border-purple-200", icon: Shield },
  "Position Change Candidate": { color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle },
  "Needs More Evaluation":  { color: "bg-gray-100 text-gray-600 border-gray-200", icon: AlertCircle },
  "Missing Measurements":   { color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? "bg-green-500" : score >= 6 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-sm font-medium shrink-0">{label}</div>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-10 text-right text-sm font-black tabular-nums">{score.toFixed(1)}</div>
    </div>
  );
}

function ConfidencePip({ score }: { score: number }) {
  const level = score >= 7 ? "High" : score >= 4 ? "Medium" : "Low";
  const color = score >= 7 ? "text-green-700 bg-green-50 border-green-200" : score >= 4 ? "text-yellow-700 bg-yellow-50 border-yellow-200" : "text-red-700 bg-red-50 border-red-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${score >= 7 ? "bg-green-500" : score >= 4 ? "bg-yellow-500" : "bg-red-500"}`} />
      {level} confidence ({score.toFixed(1)}/10)
    </span>
  );
}

export default function PlayerProfile() {
  const [, params] = useRoute("/players/:id");
  const playerId = params?.id ? parseInt(params.id) : null;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: player, isLoading } = useGetPlayer(playerId!, {
    query: { enabled: !!playerId, queryKey: getGetPlayerQueryKey(playerId!) },
  });
  const { data: notes } = useListNotes({ playerId: playerId ?? undefined }, {
    query: { enabled: !!playerId, queryKey: getListNotesQueryKey({ playerId: playerId ?? undefined }) },
  });

  const generateSummary = useGeneratePlayerSummary();
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();

  const [aiSummary, setAiSummary] = useState<{
    summary: string; strengths: string[]; weaknesses: string[];
    risks: string[]; positionFit: string; potentialNote: string; suggestedPositionChange: string | null;
  } | null>(null);
  const [noteText, setNoteText] = useState("");

  const handleGenerateSummary = () => {
    if (!playerId) return;
    generateSummary.mutate(
      { playerId },
      {
        onSuccess: (data) => setAiSummary(data),
        onError: () => toast({ title: "Failed to generate summary", variant: "destructive" }),
      }
    );
  };

  const handleAddNote = () => {
    if (!noteText.trim() || !playerId) return;
    createNote.mutate(
      { data: { playerId, content: noteText.trim() } },
      {
        onSuccess: () => {
          setNoteText("");
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey({ playerId: playerId ?? undefined }) });
        },
        onError: () => toast({ title: "Failed to save note", variant: "destructive" }),
      }
    );
  };

  const handleDeleteNote = (id: number) => {
    deleteNote.mutate(
      { id },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotesQueryKey({ playerId: playerId ?? undefined }) }) }
    );
  };

  if (!playerId) return <div className="p-6 text-muted-foreground">Invalid player.</div>;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!player) return <div className="p-6 text-muted-foreground">Player not found.</div>;

  const universalEvals = player.evaluations?.filter((e) => e.category === "universal") ?? [];
  const positionEvals = player.evaluations?.filter((e) => e.category === "position") ?? [];
  const missingMeasurements = !player.heightInches || !player.standingReachInches || !player.verticalJumpInches;
  const flags = (player.flags as string[] | null) ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-none p-6 pb-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="h-9">
            <Link href="/players"><ChevronLeft className="h-4 w-4 mr-1" /> Players</Link>
          </Button>
          <div className="flex-1 flex items-center gap-4 flex-wrap">
            <span className="text-4xl font-black text-primary tabular-nums">#{player.jerseyNumber}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-tight">{player.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="font-semibold">
                  {POSITION_LABELS[player.position] || player.position}
                </Badge>
                {player.checkedIn ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Checked In
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">Not Here</Badge>
                )}
                {player.confidenceScore != null && (
                  <ConfidencePip score={player.confidenceScore} />
                )}
              </div>
            </div>
            <Button asChild className="shrink-0">
              <Link href={`/evaluate/${player.id}`}>
                <Activity className="h-4 w-4 mr-2" /> Evaluate
              </Link>
            </Button>
          </div>
        </div>

        {flags.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {flags.map((flag) => {
              const style = FLAG_STYLES[flag] ?? { color: "bg-muted text-muted-foreground border-border", icon: AlertCircle };
              const Icon = style.icon;
              return (
                <Badge key={flag} variant="outline" className={`text-xs font-semibold ${style.color}`}>
                  <Icon className="h-3 w-3 mr-1" /> {flag}
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Score cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Overall", value: player.overallScore, desc: "Skill + position + physical" },
            { label: "Position", value: player.positionScore, desc: "Position-specific skills" },
            { label: "Potential", value: player.potentialScore, desc: "Upside & athleticism" },
            { label: "Physical", value: player.physicalScore, desc: "Percentile vs. pool" },
          ].map(({ label, value, desc }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
                <div className="text-3xl font-black tabular-nums leading-none">
                  {value != null ? value.toFixed(1) : <span className="text-muted-foreground text-xl">—</span>}
                  {value != null && <span className="text-sm font-normal text-muted-foreground">/10</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-tight">{desc}</div>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Measurements</div>
              {missingMeasurements ? (
                <div className="text-sm text-red-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="h-4 w-4" /> Missing
                </div>
              ) : (
                <div className="space-y-1 text-sm font-medium mt-1">
                  <div>{Math.floor(player.heightInches! / 12)}'{Math.round(player.heightInches! % 12)}" height</div>
                  <div>{player.standingReachInches}" reach</div>
                  <div>{player.verticalJumpInches}" vert</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Score breakdown explanation */}
        {(player.overallScore != null) && (
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Score Breakdown</div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span>Overall = <strong>Universal (40%)</strong> + <strong>Position (40%)</strong> + <strong>Physical (20%)</strong></span>
                {player.physicalScore != null && (
                  <span className="text-muted-foreground">Physical score is percentile-ranked against all {(player.physicalScore).toFixed(1) >= "5" ? "above-median" : "below-median"} athletes in the pool</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Evaluation bars */}
        <div className="grid lg:grid-cols-2 gap-6">
          {universalEvals.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Universal Skills</CardTitle>
                <p className="text-xs text-muted-foreground">Weighted: IQ, Coachability, Consistency, Passing (15% each) · Serving, Defense, Communication, Competitiveness (10% each)</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {universalEvals.sort((a, b) => b.score - a.score).map((e) => (
                  <ScoreBar key={e.skill} label={e.skill} score={e.score} />
                ))}
              </CardContent>
            </Card>
          )}

          {positionEvals.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {POSITION_LABELS[player.position] || "Position"} Skills
                </CardTitle>
                <p className="text-xs text-muted-foreground">Position-specific weighted score</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {positionEvals.sort((a, b) => b.score - a.score).map((e) => (
                  <ScoreBar key={e.skill} label={e.skill} score={e.score} />
                ))}
              </CardContent>
            </Card>
          )}

          {universalEvals.length === 0 && positionEvals.length === 0 && (
            <Card className="lg:col-span-2">
              <CardContent className="py-12 text-center text-muted-foreground">
                No evaluations yet. <Link href={`/evaluate/${player.id}`} className="text-primary font-semibold underline">Start evaluating</Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* AI Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">AI Player Summary</CardTitle>
              <Button size="sm" variant="outline" onClick={handleGenerateSummary} disabled={generateSummary.isPending} className="font-semibold">
                <Sparkles className={`h-4 w-4 mr-2 ${generateSummary.isPending ? "animate-spin" : ""}`} />
                {generateSummary.isPending ? "Generating..." : aiSummary ? "Regenerate" : "Generate Summary"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!aiSummary && !generateSummary.isPending && (
              <p className="text-muted-foreground text-sm">Click "Generate Summary" for an AI-assisted analysis based on evaluation data.</p>
            )}
            {generateSummary.isPending && (
              <div className="space-y-2 animate-pulse">
                {[80, 60, 90, 50].map((w, i) => <div key={i} className="h-4 bg-muted rounded" style={{ width: `${w}%` }} />)}
              </div>
            )}
            {aiSummary && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed">{aiSummary.summary}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {aiSummary.strengths.length > 0 && (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-green-700 mb-2">Strengths</div>
                      <ul className="space-y-1">
                        {aiSummary.strengths.map((s) => (
                          <li key={s} className="text-sm flex items-start gap-2"><span className="text-green-500 mt-0.5">+</span> {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiSummary.weaknesses.length > 0 && (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-red-700 mb-2">Areas to Develop</div>
                      <ul className="space-y-1">
                        {aiSummary.weaknesses.map((w) => (
                          <li key={w} className="text-sm flex items-start gap-2"><span className="text-red-500 mt-0.5">-</span> {w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {aiSummary.risks.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-yellow-800 mb-2">Risk Flags</div>
                    {aiSummary.risks.map((r) => (
                      <div key={r} className="text-sm text-yellow-800 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {r}
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">Position Fit</div>
                    {aiSummary.positionFit}
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">Potential</div>
                    {aiSummary.potentialNote}
                  </div>
                </div>
                {aiSummary.suggestedPositionChange && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    <strong>Position suggestion:</strong> Consider trying at <strong>{aiSummary.suggestedPositionChange}</strong>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coach Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Coach Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a note about this player..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="resize-none min-h-[80px]"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
              />
              <Button onClick={handleAddNote} disabled={!noteText.trim() || createNote.isPending} className="self-end h-10 px-5 font-semibold shrink-0">
                Save
              </Button>
            </div>
            <div className="space-y-3">
              {(notes ?? player.notes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                (notes ?? player.notes ?? []).map((note) => (
                  <div key={note.id} className="flex items-start gap-3 group p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                    <p className="text-sm flex-1 leading-relaxed">{note.content}</p>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.createdAt).toLocaleDateString()} {new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" onClick={() => handleDeleteNote(note.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

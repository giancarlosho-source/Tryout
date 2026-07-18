import { useState, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetPlayer, useGeneratePlayerSummary, useCreateNote, useDeleteNote,
  useListNotes, useUpdatePlayer, useDeletePlayer, getGetPlayerQueryKey, getListNotesQueryKey, getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Activity, Sparkles, Trash2, AlertCircle, CheckCircle2, Zap, Star, TrendingUp, Shield, Camera, X, Pencil, Save, UserCheck, UserMinus, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { positionLabel, primaryPosition, secondaryPosition, POSITION_LABELS } from "@/lib/positions";

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
  const max = score > 5 ? 10 : 5;
  const pct = (score / max) * 100;
  const pctNorm = pct;
  const color = pctNorm >= 80 ? "bg-green-500" : pctNorm >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-sm font-medium shrink-0">{label}</div>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-14 text-right text-sm font-black tabular-nums">{score.toFixed(1)}/{max}</div>
    </div>
  );
}

const COACH_COLORS = ["bg-blue-100 text-blue-700 border-blue-200", "bg-violet-100 text-violet-700 border-violet-200", "bg-emerald-100 text-emerald-700 border-emerald-200", "bg-orange-100 text-orange-700 border-orange-200", "bg-pink-100 text-pink-700 border-pink-200"];

function CoachBreakdown({
  evaluations, playerId, apiBase, onDeleted,
}: {
  evaluations: { id: number; skill: string; score: number; coachName?: string | null; category: string }[];
  playerId: number;
  apiBase: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deletingCoach, setDeletingCoach] = useState<string | null>(null);
  // undefined = no confirm open; null = confirm for unassigned evaluations; string = confirm for named coach
  const [confirmCoach, setConfirmCoach] = useState<string | null | undefined>(undefined);
  const { toast } = useToast();

  const coaches = Array.from(new Set(evaluations.map((e) => e.coachName ?? null)));

  const handleDeleteCoach = async (coachName: string | null) => {
    setDeletingCoach(coachName ?? "__null__");
    try {
      const nameParam = coachName === null ? "__null__" : encodeURIComponent(coachName);
      const res = await fetch(`${apiBase}/api/evaluations/coach/${playerId}/${nameParam}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Server error");
      toast({ title: `Scores from ${coachName} removed` });
      onDeleted();
    } catch {
      toast({ title: "Failed to remove scores", variant: "destructive" });
    } finally {
      setDeletingCoach(null);
      setConfirmCoach(undefined);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold">Coach Evaluations</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {coaches.length} coach{coaches.length !== 1 ? "es" : ""} · scores averaged per skill
            </p>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-5">
          {coaches.map((coach, ci) => {
            const displayName = coach ?? "Unassigned";
            const coachKey = coach ?? "__null__";
            const coachEvals = evaluations.filter((e) => (e.coachName ?? null) === coach);
            const colorClass = COACH_COLORS[ci % COACH_COLORS.length];
            return (
              <div key={coachKey} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`font-semibold ${colorClass}`}>{displayName}</Badge>
                  {confirmCoach !== undefined && confirmCoach === coach ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Remove all scores from {displayName}?</span>
                      <button
                        onClick={() => handleDeleteCoach(coach)}
                        disabled={deletingCoach === coachKey}
                        className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
                      >
                        {deletingCoach === coachKey ? "Removing…" : "Confirm"}
                      </button>
                      <button onClick={() => setConfirmCoach(undefined)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmCoach(coach)}
                      className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pl-1">
                  {coachEvals.sort((a, b) => a.skill.localeCompare(b.skill)).map((e) => (
                    <div key={e.id} className="flex items-center gap-2">
                      <div className="flex-1 text-xs text-muted-foreground truncate">{e.skill}</div>
                      <div className={`text-sm font-black tabular-nums w-6 text-right ${e.score >= 4 ? "text-green-600" : e.score >= 3 ? "text-yellow-600" : "text-red-500"}`}>
                        {e.score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

function ConfidencePip({ score }: { score: number }) {
  const level = score >= 4 ? "High" : score >= 2.5 ? "Medium" : "Low";
  const color = score >= 4 ? "text-green-700 bg-green-50 border-green-200" : score >= 2.5 ? "text-yellow-700 bg-yellow-50 border-yellow-200" : "text-red-700 bg-red-50 border-red-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${score >= 4 ? "bg-green-500" : score >= 2.5 ? "bg-yellow-500" : "bg-red-500"}`} />
      {level} confidence ({score.toFixed(1)}/5)
    </span>
  );
}

export default function PlayerProfile() {
  const [, params] = useRoute("/players/:id");
  const [, navigate] = useLocation();
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
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectivePhotoUrl = photoUrl !== undefined ? photoUrl : (player as any)?.photoUrl ?? null;
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

  const handlePhotoUpload = async (file: File) => {
    if (!playerId) return;
    setPhotoUploading(true);
    const form = new FormData();
    form.append("photo", file);
    const token = localStorage.getItem("tryoutdesk_token") ?? "";
    try {
      const res = await fetch(`${apiBase}/api/players/${playerId}/photo`, {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPhotoUrl(json.photoUrl);
      queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(playerId) });
      toast({ title: "Photo saved" });
    } catch {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  };

  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeletePlayer = async () => {
    if (!playerId) return;
    await deletePlayer.mutateAsync({ id: playerId });
    queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey({}) });
    navigate("/players");
    toast({ title: "Player deleted" });
  };

  const [editingInfo, setEditingInfo] = useState(false);
  const [eName, setEName] = useState("");
  const [eJersey, setEJersey] = useState("");
  const [ePosition, setEPosition] = useState("");
  const [eAge, setEAge] = useState("");

  const startEditInfo = () => {
    setEName(player?.name ?? "");
    setEJersey(player?.jerseyNumber ?? "");
    setEPosition(player?.position ?? "");
    setEAge(player?.age ?? "");
    setEditingInfo(true);
  };

  const saveInfo = async () => {
    if (!playerId) return;
    await updatePlayer.mutateAsync({
      id: playerId,
      data: { name: eName, jerseyNumber: eJersey, position: ePosition || undefined, age: eAge || undefined },
    });
    queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(playerId) });
    setEditingInfo(false);
    toast({ title: "Player updated" });
  };

  const toggleCheckIn = async () => {
    if (!playerId) return;
    await updatePlayer.mutateAsync({ id: playerId, data: { checkedIn: !player?.checkedIn } });
    queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(playerId) });
    toast({ title: player?.checkedIn ? "Check-in cleared" : "Checked in!" });
  };

  const [editingMeasurements, setEditingMeasurements] = useState(false);
  const [mHeight, setMHeight] = useState("");
  const [mReach, setMReach] = useState("");
  const [mVert, setMVert] = useState("");

  const startEditMeasurements = () => {
    setMHeight(player?.heightInches?.toString() ?? "");
    setMReach(player?.standingReachInches?.toString() ?? "");
    setMVert(player?.verticalJumpInches?.toString() ?? "");
    setEditingMeasurements(true);
  };

  const saveMeasurements = async () => {
    if (!playerId) return;
    await updatePlayer.mutateAsync({
      id: playerId,
      data: {
        heightInches: mHeight ? parseFloat(mHeight) : null,
        standingReachInches: mReach ? parseFloat(mReach) : null,
        verticalJumpInches: mVert ? parseFloat(mVert) : null,
      },
    });
    queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(playerId) });
    setEditingMeasurements(false);
    toast({ title: "Measurements saved" });
  };

  const handlePhotoDelete = async () => {
    if (!playerId) return;
    const token = localStorage.getItem("tryoutdesk_token") ?? "";
    await fetch(`${apiBase}/api/players/${playerId}/photo`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setPhotoUrl(null);
    queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(playerId) });
    toast({ title: "Photo removed" });
  };

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

  // Canonical skill name (normalise legacy "Hands" → "Setting")
  function canonicalSkill(skill: string) { return skill === "Hands" ? "Setting" : skill; }

  // Valid skills per position (must match scoring.ts POSITION_SKILL_LIST)
  const POSITION_SKILLS: Record<string, string[]> = {
    Setter:        ["Setting", "Location", "Decision-making", "Tempo", "Leadership"],
    OutsideHitter: ["Serve receive", "Attacking", "Defense", "Transition", "All-around value"],
    MiddleBlocker: ["Blocking", "Lateral movement", "Quick attack", "Footwork", "Court awareness"],
    Opposite:      ["Attacking", "Blocking", "Serving", "Back-row value", "Physical upside"],
    Libero:        ["Passing", "Defense", "Reading hitters", "Serve receive", "Communication"],
  };
  const playerPrimaryPosition = player.position?.split("/")[0] ?? "";
  const validPositionSkills = new Set(POSITION_SKILLS[playerPrimaryPosition] ?? []);

  // Average scores across all coaches for each skill
  function avgBySkill(evals: typeof player.evaluations) {
    const map = new Map<string, number[]>();
    for (const e of evals ?? []) {
      const key = canonicalSkill(e.skill);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e.score);
    }
    return Array.from(map.entries()).map(([skill, scores]) => ({
      skill,
      score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      category: (evals ?? []).find((e) => canonicalSkill(e.skill) === skill)?.category ?? "",
    }));
  }

  const universalEvals = avgBySkill((player.evaluations ?? []).filter((e) => e.category === "universal"));
  // Only show position skills that belong to the player's actual position
  const positionEvals = avgBySkill(
    (player.evaluations ?? []).filter((e) => e.category === "position" && validPositionSkills.has(canonicalSkill(e.skill)))
  );
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
            {/* Player photo */}
          <div className="relative group shrink-0">
            <div
              className="w-20 h-20 rounded-full overflow-hidden border-2 border-muted bg-muted flex items-center justify-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {effectivePhotoUrl ? (
                <img
                  src={effectivePhotoUrl.startsWith("data:") ? effectivePhotoUrl : `${apiBase}${effectivePhotoUrl}`}
                  alt={player.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Camera className="h-7 w-7 text-muted-foreground/40" />
              )}
              {photoUploading && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </div>
            {effectivePhotoUrl && (
              <button
                onClick={handlePhotoDelete}
                className="absolute -top-1 -right-1 bg-white border border-border rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
            />
          </div>

          {editingInfo ? (
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Jersey #</label>
                  <input value={eJersey} onChange={(e) => setEJersey(e.target.value)}
                    className="w-full border-2 rounded-lg px-3 py-2 text-xl font-black tabular-nums mt-0.5 focus:border-primary outline-none" placeholder="#" />
                </div>
                <div className="flex-3 flex-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Name</label>
                  <input value={eName} onChange={(e) => setEName(e.target.value)}
                    className="w-full border-2 rounded-lg px-3 py-2 text-base font-bold mt-0.5 focus:border-primary outline-none" placeholder="Full name" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Position</label>
                  <select value={ePosition} onChange={(e) => setEPosition(e.target.value)}
                    className="w-full border-2 rounded-lg px-3 py-2 text-sm font-semibold mt-0.5 focus:border-primary outline-none bg-white">
                    <option value="">—</option>
                    {Object.entries(POSITION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Age Group</label>
                  <input value={eAge} onChange={(e) => setEAge(e.target.value)}
                    className="w-full border-2 rounded-lg px-3 py-2 text-sm font-semibold mt-0.5 focus:border-primary outline-none" placeholder="e.g. 16U" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={saveInfo} disabled={updatePlayer.isPending} size="sm" className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditingInfo(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <span className="text-4xl font-black text-primary tabular-nums">#{player.jerseyNumber}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold leading-tight">{player.name}</h1>
                  <button onClick={startEditInfo} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="font-semibold">
                    {POSITION_LABELS[primaryPosition(player.position)] || primaryPosition(player.position)}
                  </Badge>
                  {secondaryPosition(player.position) && (
                    <Badge variant="outline" className="text-muted-foreground font-medium">
                      +{POSITION_LABELS[secondaryPosition(player.position)!] || secondaryPosition(player.position)}
                    </Badge>
                  )}
                  {player.age && (
                    <Badge variant="outline" className="text-muted-foreground font-medium">
                      {player.age}
                    </Badge>
                  )}
                  <button onClick={toggleCheckIn} className="shrink-0">
                    {player.checkedIn ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 cursor-pointer hover:bg-green-100">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Checked In
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground cursor-pointer hover:bg-muted">
                        <UserCheck className="h-3 w-3 mr-1" /> Check In
                      </Badge>
                    )}
                  </button>
                  {player.confidenceScore != null && (
                    <ConfidencePip score={player.confidenceScore} />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button asChild>
                  <Link href={`/evaluate/${player.id}`}>
                    <Activity className="h-4 w-4 mr-2" /> Evaluate
                  </Link>
                </Button>
                {confirmDelete ? (
                  <>
                    <Button variant="destructive" size="sm" onClick={handleDeletePlayer} disabled={deletePlayer.isPending} className="font-bold">
                      {deletePlayer.isPending ? "Deleting…" : "Confirm Delete"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60">
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}
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
          <Card className={missingMeasurements && !editingMeasurements ? "border-red-200 bg-red-50/50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Measurements</div>
                {!editingMeasurements && (
                  <button onClick={startEditMeasurements} className="text-muted-foreground hover:text-primary transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {editingMeasurements ? (
                <div className="space-y-2 mt-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Height (in)</label>
                    <input
                      type="number"
                      value={mHeight}
                      onChange={(e) => setMHeight(e.target.value)}
                      placeholder="e.g. 72"
                      className="w-full border rounded px-2 py-1 text-sm mt-0.5"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Standing Reach (in)</label>
                    <input
                      type="number"
                      value={mReach}
                      onChange={(e) => setMReach(e.target.value)}
                      placeholder="e.g. 90"
                      className="w-full border rounded px-2 py-1 text-sm mt-0.5"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Vertical Jump (in)</label>
                    <input
                      type="number"
                      value={mVert}
                      onChange={(e) => setMVert(e.target.value)}
                      placeholder="e.g. 24"
                      className="w-full border rounded px-2 py-1 text-sm mt-0.5"
                      step="0.5"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveMeasurements}
                      disabled={updatePlayer.isPending}
                      className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground text-xs font-bold py-1.5 rounded hover:opacity-90 disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" /> Save
                    </button>
                    <button
                      onClick={() => setEditingMeasurements(false)}
                      className="flex-1 text-xs font-semibold py-1.5 rounded border hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : missingMeasurements ? (
                <button onClick={startEditMeasurements} className="text-sm text-red-600 font-semibold flex items-center gap-1 mt-1 hover:underline">
                  <AlertCircle className="h-4 w-4" /> Tap to enter
                </button>
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
                <span>Overall = <strong>Universal (50%)</strong> + <strong>Position (50%)</strong></span>
                {player.physicalScore != null && (
                  <span className="text-muted-foreground">Physical score is shown separately — percentile-ranked vs. the pool</span>
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
                  {POSITION_LABELS[primaryPosition(player.position)] || "Position"} Skills
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

        {/* Coach Breakdown */}
        {(player.evaluations?.length ?? 0) > 0 && (
          <CoachBreakdown
            evaluations={player.evaluations!}
            playerId={player.id}
            apiBase={apiBase}
            onDeleted={() => queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(player.id) })}
          />
        )}

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

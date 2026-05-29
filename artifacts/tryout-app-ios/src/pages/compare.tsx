import { useState } from "react";
import { useListPlayers, useGetPlayer } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CheckCircle2, AlertCircle, TrendingUp, Zap, Star, Shield, ArrowLeftRight, RefreshCw, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useRoster } from "@/contexts/roster-context";

const POSITION_COLORS: Record<string, string> = {
  Setter: "bg-purple-100 text-purple-700 border-purple-200",
  OutsideHitter: "bg-blue-100 text-blue-700 border-blue-200",
  MiddleBlocker: "bg-green-100 text-green-700 border-green-200",
  Opposite: "bg-orange-100 text-orange-700 border-orange-200",
  Libero: "bg-pink-100 text-pink-700 border-pink-200",
};

const FLAG_STYLES: Record<string, { color: string; icon: typeof Zap }> = {
  "High Potential":            { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: TrendingUp },
  "Raw Athlete":               { color: "bg-blue-100 text-blue-700 border-blue-200", icon: Zap },
  "Skilled but Undersized":    { color: "bg-orange-100 text-orange-700 border-orange-200", icon: Star },
  "Consistent Performer":      { color: "bg-teal-100 text-teal-700 border-teal-200", icon: CheckCircle2 },
  "Roster Lock Candidate":     { color: "bg-purple-100 text-purple-700 border-purple-200", icon: Shield },
  "Position Change Candidate": { color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle },
  "Needs More Evaluation":     { color: "bg-gray-100 text-gray-600 border-gray-200", icon: AlertCircle },
  "Missing Measurements":      { color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
};

type PlayerData = NonNullable<ReturnType<typeof useGetPlayer>["data"]>;

function ScoreCell({
  value,
  otherValue,
  suffix = "/10",
  format,
}: {
  value: number | null | undefined;
  otherValue: number | null | undefined;
  suffix?: string;
  format?: (v: number) => string;
}) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const display = format ? format(value) : value.toFixed(1);
  const better =
    otherValue != null && value > otherValue
      ? "text-green-700 font-black"
      : otherValue != null && value < otherValue
        ? "text-red-600"
        : "";
  return (
    <span className={`text-2xl font-black tabular-nums ${better}`}>
      {display}
      {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
    </span>
  );
}

function SkillBar({ label, score, otherScore }: { label: string; score: number; otherScore?: number }) {
  const pct = (score / 10) * 100;
  const better = otherScore != null ? score >= otherScore : true;
  const color = better ? "bg-primary" : "bg-muted-foreground/50";
  return (
    <div className="flex items-center gap-2">
      <div className="w-32 text-xs font-medium shrink-0 truncate">{label}</div>
      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 text-right text-xs font-black tabular-nums">{score.toFixed(1)}</div>
    </div>
  );
}

function PlayerSearchSelect({
  players,
  value,
  onChange,
  excludeId,
  placeholder,
}: {
  players: { id: number; name: string; jerseyNumber: string | null; position: string }[];
  value: string;
  onChange: (id: string) => void;
  excludeId: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = players.find((p) => String(p.id) === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="flex-1 h-10 font-semibold justify-between overflow-hidden">
          <span className="truncate">
            {selected
              ? <><span className="text-primary font-black">#{selected.jerseyNumber}</span> {selected.name}</>
              : <span className="text-muted-foreground font-normal">{placeholder}</span>
            }
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72" align="start">
        <Command>
          <CommandInput placeholder="Search by name or #number..." />
          <CommandList>
            <CommandEmpty>No players found.</CommandEmpty>
            <CommandGroup>
              {players
                .filter((p) => String(p.id) !== excludeId)
                .map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.name} #${p.jerseyNumber} ${p.jerseyNumber}`}
                    onSelect={() => { onChange(String(p.id)); setOpen(false); }}
                  >
                    <span className="font-black text-primary mr-2">#{p.jerseyNumber}</span>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {p.position.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PlayerColumn({
  player,
  otherPlayer,
  allPlayers,
  onSwap,
}: {
  player: PlayerData;
  otherPlayer: PlayerData | null;
  allPlayers: { id: number; name: string; jerseyNumber: string | null; position: string }[];
  onSwap: (newId: string) => void;
}) {
  const [swapOpen, setSwapOpen] = useState(false);
  const { isOnRoster, getRosterSlot } = useRoster();
  const onRoster = isOnRoster(player.id);
  const slot = getRosterSlot(player.id);
  const flags = (player.flags as string[] | null) ?? [];
  const missingMeasurements = !player.heightInches || !player.standingReachInches || !player.verticalJumpInches;

  const universalEvals = player.evaluations?.filter((e) => e.category === "universal") ?? [];
  const positionEvals = player.evaluations?.filter((e) => e.category === "position") ?? [];

  const otherUniversal = otherPlayer?.evaluations?.filter((e) => e.category === "universal") ?? [];
  const otherPosition = otherPlayer?.evaluations?.filter((e) => e.category === "position") ?? [];

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* Header */}
      <div className="text-center space-y-2 p-4 rounded-xl border bg-muted/20">
        <div className="text-5xl font-black text-primary tabular-nums">#{player.jerseyNumber}</div>
        <div className="text-xl font-bold">{player.name}</div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge variant="outline" className={`font-semibold border ${POSITION_COLORS[player.position] ?? ""}`}>
            {player.position.replace(/([A-Z])/g, " $1").trim()}
          </Badge>
          {player.checkedIn ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Checked In
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-xs">Not Here</Badge>
          )}
        </div>
        {onRoster && slot && (
          <Badge className="bg-primary/15 text-primary border-primary/30 font-semibold text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" /> {slot.positionLabel}
          </Badge>
        )}
        {flags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 pt-1">
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
        <div className="flex items-center justify-center gap-2 mt-1">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/players/${player.id}`}>View Profile</Link>
          </Button>
          <Popover open={swapOpen} onOpenChange={setSwapOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="secondary" className="font-semibold">
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Swap
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-64" align="center">
              <Command>
                <CommandInput placeholder="Search player..." />
                <CommandList>
                  <CommandEmpty>No players found.</CommandEmpty>
                  <CommandGroup>
                    {allPlayers
                      .filter((p) => p.id !== player.id && p.id !== otherPlayer?.id)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.name} #${p.jerseyNumber} ${p.jerseyNumber}`}
                          onSelect={() => {
                            onSwap(String(p.id));
                            setSwapOpen(false);
                          }}
                        >
                          <span className="font-black text-primary mr-2">#{p.jerseyNumber}</span>
                          <span className="font-medium">{p.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {p.position.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Scores */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scores</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {[
            { label: "Overall", value: player.overallScore, other: otherPlayer?.overallScore },
            { label: "Position", value: player.positionScore, other: otherPlayer?.positionScore },
            { label: "Potential", value: player.potentialScore, other: otherPlayer?.potentialScore },
            { label: "Physical", value: player.physicalScore, other: otherPlayer?.physicalScore },
          ].map(({ label, value, other }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">{label}</span>
              <ScoreCell value={value} otherValue={other} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Measurements */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Measurements</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {missingMeasurements ? (
            <div className="text-sm text-red-600 font-semibold flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> Missing measurements
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Height</span>
                <ScoreCell
                  value={player.heightInches}
                  otherValue={otherPlayer?.heightInches ?? null}
                  suffix='"'
                  format={(v) => `${Math.floor(v / 12)}'${Math.round(v % 12)}`}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reach</span>
                <ScoreCell value={player.standingReachInches} otherValue={otherPlayer?.standingReachInches ?? null} suffix='"' format={(v) => v.toString()} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vertical</span>
                <ScoreCell value={player.verticalJumpInches} otherValue={otherPlayer?.verticalJumpInches ?? null} suffix='"' format={(v) => v.toString()} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Universal Skills */}
      {universalEvals.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Universal Skills</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {universalEvals.sort((a, b) => b.score - a.score).map((e) => {
              const otherSkill = otherUniversal.find((o) => o.skill === e.skill);
              return <SkillBar key={e.skill} label={e.skill} score={e.score} otherScore={otherSkill?.score} />;
            })}
          </CardContent>
        </Card>
      )}

      {/* Position Skills */}
      {positionEvals.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {player.position.replace(/([A-Z])/g, " $1").trim()} Skills
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {positionEvals.sort((a, b) => b.score - a.score).map((e) => {
              const otherSkill = otherPosition.find((o) => o.skill === e.skill);
              return <SkillBar key={e.skill} label={e.skill} score={e.score} otherScore={otherSkill?.score} />;
            })}
          </CardContent>
        </Card>
      )}

      {universalEvals.length === 0 && positionEvals.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No evaluations yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const POSITIONS = ["OutsideHitter", "MiddleBlocker", "Opposite", "Setter", "Libero"];

const POSITION_COLORS2: Record<string, string> = {
  Setter: "border-purple-200 bg-purple-50 text-purple-700",
  OutsideHitter: "border-blue-200 bg-blue-50 text-blue-700",
  MiddleBlocker: "border-green-200 bg-green-50 text-green-700",
  Opposite: "border-orange-200 bg-orange-50 text-orange-700",
  Libero: "border-pink-200 bg-pink-50 text-pink-700",
};

export default function Compare() {
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [suggestionPosition, setSuggestionPosition] = useState<string>("OutsideHitter");

  const { data: players } = useListPlayers({});

  const { data: leftPlayer } = useGetPlayer(parseInt(leftId), {
    query: { enabled: !!leftId },
  });
  const { data: rightPlayer } = useGetPlayer(parseInt(rightId), {
    query: { enabled: !!rightId },
  });

  const sortedPlayers = [...(players ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  const suggestions = [...(players ?? [])]
    .filter((p) => p.position === suggestionPosition && p.overallScore != null)
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
    .slice(0, 5);

  const handleSwap = () => {
    const tmp = leftId;
    setLeftId(rightId);
    setRightId(tmp);
  };

  const loadSuggestion = (id: number) => {
    const sid = String(id);
    if (!leftId) { setLeftId(sid); return; }
    if (!rightId) { setRightId(sid); return; }
    // both slots filled — replace the one that isn't the other
    setRightId(sid);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-none p-6 pb-4 border-b space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Compare Players</h1>

        {/* Suggestions panel */}
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Suggested by Position</span>
            <span className="text-xs text-muted-foreground">Tap a player to load into a slot</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => setSuggestionPosition(pos)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                  suggestionPosition === pos
                    ? POSITION_COLORS2[pos]
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {pos.replace(/([A-Z])/g, " $1").trim()}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {suggestions.length === 0 ? (
              <span className="text-xs text-muted-foreground">No evaluated players for this position.</span>
            ) : (
              suggestions.map((p, i) => {
                const isLeft = String(p.id) === leftId;
                const isRight = String(p.id) === rightId;
                const loaded = isLeft || isRight;
                return (
                  <button
                    key={p.id}
                    onClick={() => !loaded && loadSuggestion(p.id)}
                    disabled={loaded}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      loaded
                        ? "bg-primary/10 border-primary/30 text-primary cursor-default"
                        : "bg-background border-border hover:bg-muted hover:border-primary/40 cursor-pointer"
                    }`}
                  >
                    <span className="text-xs font-black text-muted-foreground w-4 text-center">{i + 1}</span>
                    <span className="font-black text-primary">#{p.jerseyNumber}</span>
                    <span>{p.name}</span>
                    {p.overallScore != null && (
                      <span className="ml-1 text-xs font-bold text-muted-foreground">{p.overallScore.toFixed(1)}</span>
                    )}
                    {loaded && (
                      <span className="text-xs font-bold text-primary ml-1">
                        {isLeft ? "← A" : "B →"}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Player selectors */}
        <div className="flex items-center gap-3">
          <PlayerSearchSelect
            players={sortedPlayers}
            value={leftId}
            onChange={setLeftId}
            excludeId={rightId}
            placeholder="Select player A..."
          />

          <Button variant="outline" size="icon" onClick={handleSwap} title="Swap players" className="shrink-0">
            <ArrowLeftRight className="h-4 w-4" />
          </Button>

          <PlayerSearchSelect
            players={sortedPlayers}
            value={rightId}
            onChange={setRightId}
            excludeId={leftId}
            placeholder="Select player B..."
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {!leftId && !rightId ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3">
            <ArrowLeftRight className="h-12 w-12 opacity-20" />
            <p className="text-lg font-semibold">Select two players to compare</p>
            <p className="text-sm">Scores shown in <span className="text-green-700 font-semibold">green</span> are the higher value between both players.</p>
          </div>
        ) : (
          <div className="flex gap-6 items-start">
            {leftPlayer ? (
              <PlayerColumn
                player={leftPlayer}
                otherPlayer={rightPlayer ?? null}
                allPlayers={sortedPlayers}
                onSwap={setLeftId}
              />
            ) : leftId ? (
              <div className="flex-1 flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
            ) : (
              <div className="flex-1 rounded-xl border border-dashed p-12 text-center text-muted-foreground text-sm">Select player A</div>
            )}

            <div className="flex-none w-px bg-border self-stretch" />

            {rightPlayer ? (
              <PlayerColumn
                player={rightPlayer}
                otherPlayer={leftPlayer ?? null}
                allPlayers={sortedPlayers}
                onSwap={setRightId}
              />
            ) : rightId ? (
              <div className="flex-1 flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
            ) : (
              <div className="flex-1 rounded-xl border border-dashed p-12 text-center text-muted-foreground text-sm">Select player B</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

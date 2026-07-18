import { useState } from "react";
import { useListPlayers, useUpdatePlayer, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StationShell } from "@/components/station-shell";
import { Input } from "@/components/ui/input";
import { Search, Ruler, CheckCircle2, X, AlertCircle } from "lucide-react";
import { positionLabel } from "@/lib/positions";
import { useActiveSession } from "@/hooks/use-active-session";

export default function MeasurementsStation() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [height, setHeight] = useState("");
  const [reach, setReach] = useState("");
  const [vert, setVert] = useState("");
  const [saved, setSaved] = useState(false);
  const { sessionAge } = useActiveSession();
  const queryClient = useQueryClient();
  const updatePlayer = useUpdatePlayer();

  const { data: allPlayers } = useListPlayers({});

  const players = sessionAge
    ? (allPlayers ?? []).filter((p) => (p.age ?? "").replace(/U$/i, "") === sessionAge)
    : (allPlayers ?? []);

  const filtered = search.trim().length > 0
    ? players.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.jerseyNumber ?? "").includes(search)
      )
    : [];

  const selected = (allPlayers ?? []).find((p) => p.id === selectedId);
  const missingMeasurements = selected && (!selected.heightInches || !selected.standingReachInches || !selected.verticalJumpInches);

  const selectPlayer = (id: number) => {
    const p = (allPlayers ?? []).find((pl) => pl.id === id);
    setSelectedId(id);
    setSearch("");
    setSaved(false);
    setHeight(p?.heightInches?.toString() ?? "");
    setReach(p?.standingReachInches?.toString() ?? "");
    setVert(p?.verticalJumpInches?.toString() ?? "");
  };

  const handleSave = async () => {
    if (!selectedId) return;
    await updatePlayer.mutateAsync({
      id: selectedId,
      data: {
        heightInches: height ? parseFloat(height) : null,
        standingReachInches: reach ? parseFloat(reach) : null,
        verticalJumpInches: vert ? parseFloat(vert) : null,
      },
    });
    queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey({}) });
    setSaved(true);
    setTimeout(() => { setSelectedId(null); setSaved(false); }, 2500);
  };

  return (
    <StationShell title="Measurements" color="bg-orange-600">
      <div className="max-w-lg mx-auto p-6 space-y-6">
        {!selectedId ? (
          <>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search by name or jersey number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-14 text-lg rounded-xl border-2 shadow-sm"
              />
            </div>

            {filtered.length > 0 && (
              <div className="space-y-2">
                {filtered.map((p) => {
                  const missing = !p.heightInches || !p.standingReachInches || !p.verticalJumpInches;
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectPlayer(p.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 bg-white shadow-sm hover:border-orange-400 transition-all text-left
                        ${missing ? "border-red-200" : "border-gray-200"}`}
                    >
                      <div className="text-3xl font-black text-orange-700 w-12 text-center tabular-nums">
                        #{p.jerseyNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-lg leading-tight truncate">{p.name}</div>
                        <div className="text-sm text-muted-foreground">{positionLabel(p.position ?? "")}</div>
                      </div>
                      {missing ? (
                        <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                      ) : (
                        <div className="text-xs text-right text-muted-foreground shrink-0">
                          <div>{Math.floor(p.heightInches! / 12)}'{Math.round(p.heightInches! % 12)}"</div>
                          <div>{p.standingReachInches}" reach</div>
                          <div>{p.verticalJumpInches}" vert</div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {search.trim().length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Ruler className="h-12 w-12 mx-auto mb-3 opacity-15" />
                <p className="font-semibold text-lg">Ready for measurements</p>
                <p className="text-sm mt-1">Search for a player to enter their measurements</p>
              </div>
            )}
          </>
        ) : saved ? (
          <div className="flex flex-col items-center gap-3 py-12 text-green-600">
            <CheckCircle2 className="h-14 w-14" />
            <p className="font-bold text-2xl">Measurements saved!</p>
            <p className="text-muted-foreground text-sm">Returning to search…</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-orange-200 shadow-sm">
              <div className="text-3xl font-black text-orange-700 w-12 text-center tabular-nums">
                #{selected?.jerseyNumber}
              </div>
              <div className="flex-1">
                <div className="font-bold text-xl">{selected?.name}</div>
                {missingMeasurements && (
                  <div className="text-sm text-red-500 font-semibold flex items-center gap-1 mt-0.5">
                    <AlertCircle className="h-3.5 w-3.5" /> Missing measurements
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-white rounded-xl border-2 border-orange-100 shadow-sm p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Height <span className="font-normal text-muted-foreground">(inches — e.g. 72 for 6'0")</span>
                </label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="e.g. 72"
                  step="0.5"
                  inputMode="decimal"
                  className="w-full border-2 border-gray-200 focus:border-orange-400 rounded-xl px-4 py-3 text-2xl font-bold outline-none transition-colors"
                />
                {height && (
                  <p className="text-sm text-muted-foreground mt-1">
                    = {Math.floor(parseFloat(height) / 12)}'{Math.round(parseFloat(height) % 12)}"
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Standing Reach <span className="font-normal text-muted-foreground">(inches)</span>
                </label>
                <input
                  type="number"
                  value={reach}
                  onChange={(e) => setReach(e.target.value)}
                  placeholder="e.g. 90"
                  step="0.5"
                  inputMode="decimal"
                  className="w-full border-2 border-gray-200 focus:border-orange-400 rounded-xl px-4 py-3 text-2xl font-bold outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Vertical Jump <span className="font-normal text-muted-foreground">(inches)</span>
                </label>
                <input
                  type="number"
                  value={vert}
                  onChange={(e) => setVert(e.target.value)}
                  placeholder="e.g. 24"
                  step="0.5"
                  inputMode="decimal"
                  className="w-full border-2 border-gray-200 focus:border-orange-400 rounded-xl px-4 py-3 text-2xl font-bold outline-none transition-colors"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={updatePlayer.isPending || (!height && !reach && !vert)}
              className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl text-lg transition-colors disabled:opacity-40 shadow-md"
            >
              <CheckCircle2 className="h-5 w-5" />
              {updatePlayer.isPending ? "Saving…" : "Save Measurements"}
            </button>
          </div>
        )}
      </div>
    </StationShell>
  );
}

import { useState } from "react";
import { useListPlayers, useUpdatePlayer, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StationShell } from "@/components/station-shell";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle2, UserCheck, Calendar } from "lucide-react";
import { positionLabel } from "@/lib/positions";
import { useActiveSession } from "@/hooks/use-active-session";
import { HelpButton } from "@/components/help-modal";

const HELP = {
  title: "Check-In Station",
  description: "Use this station to mark players as arrived when they enter the tryout venue.",
  steps: [
    { step: 1, text: "Type the player's name or jersey number in the search box." },
    { step: 2, text: "Find the player in the list below and tap Check In." },
    { step: 3, text: "The button turns green with a checkmark — done. Search for the next player." },
  ],
  tips: [
    "Players already checked in show a green badge — tapping Check In again is safe, it won't duplicate.",
    "If a player isn't showing up, make sure they were added in the admin console and that the active session is set.",
    "Search by jersey number for the fastest lookup at a busy door.",
  ],
};

export default function CheckInStation() {
  const [search, setSearch] = useState("");
  const [savedId, setSavedId] = useState<number | null>(null);
  const { session, sessionAge } = useActiveSession();
  const queryClient = useQueryClient();
  const updatePlayer = useUpdatePlayer();

  const { data: players } = useListPlayers({});

  const sessionPlayers = sessionAge
    ? (players ?? []).filter((p) => (p.age ?? "") === sessionAge)
    : (players ?? []);

  const filtered = search.trim().length > 0
    ? sessionPlayers.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.jerseyNumber ?? "").includes(search)
      )
    : [];

  const handleCheckIn = async (id: number) => {
    await updatePlayer.mutateAsync({ id, data: { checkedIn: true } });
    queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey({}) });
    setSavedId(id);
    setSearch("");
    setTimeout(() => setSavedId(null), 2500);
  };

  const formatDate = (iso: string) => {
    if (!iso) return "";
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  };

  return (
    <StationShell title="Check-In" color="bg-green-600" actions={<HelpButton {...HELP} />}>
      {/* Active session banner */}
      {session?.event ? (
        <div className="bg-green-700 text-white px-6 py-3 flex items-center gap-3 border-b border-green-600">
          <Calendar className="h-5 w-5 opacity-80 shrink-0" />
          <div>
            <span className="font-black text-lg">{session.event}</span>
            {session.date && (
              <span className="ml-3 text-green-200 text-sm font-medium">{formatDate(session.date)}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-amber-500 text-white px-6 py-2 text-sm font-semibold border-b border-amber-400">
          No active session set — go to Session Management to configure.
        </div>
      )}
      <div className="max-w-lg mx-auto p-6 space-y-6">
        {savedId && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 font-bold animate-in fade-in">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Player checked in!
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search by name or jersey number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSavedId(null); }}
            className="pl-12 h-14 text-lg rounded-xl border-2 shadow-sm"
          />
        </div>

        {filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 bg-white shadow-sm transition-all
                  ${p.checkedIn ? "border-green-200 bg-green-50" : "border-gray-200 hover:border-green-400"}`}
              >
                <div className="text-3xl font-black text-green-700 w-12 text-center tabular-nums">
                  #{p.jerseyNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg leading-tight truncate">{p.name}</div>
                  <div className="text-sm text-muted-foreground">{positionLabel(p.position ?? "")}</div>
                </div>
                {p.checkedIn ? (
                  <div className="flex items-center gap-1.5 text-green-600 font-bold text-sm shrink-0">
                    <CheckCircle2 className="h-5 w-5" /> Checked In
                  </div>
                ) : (
                  <button
                    onClick={() => handleCheckIn(p.id)}
                    disabled={updatePlayer.isPending}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 shrink-0"
                  >
                    <UserCheck className="h-4 w-4" /> Check In
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {search.trim().length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-semibold">No players found</p>
            <p className="text-sm mt-1">Try the player's last name or jersey number</p>
          </div>
        )}

        {search.trim().length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-15" />
            <p className="font-semibold text-lg">Ready to check in</p>
            <p className="text-sm mt-1">Start typing a name or jersey number above</p>
          </div>
        )}
      </div>
    </StationShell>
  );
}

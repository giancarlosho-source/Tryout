import { useState, useEffect } from "react";
import { useListPlayers, useUpdatePlayer, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, CheckCircle2, Calendar, ChevronRight, ArrowLeft } from "lucide-react";
import { positionLabel, positionColor } from "@/lib/positions";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type ActiveSession = { event: string; date: string } | null;
type PlayerRow = {
  id: number;
  name: string;
  position?: string | null;
  jerseyNumber?: string | null;
  checkedIn: boolean;
  age?: string | null;
};

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function SessionBanner({ session }: { session: ActiveSession }) {
  if (!session?.event) return null;
  return (
    <div className="bg-primary text-primary-foreground px-6 py-3 flex items-center gap-3">
      <Calendar className="h-5 w-5 opacity-80 shrink-0" />
      <div>
        <span className="font-black">{session.event}</span>
        {session.date && (
          <span className="ml-2 opacity-70 text-sm">{formatDate(session.date)}</span>
        )}
      </div>
    </div>
  );
}

export default function PlayerEntry() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PlayerRow | null>(null);
  const [doneCheckIn, setDoneCheckIn] = useState(false);
  const [session, setSession] = useState<ActiveSession>(null);

  const queryClient = useQueryClient();
  const updatePlayer = useUpdatePlayer();
  const { data: players } = useListPlayers({});

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((s: Record<string, string>) => {
        if (s["session.event"]) {
          setSession({ event: s["session.event"], date: s["session.date"] ?? "" });
        }
      })
      .catch(() => {});
  }, []);

  // Extract age group from session event name, e.g. "14U Tryouts" → "14"
  const sessionAge = session?.event?.match(/^(\d+)U/i)?.[1] ?? null;

  const filtered =
    search.trim().length >= 2
      ? (players ?? [])
          .filter((p) => {
            const nameMatch =
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              (p.jerseyNumber ?? "").includes(search);
            const ageMatch = sessionAge ? (p.age ?? "") === sessionAge : true;
            return nameMatch && ageMatch;
          })
          .slice(0, 8)
      : [];

  const handleCheckIn = async () => {
    if (!selected) return;
    await updatePlayer.mutateAsync({ id: selected.id, data: { checkedIn: true } });
    queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey({}) });
    setDoneCheckIn(true);
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (doneCheckIn && selected) {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 className="h-20 w-20 text-green-500 mb-5" />
        <h1 className="text-3xl font-black text-green-800 mb-2">You're checked in!</h1>
        <p className="text-green-700 font-bold text-xl mb-1">{selected.name}</p>
        {session?.event && <p className="text-green-600">{session.event}</p>}
        <p className="text-green-600 text-sm mt-6">Find a staff member to get started.</p>
      </div>
    );
  }

  // ── Confirmation screen ─────────────────────────────────────────────────────
  if (selected) {
    const posClass = selected.position
      ? positionColor(selected.position)
      : "bg-gray-100 text-gray-600 border-gray-200";
    const posName = selected.position ? positionLabel(selected.position) : "Not assigned yet";

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SessionBanner session={session} />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-5">
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to search
            </button>

            <div className="bg-white border-2 rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Is this you?</p>
                <h2 className="text-2xl font-black">{selected.name}</h2>
              </div>

              <div className="divide-y divide-gray-100">
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">Position</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold border ${posClass}`}>
                    {posName}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">Jersey #</span>
                  <span className="font-black text-xl">
                    {selected.jerseyNumber ? `#${selected.jerseyNumber}` : "—"}
                  </span>
                </div>
                {selected.age && (
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm text-muted-foreground">Age Group</span>
                    <span className="font-semibold">{selected.age}U</span>
                  </div>
                )}
              </div>

              {selected.checkedIn ? (
                <div className="flex items-center gap-2 justify-center bg-green-50 border border-green-200 rounded-xl py-3 text-green-700 font-bold">
                  <CheckCircle2 className="h-5 w-5" /> Already checked in
                </div>
              ) : (
                <button
                  onClick={handleCheckIn}
                  disabled={updatePlayer.isPending}
                  className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-xl transition-colors disabled:opacity-50"
                >
                  I'm here — Check In ✓
                </button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Something wrong? See a staff member to update your info.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Search screen ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SessionBanner session={session} />
      <div className="flex-1 flex flex-col items-center justify-start pt-12 px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black">Welcome!</h1>
            <p className="text-muted-foreground text-base">Search your name to check in</p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              placeholder="Your name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 text-lg rounded-xl border-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm"
            />
          </div>

          {filtered.length > 0 && (
            <div className="space-y-2">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 bg-white hover:border-primary shadow-sm text-left transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base leading-tight">{p.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {p.position ? positionLabel(p.position) : "Position TBD"}
                      {p.jerseyNumber ? ` · #${p.jerseyNumber}` : ""}
                    </div>
                  </div>
                  {p.checkedIn && (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}

          {search.trim().length >= 2 && filtered.length === 0 && (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground font-semibold">Not found in the system</p>
              <a
                href="/register"
                className="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors"
              >
                Register as a new player →
              </a>
            </div>
          )}

          {search.trim().length < 2 && (
            <p className="text-center text-xs text-muted-foreground pt-2">
              First time here?{" "}
              <a href="/register" className="text-primary font-semibold underline">
                Register here
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

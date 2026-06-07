import { useState, useEffect } from "react";
import { ShieldCheck, KeyRound, X, Lock, LockOpen } from "lucide-react";

const HELP = {
  title: "Staff & Roles",
  description: "Control who can log in on the iPads and which station they have access to. Only people with a PIN assigned here will appear on the iPad login screen.",
  steps: [
    { step: 1, text: "People are pulled from the Coaches tab — add staff there first if they don't appear here." },
    { step: 2, text: "Click Assign PIN next to a person, choose their station, and set a 4-digit PIN." },
    { step: 3, text: "On the iPad, they select their name and enter their PIN to unlock their assigned station." },
    { step: 4, text: "To remove access, click the X icon next to their name." },
  ],
  tips: [
    "Station roles: Evaluator sees only the Evaluation tab, Check-In sees only Check-In, etc.",
    "A person can only have one active station role at a time.",
    "PINs are not visible after saving — if someone forgets theirs, just assign a new one.",
    "Removing a PIN immediately locks that person out of the iPad.",
  ],
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const STATION_ROLES = [
  { value: "evaluator", label: "Evaluation station" },
  { value: "checkin", label: "Check-In station" },
  { value: "photo", label: "Photo station" },
  { value: "measurements", label: "Measurements station" },
];

type CoachEntry = {
  id: number;
  name: string;
  teamName: string;
  hasPin: boolean;
  stationRole: string | null;
};

export default function Staff() {
  const [coaches, setCoaches] = useState<CoachEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [stationRole, setStationRole] = useState("evaluator");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requirePin, setRequirePin] = useState(true);
  const [togglingPin, setTogglingPin] = useState(false);

  const load = () =>
    fetch(`${API_BASE}/api/staff/all`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCoaches(d); })
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((d) => setRequirePin(d.requirePin !== "false"))
      .catch(() => {});
  }, []);

  const toggleRequirePin = async () => {
    setTogglingPin(true);
    const next = !requirePin;
    await fetch(`${API_BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirePin: String(next) }),
    });
    setRequirePin(next);
    setTogglingPin(false);
  };

  const startEdit = (coach: CoachEntry) => {
    setEditing(coach.id);
    setPin("");
    setStationRole(coach.stationRole ?? "evaluator");
    setError("");
  };

  const cancelEdit = () => { setEditing(null); setPin(""); setError(""); };

  const savePin = async (id: number) => {
    if (!/^\d{4}$/.test(pin)) { setError("PIN must be exactly 4 digits."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/staff/${id}/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, stationRole }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setCoaches((prev) => prev.map((c) => c.id === id ? { ...c, hasPin: true, stationRole } : c));
      setEditing(null);
      setPin("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removePin = async (id: number) => {
    await fetch(`${API_BASE}/api/staff/${id}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: null, stationRole: null }),
    });
    setCoaches((prev) => prev.map((c) => c.id === id ? { ...c, hasPin: false, stationRole: null } : c));
    if (editing === id) cancelEdit();
  };

  const withAccess = coaches.filter((c) => c.hasPin);
  const withoutAccess = coaches.filter((c) => !c.hasPin);

  return (
    <div className="flex flex-col h-full overflow-auto bg-background p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Staff & Roles
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Assign a PIN and station to staff from your Coaches list. They'll use their PIN to log in on the iPad.
        </p>

        {/* PIN requirement toggle */}
        <div className="mt-4 flex items-center justify-between max-w-lg bg-muted/30 border rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            {requirePin ? <Lock className="h-4 w-4 text-primary" /> : <LockOpen className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-bold">{requirePin ? "PIN login required on iPads" : "PIN login disabled — open access"}</p>
              <p className="text-xs text-muted-foreground">{requirePin ? "Staff must select their name and enter a PIN to use the stations." : "Anyone who opens the app on an iPad goes straight to the station."}</p>
            </div>
          </div>
          <button
            onClick={toggleRequirePin}
            disabled={togglingPin}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-4
              ${requirePin ? "bg-primary" : "bg-gray-300"} disabled:opacity-50`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
              ${requirePin ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : coaches.length === 0 ? (
        <div className="bg-muted/30 border rounded-xl p-6 text-center text-sm text-muted-foreground max-w-md">
          No coaches yet. Add staff in the <strong>Coaches</strong> tab first, then assign PINs here.
        </div>
      ) : (
        <div className="space-y-6 max-w-lg">
          {/* People with iPad access */}
          {withAccess.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">Has iPad Access ({withAccess.length})</h2>
              {withAccess.map((c) => (
                <div key={c.id} className="bg-card border rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.teamName} · {STATION_ROLES.find((r) => r.value === c.stationRole)?.label ?? c.stationRole} · PIN: ••••
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(c)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button onClick={() => removePin(c.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {editing === c.id && <PinForm pin={pin} setPin={setPin} stationRole={stationRole} setStationRole={setStationRole} error={error} saving={saving} onSave={() => savePin(c.id)} onCancel={cancelEdit} />}
                </div>
              ))}
            </div>
          )}

          {/* People without iPad access */}
          {withoutAccess.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">No iPad Access ({withoutAccess.length})</h2>
              {withoutAccess.map((c) => (
                <div key={c.id} className="bg-card border rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-muted-foreground">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.teamName}</div>
                    </div>
                    <button onClick={() => startEdit(c)}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      <KeyRound className="h-3.5 w-3.5" /> Assign PIN
                    </button>
                  </div>
                  {editing === c.id && <PinForm pin={pin} setPin={setPin} stationRole={stationRole} setStationRole={setStationRole} error={error} saving={saving} onSave={() => savePin(c.id)} onCancel={cancelEdit} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PinForm({ pin, setPin, stationRole, setStationRole, error, saving, onSave, onCancel }: {
  pin: string; setPin: (v: string) => void;
  stationRole: string; setStationRole: (v: string) => void;
  error: string; saving: boolean;
  onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="border-t pt-3 space-y-3">
      <div className="flex gap-2">
        <Input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="4-digit PIN"
          inputMode="numeric"
          type="password"
          className="tracking-widest text-lg w-36"
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
        />
        <Select value={stationRole} onValueChange={setStationRole}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATION_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving} size="sm" className="gap-1">
          <KeyRound className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
        </Button>
        <Button onClick={onCancel} variant="ghost" size="sm">Cancel</Button>
      </div>
    </div>
  );
}

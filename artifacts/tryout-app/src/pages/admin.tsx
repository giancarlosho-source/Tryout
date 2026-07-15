import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Shield, RefreshCw, CheckCircle, XCircle, Clock, Ban, ChevronDown, ChevronUp, Trash2, KeyRound, LogOut, Plus, UserCheck, Users, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_TOKEN_KEY } from "./admin-login";

const CLUB_TOKEN_KEY = "tryoutdesk_token";

const API_BASE = (import.meta as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "";

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
}

const PLANS = ["", "starter", "pro", "elite"];
const STATUSES = ["trial", "active", "past_due", "cancelled"];

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  trial:     { label: "Trial",    color: "text-amber-600 bg-amber-50 border-amber-200",   icon: <Clock className="h-3 w-3" /> },
  active:    { label: "Active",   color: "text-green-700 bg-green-50 border-green-200",   icon: <CheckCircle className="h-3 w-3" /> },
  past_due:  { label: "Past Due", color: "text-red-600 bg-red-50 border-red-200",         icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: "Cancelled",color: "text-gray-500 bg-gray-50 border-gray-200",      icon: <Ban className="h-3 w-3" /> },
};

type ClubRow = {
  id: number;
  name: string;
  email: string;
  status: string;
  plan: string | null;
  trialEndsAt: string | null;
  maxPlayers: number | null;
  maxCoaches: number | null;
  maxEvents: number | null;
  createdAt: string;
  playerCount: number;
  coachCount: number;
  evalCount: number;
  emailVerifiedAt: string | null;
};

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminToken()}`, ...(opts?.headers ?? {}) },
  });
  let d: { error?: string } = {};
  try { d = await r.json(); } catch { /* non-JSON response */ }
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d;
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.cancelled;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${m.color}`}>
      {m.icon} {m.label}
    </span>
  );
}

type ClubUserRow = { id: number; name: string; email: string; createdAt: string };

function UserRow({ user, clubId, onRemove }: { user: ClubUserRow; clubId: number; onRemove: (id: number) => void }) {
  const [showReset, setShowReset] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetOk, setResetOk] = useState(false);

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetting(true);
    try {
      await apiFetch(`/admin/clubs/${clubId}/users/${user.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPw }),
      });
      setResetOk(true);
      setNewPw("");
      setTimeout(() => { setResetOk(false); setShowReset(false); }, 2000);
    } catch (e) { alert(String(e)); }
    finally { setResetting(false); }
  }

  const inputCls = "flex-1 px-2 py-1 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="rounded-lg bg-background border border-border text-sm overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex-1 min-w-0">
          <span className="font-semibold">{user.name}</span>
          <span className="text-muted-foreground ml-2 text-xs">{user.email}</span>
        </div>
        <button
          onClick={() => { setShowReset(v => !v); setNewPw(""); }}
          className="text-amber-600 hover:text-amber-800 p-1"
          title="Reset password"
        >
          <KeyRound className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onRemove(user.id)} className="text-destructive hover:text-destructive/70 p-1" title="Remove user">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {showReset && (
        <form onSubmit={resetPassword} className="flex items-center gap-2 px-3 pb-2">
          <input
            required
            type="password"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            placeholder="New password (min 8 chars)"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={resetting || newPw.length < 8}
            className="shrink-0 px-3 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold disabled:opacity-50"
          >
            {resetting ? "Saving…" : resetOk ? "Done ✓" : "Set"}
          </button>
        </form>
      )}
    </div>
  );
}

function ClubUsersSection({ clubId, clubName }: { clubId: number; clubName: string }) {
  const [users, setUsers] = useState<ClubUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const d = await apiFetch(`/admin/clubs/${clubId}/users`);
      setUsers(d.users);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function toggle() {
    if (!open) load();
    setOpen(v => !v);
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true); setError("");
    try {
      const d = await apiFetch(`/admin/clubs/${clubId}/users`, {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setUsers(prev => [...prev, d.user]);
      setName(""); setEmail(""); setPassword(""); setShowAdd(false);
    } catch (e) { setError(String(e)); }
    finally { setAdding(false); }
  }

  async function removeUser(userId: number) {
    if (!confirm("Remove this admin user?")) return;
    try {
      await apiFetch(`/admin/clubs/${clubId}/users/${userId}`, { method: "DELETE" });
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e) { alert(String(e)); }
  }

  const inputCls = "w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="col-span-2 border-t border-border pt-3">
      <button
        onClick={toggle}
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <Users className="h-3.5 w-3.5" />
        Admin Users for {clubName} {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-xs text-muted-foreground">No additional admins yet.</p>
          ) : (
            users.map(u => (
              <UserRow key={u.id} user={u} clubId={clubId} onRemove={removeUser} />
            ))
          )}
          {showAdd ? (
            <form onSubmit={addUser} className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="Name" className={inputCls} />
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className={inputCls} />
              </div>
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 8 chars)" className={inputCls} />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowAdd(false); setError(""); }} className="flex-1 py-1.5 rounded-lg border text-xs font-semibold">Cancel</button>
                <button type="submit" disabled={adding} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">
                  {adding ? "Adding…" : "Add Admin"}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 mt-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Admin User
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EditRow({ club, onSave, onDelete }: { club: ClubRow; onSave: (updated: ClubRow) => void; onDelete: (id: number) => void; }) {
  const [, navigate] = useLocation();
  const [impersonating, setImpersonating] = useState(false);

  async function impersonate() {
    setImpersonating(true);
    try {
      const d = await apiFetch(`/admin/clubs/${club.id}/impersonate`, { method: "POST" });
      localStorage.setItem(CLUB_TOKEN_KEY, d.token);
      navigate("/");
      window.location.reload();
    } catch (e) { alert(String(e)); }
    finally { setImpersonating(false); }
  }

  // rest of state below
  const [status, setStatus] = useState(club.status);
  const [plan, setPlan] = useState(club.plan ?? "");
  const [maxPlayers, setMaxPlayers] = useState(club.maxPlayers?.toString() ?? "");
  const [maxCoaches, setMaxCoaches] = useState(club.maxCoaches?.toString() ?? "");
  const [maxEvents, setMaxEvents] = useState(club.maxEvents?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetOk, setResetOk] = useState(false);
  const [showReset, setShowReset] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const d = await apiFetch(`/admin/clubs/${club.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          plan: plan || null,
          maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
          maxCoaches: maxCoaches ? parseInt(maxCoaches) : null,
          maxEvents: maxEvents ? parseInt(maxEvents) : null,
        }),
      });
      onSave({ ...club, ...d.club });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteClub() {
    setDeleting(true);
    try {
      await apiFetch(`/admin/clubs/${club.id}`, { method: "DELETE" });
      onDelete(club.id);
    } catch (e) { alert(String(e)); }
    finally { setDeleting(false); setConfirmDelete(false); }
  }

  async function resetPassword() {
    if (newPassword.length < 8) { alert("Password must be at least 8 characters."); return; }
    setResetting(true);
    try {
      await apiFetch(`/admin/clubs/${club.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      });
      setResetOk(true);
      setNewPassword("");
      setTimeout(() => { setResetOk(false); setShowReset(false); }, 2000);
    } catch (e) { alert(String(e)); }
    finally { setResetting(false); }
  }

  const inputCls = "w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
  const selectCls = inputCls + " cursor-pointer";

  return (
    <div className="grid grid-cols-2 gap-3 p-4 bg-muted/30 rounded-b-xl border-x border-b border-border -mt-1">
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Status</label>
        <select value={status} onChange={e => setStatus(e.target.value)} className={selectCls}>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Plan</label>
        <select value={plan} onChange={e => setPlan(e.target.value)} className={selectCls}>
          {PLANS.map(p => <option key={p} value={p}>{p || "— None —"}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Max Players <span className="font-normal">(blank = unlimited)</span></label>
        <input type="number" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} placeholder="Unlimited" className={inputCls} />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Max Coaches</label>
        <input type="number" value={maxCoaches} onChange={e => setMaxCoaches(e.target.value)} placeholder="Unlimited" className={inputCls} />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Max Events (Tryouts)</label>
        <input type="number" value={maxEvents} onChange={e => setMaxEvents(e.target.value)} placeholder="Unlimited" className={inputCls} />
      </div>
      <div className="flex items-end">
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
        </button>
      </div>

      {/* Impersonate */}
      <div className="col-span-2 border-t border-border pt-3">
        <button
          onClick={impersonate}
          disabled={impersonating}
          className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
        >
          <UserCheck className="h-3.5 w-3.5" />
          {impersonating ? "Signing in…" : `Sign in as ${club.name} (troubleshoot)`}
        </button>
      </div>

      {/* Verify email */}
      <div className="col-span-2 border-t border-border pt-3">
        <button
          onClick={async () => {
            try {
              const d = await apiFetch(`/admin/clubs/${club.id}`, { method: "PUT", body: JSON.stringify({ emailVerified: true }) });
              onSave({ ...club, ...d.club });
              alert("Email marked as verified.");
            } catch (e) { alert(String(e)); }
          }}
          className="flex items-center gap-2 text-xs font-semibold text-green-600 hover:text-green-800 transition-colors"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {club.emailVerifiedAt ? "Email verified ✓" : "Mark email as verified"}
        </button>
      </div>

      {/* Club users (additional admins) */}
      <ClubUsersSection clubId={club.id} clubName={club.name} />

      {/* Reset password */}
      <div className="col-span-2 border-t border-border pt-3">
        <button
          onClick={() => setShowReset(v => !v)}
          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {showReset ? "Cancel password reset" : "Reset password for this club"}
        </button>
        {showReset && (
          <div className="flex gap-2 mt-2">
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New temporary password (min 8 chars)"
              className={inputCls}
            />
            <button
              onClick={resetPassword}
              disabled={resetting || newPassword.length < 8}
              className="shrink-0 px-4 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-bold disabled:opacity-50"
            >
              {resetting ? "Saving…" : resetOk ? "Done ✓" : "Set Password"}
            </button>
          </div>
        )}
      </div>

      {/* Delete club */}
      <div className="col-span-2 border-t border-border pt-3">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete this club and all its data
          </button>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive font-semibold flex-1">
              This permanently deletes <strong>{club.name}</strong> and all their players, evaluations, and rosters. Cannot be undone.
            </p>
            <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1.5 rounded-lg border font-semibold">Cancel</button>
            <button
              onClick={deleteClub}
              disabled={deleting}
              className="text-xs px-3 py-1.5 rounded-lg bg-destructive text-white font-bold disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Yes, Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateClubModal({ onClose, onCreated }: { onClose: () => void; onCreated: (club: ClubRow) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputCls = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const d = await apiFetch("/admin/clubs", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      onCreated(d.club);
      onClose();
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <h2 className="text-lg font-bold">Create New Club</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Club Name</label>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Tribe Volleyball" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email (login)</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="coach@club.com" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Temporary Password</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" className={inputCls} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border text-sm font-semibold hover:bg-muted/50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">
              {saving ? "Creating…" : "Create Club"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Admin() {
  const [, navigate] = useLocation();
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showCreateClub, setShowCreateClub] = useState(false);

  const logout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    navigate("/admin/login");
  };

  const load = useCallback(async () => {
    const tok = getAdminToken();
    if (!tok) { navigate("/admin/login"); return; }
    setLoading(true); setError("");
    try {
      const d = await apiFetch("/admin/clubs");
      setClubs(d.clubs ?? []);
    } catch (e) {
      const msg = String(e);
      setError(msg);
    }
    finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const trialExpired = (club: ClubRow) =>
    club.status === "trial" && club.trialEndsAt && new Date(club.trialEndsAt) < new Date();

  const summary = {
    total: clubs.length,
    active: clubs.filter(c => c.status === "active").length,
    trial: clubs.filter(c => c.status === "trial" && !trialExpired(c)).length,
    expired: clubs.filter(c => trialExpired(c)).length,
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {showCreateClub && (
        <CreateClubModal
          onClose={() => setShowCreateClub(false)}
          onCreated={(club) => setClubs(prev => [club as unknown as ClubRow, ...prev])}
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Super Admin
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage all clubs and subscriptions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreateClub(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Club
          </button>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted/50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={logout} className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted/50 text-muted-foreground">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Clubs", value: summary.total, color: "text-foreground" },
          { label: "Active", value: summary.active, color: "text-green-700" },
          { label: "In Trial", value: summary.trial, color: "text-amber-600" },
          { label: "Expired Trials", value: summary.expired, color: "text-red-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-destructive/10 text-destructive text-sm space-y-2">
          <p><strong>{error}</strong></p>
          <button onClick={logout} className="text-xs font-bold underline">Sign out and try again</button>
        </div>
      )}

      {/* Club list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Clubs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : clubs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No clubs yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {clubs.map(club => (
                <div key={club.id}>
                  <button
                    onClick={() => setExpanded(expanded === club.id ? null : club.id)}
                    className="w-full text-left px-5 py-4 hover:bg-muted/30 transition-colors flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm truncate">{club.name}</span>
                        <StatusBadge status={trialExpired(club) ? "past_due" : club.status} />
                        {club.plan && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold capitalize">{club.plan}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                        <span>{club.email}</span>
                        <span>·</span>
                        <span>{club.playerCount} players</span>
                        <span>·</span>
                        <span>{club.coachCount} coaches</span>
                        {club.trialEndsAt && club.status === "trial" && (
                          <>
                            <span>·</span>
                            <span className={trialExpired(club) ? "text-red-500 font-semibold" : ""}>
                              Trial {trialExpired(club) ? "expired" : "ends"} {new Date(club.trialEndsAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-muted-foreground shrink-0">
                      {expanded === club.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {expanded === club.id && (
                    <EditRow
                      club={club}
                      onSave={updated => setClubs(prev => prev.map(c => c.id === updated.id ? updated : c))}
                      onDelete={id => { setClubs(prev => prev.filter(c => c.id !== id)); setExpanded(null); }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

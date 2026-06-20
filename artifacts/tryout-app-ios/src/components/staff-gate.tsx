import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Delete } from "lucide-react";

import { getServerUrl } from "@/lib/server-url";
const API_BASE = getServerUrl();
const STORAGE_KEY = "tryoutdesk_staff";

type StaffMember = { id: number; name: string; role: string };
type Screen = "pick" | "pin";

function getStoredStaff(): StaffMember | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useStaffAuth() {
  return {
    logout: () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    },
    staff: getStoredStaff(),
  };
}

export function StaffGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<StaffMember | null>(getStoredStaff());
  const [requirePin, setRequirePin] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((d) => setRequirePin(d.requirePin !== "false"))
      .catch(() => {}); // keep default true on failure
  }, []);

  // PIN not required — pass straight through
  if (!requirePin) return <>{children}</>;

  if (authed) return <>{children}</>;

  const onAuth = (member: StaffMember) => {
    setAuthed(member);
    navigate("/station/evaluation");
  };

  return <StaffLoginScreen onAuth={onAuth} />;
}

function StaffLoginScreen({ onAuth }: { onAuth: (m: StaffMember) => void }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [screen, setScreen] = useState<Screen>("pick");
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/staff`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setStaff(d); })
      .catch(() => {});
  }, []);

  const selectPerson = (m: StaffMember) => {
    setSelected(m);
    setPin("");
    setError("");
    setScreen("pin");
  };

  const appendDigit = (d: string) => {
    if (pin.length >= 4) return;
    setPin((p) => p + d);
    setError("");
  };

  const deleteDigit = () => setPin((p) => p.slice(0, -1));

  const submit = async (currentPin: string) => {
    if (currentPin.length !== 4 || !selected) return;
    setChecking(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/staff/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, pin: currentPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError("Incorrect PIN. Try again.");
        setPin("");
        return;
      }
      const member = { id: data.id, name: data.name, role: data.role };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(member));
      onAuth(member);
    } catch {
      setError("Could not connect. Try again.");
      setPin("");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) submit(pin);
  }, [pin]);

  // ── PIN screen ──────────────────────────────────────────────────────────────
  if (screen === "pin" && selected) {
    const dots = Array.from({ length: 4 }, (_, i) => i < pin.length);
    const pad = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xs space-y-8">
          <div className="text-center space-y-1">
            <div className="text-4xl font-black text-gray-900">{selected.name}</div>
            <p className="text-gray-500 font-medium">Enter your 4-digit PIN</p>
          </div>

          <div className="flex justify-center gap-4">
            {dots.map((filled, i) => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150
                ${filled ? "bg-primary border-primary" : "border-gray-300 bg-white"}`} />
            ))}
          </div>

          {error && <p className="text-center text-red-600 font-semibold text-sm">{error}</p>}

          <div className="grid grid-cols-3 gap-3">
            {pad.map((key, i) => {
              if (key === "") return <div key={i} />;
              if (key === "⌫") return (
                <button key={i} onClick={deleteDigit}
                  className="flex items-center justify-center h-16 rounded-2xl bg-white border-2 border-gray-200 text-gray-500 hover:bg-gray-50 active:scale-95 transition-all shadow-sm">
                  <Delete className="h-5 w-5" />
                </button>
              );
              return (
                <button key={i} onClick={() => appendDigit(key)} disabled={checking}
                  className="flex items-center justify-center h-16 rounded-2xl bg-white border-2 border-gray-200 text-2xl font-bold text-gray-900 hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-40">
                  {key}
                </button>
              );
            })}
          </div>

          <button onClick={() => { setScreen("pick"); setPin(""); setError(""); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center">
            ← Back to name selection
          </button>
        </div>
      </div>
    );
  }

  // ── Name picker ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img src="/tribe-logo.png" alt="TryoutDesk" className="h-16 w-16 object-contain mx-auto"
            onError={(e) => (e.currentTarget.style.display = "none")} />
          <h1 className="text-3xl font-black tracking-tight text-gray-900">TryoutDesk</h1>
          <p className="text-gray-500 font-medium">Who are you?</p>
        </div>

        <div className="space-y-2">
          {staff.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No evaluators set up yet.<br />Ask an admin to add you in Staff & Roles.
            </div>
          ) : (
            staff.map((m) => (
              <button key={m.id} onClick={() => selectPerson(m)}
                className="w-full text-left px-5 py-4 rounded-2xl bg-white border-2 border-gray-200 hover:border-primary hover:shadow-md active:scale-[0.98] transition-all font-bold text-lg text-gray-900">
                {m.name}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

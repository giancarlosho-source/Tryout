import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Delete, LayoutDashboard } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type StaffMember = { id: number; name: string; role: string };

type Screen = "pick" | "pin";

export default function StationSelect() {
  const [, navigate] = useLocation();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [screen, setScreen] = useState<Screen>("pick");
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/staff`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setStaff(data); })
      .catch(() => {});
  }, []);

  const selectPerson = (member: StaffMember) => {
    setSelected(member);
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

  const submit = async () => {
    if (pin.length !== 4 || !selected) return;
    setChecking(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/staff/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError("Incorrect PIN. Try again.");
        setPin("");
        return;
      }
      // Store session in localStorage
      localStorage.setItem("tryoutdesk_staff", JSON.stringify({ id: data.id, name: data.name, role: data.role }));
      localStorage.setItem("tryoutdesk_station_mode", data.role);
      navigate("/station/evaluation");
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setChecking(false);
    }
  };

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) submit();
  }, [pin]);

  const goAdmin = () => {
    localStorage.removeItem("tryoutdesk_staff");
    navigate("/");
  };

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

          {/* Dots */}
          <div className="flex justify-center gap-4">
            {dots.map((filled, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150
                  ${filled ? "bg-primary border-primary" : "border-gray-300 bg-white"}`}
              />
            ))}
          </div>

          {error && (
            <p className="text-center text-red-600 font-semibold text-sm">{error}</p>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {pad.map((key, i) => {
              if (key === "") return <div key={i} />;
              if (key === "⌫") return (
                <button
                  key={i}
                  onClick={deleteDigit}
                  className="flex items-center justify-center h-16 rounded-2xl bg-white border-2 border-gray-200 text-gray-500 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                >
                  <Delete className="h-5 w-5" />
                </button>
              );
              return (
                <button
                  key={i}
                  onClick={() => appendDigit(key)}
                  disabled={checking}
                  className="flex items-center justify-center h-16 rounded-2xl bg-white border-2 border-gray-200 text-2xl font-bold text-gray-900 hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-40"
                >
                  {key}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => { setScreen("pick"); setPin(""); setError(""); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            ← Back to name selection
          </button>
        </div>
      </div>
    );
  }

  // ── Name picker screen ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img
            src="/tribe-logo.png"
            alt="TryoutDesk"
            className="h-16 w-16 object-contain mx-auto"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <h1 className="text-3xl font-black tracking-tight text-gray-900">TryoutDesk</h1>
          <p className="text-gray-500 font-medium">Who are you?</p>
        </div>

        <div className="space-y-2">
          {staff.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No evaluators set up yet.<br />Ask an admin to add you in the Staff & Roles page.
            </div>
          ) : (
            staff.map((m) => (
              <button
                key={m.id}
                onClick={() => selectPerson(m)}
                className="w-full text-left px-5 py-4 rounded-2xl bg-white border-2 border-gray-200 hover:border-primary hover:shadow-md active:scale-[0.98] transition-all font-bold text-lg text-gray-900"
              >
                {m.name}
              </button>
            ))
          )}
        </div>

        <div className="pt-2 border-t border-gray-200">
          <button
            onClick={goAdmin}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gray-800 hover:bg-gray-900 text-white font-bold transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Full Admin Console
          </button>
        </div>
      </div>
    </div>
  );
}

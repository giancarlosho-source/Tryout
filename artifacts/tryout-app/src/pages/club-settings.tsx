import { useState, useRef, useEffect } from "react";
import { Building2, Palette, ImagePlus, Check, Loader2, KeyRound } from "lucide-react";
import { useAdminAuth, applyColor, getToken } from "@/components/password-gate";

const API_BASE = (import.meta as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "";

export default function ClubSettings() {
  const { club, uploadLogo, updateClub } = useAdminAuth();

  const [name, setName] = useState(club?.name ?? "");
  const [color, setColor] = useState(club?.primaryColor ?? "#e11d48");
  const [logoSrc, setLogoSrc] = useState<string | null>(club?.logoUrl ?? null);

  const [nameSaving, setNameSaving] = useState(false);
  const [colorSaving, setColorSaving] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [nameOk, setNameOk] = useState(false);
  const [colorOk, setColorOk] = useState(false);
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordOk, setPasswordOk] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [tempPwBanner, setTempPwBanner] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (localStorage.getItem("tryoutdesk_change_pw")) {
      localStorage.removeItem("tryoutdesk_change_pw");
      setTempPwBanner(true);
    }
  }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === club?.name) return;
    setNameSaving(true); setError("");
    try {
      await updateClub({ name: name.trim() });
      setNameOk(true);
      setTimeout(() => setNameOk(false), 2000);
    } catch (err) { setError(String(err)); }
    finally { setNameSaving(false); }
  }

  async function saveColor() {
    setColorSaving(true); setError("");
    try {
      await updateClub({ primaryColor: color });
      applyColor(color);
      setColorOk(true);
      setTimeout(() => setColorOk(false), 2000);
    } catch (err) { setError(String(err)); }
    finally { setColorSaving(false); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) { setPasswordError("New passwords do not match."); return; }
    if (newPassword.length < 8) { setPasswordError("New password must be at least 8 characters."); return; }
    setPasswordSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/auth/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await r.json();
      if (!r.ok) { setPasswordError(d.error ?? "Failed to change password."); return; }
      setPasswordOk(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => setPasswordOk(false), 3000);
    } catch { setPasswordError("Network error. Please try again."); }
    finally { setPasswordSaving(false); }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoSaving(true); setError("");
    try {
      const url = await uploadLogo(file);
      setLogoSrc(url);
    } catch (err) { setError(String(err)); }
    finally { setLogoSaving(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Club Settings</h1>
        <p className="text-muted-foreground mt-1">Customize your club's branding</p>
      </div>

      {tempPwBanner && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5">🔑</span>
          <div>
            <p className="font-bold">You're using a temporary password</p>
            <p className="mt-0.5">Please set a new password below before continuing.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {/* Logo */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <ImagePlus className="h-4 w-4" /> Club Logo
        </h2>
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
            {logoSrc
              ? <img src={logoSrc} alt="Club logo" className="w-full h-full object-contain p-1" />
              : <ImagePlus className="h-8 w-8 text-muted-foreground/40" />}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={logoSaving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {logoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {logoSaving ? "Uploading…" : "Upload Logo"}
            </button>
            <p className="text-xs text-muted-foreground">PNG, JPG, SVG or WebP · Max 2 MB</p>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoChange} />
        </div>
      </section>

      {/* Club name */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Club Name
        </h2>
        <form onSubmit={saveName} className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your club name"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={nameSaving || !name.trim() || name.trim() === club?.name}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center gap-2 min-w-[80px] justify-center"
          >
            {nameSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : nameOk ? <Check className="h-4 w-4" /> : "Save"}
          </button>
        </form>
      </section>

      {/* Primary color */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Palette className="h-4 w-4" /> Primary Color
        </h2>
        <p className="text-xs text-muted-foreground mb-4">Changes the sidebar and all accents to your club colors. Pick a preset or enter any hex value.</p>

        {/* Preset swatches */}
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { label: "Crimson",   hex: "#c8102e" },
            { label: "Navy",      hex: "#002d72" },
            { label: "Forest",    hex: "#1a6b3c" },
            { label: "Royal",     hex: "#4169e1" },
            { label: "Purple",    hex: "#6b21a8" },
            { label: "Orange",    hex: "#ea580c" },
            { label: "Gold",      hex: "#ca8a04" },
            { label: "Teal",      hex: "#0d9488" },
            { label: "Black",     hex: "#1a1a1a" },
            { label: "Slate",     hex: "#475569" },
          ].map(({ label, hex }) => (
            <button
              key={hex}
              title={label}
              onClick={() => { setColor(hex); applyColor(hex); }}
              className={`w-9 h-9 rounded-xl border-2 transition-transform hover:scale-110 ${color === hex ? "border-foreground scale-110" : "border-transparent"}`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); applyColor(e.target.value); }}
              className="w-14 h-14 rounded-xl border border-border cursor-pointer p-1 bg-background"
            />
          </div>
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={color}
              onChange={(e) => {
                const v = e.target.value;
                setColor(v);
                if (/^#[0-9a-fA-F]{6}$/.test(v)) applyColor(v);
              }}
              placeholder="#e11d48"
              className="w-28 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-xs text-muted-foreground">Custom hex value</span>
          </div>
          <button
            onClick={saveColor}
            disabled={colorSaving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center gap-2 min-w-[80px] justify-center"
          >
            {colorSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : colorOk ? <Check className="h-4 w-4" /> : "Save"}
          </button>
        </div>
      </section>
      {/* Change password */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Change Password
        </h2>
        {passwordOk && (
          <div className="mb-3 px-4 py-3 rounded-lg bg-green-50 text-green-700 text-sm font-medium flex items-center gap-2">
            <Check className="h-4 w-4" /> Password updated successfully.
          </div>
        )}
        {passwordError && (
          <div className="mb-3 px-4 py-3 rounded-lg bg-destructive/10 text-destructive text-sm">{passwordError}</div>
        )}
        <form onSubmit={changePassword} className="flex flex-col gap-3">
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            required
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            required
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center gap-2 w-fit"
          >
            {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {passwordSaving ? "Updating…" : "Update Password"}
          </button>
        </form>
      </section>
    </div>
  );
}

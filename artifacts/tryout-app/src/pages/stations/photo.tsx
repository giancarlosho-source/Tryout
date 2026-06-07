import { useState, useRef } from "react";
import { useListPlayers, getGetPlayerQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StationShell } from "@/components/station-shell";
import { Input } from "@/components/ui/input";
import { Search, Camera, CheckCircle2, X } from "lucide-react";
import { positionLabel } from "@/lib/positions";
import { useActiveSession } from "@/hooks/use-active-session";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export default function PhotoStation() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [doneId, setDoneId] = useState<number | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sessionAge } = useActiveSession();
  const queryClient = useQueryClient();

  const { data: allPlayers } = useListPlayers({});
  const players = sessionAge
    ? (allPlayers ?? []).filter((p) => (p.age ?? "") === sessionAge)
    : (allPlayers ?? []);

  const filtered = search.trim().length > 0
    ? players.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.jerseyNumber ?? "").includes(search)
      )
    : [];

  const selected = (allPlayers ?? []).find((p) => p.id === selectedId);

  const handleFileChange = async (file: File) => {
    if (!selectedId) return;
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setUploading(true);
    const form = new FormData();
    form.append("photo", file);
    try {
      await fetch(`${API_BASE}/api/players/${selectedId}/photo`, { method: "POST", body: form });
      queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(selectedId) });
      setDoneId(selectedId);
      setTimeout(() => {
        setSelectedId(null);
        setPhotoPreview(null);
        setSearch("");
        setDoneId(null);
      }, 2000);
    } finally {
      setUploading(false);
    }
  };

  return (
    <StationShell title="Photo" color="bg-blue-600">
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
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedId(p.id); setSearch(""); setPhotoPreview(null); }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 bg-white shadow-sm hover:border-blue-400 transition-all text-left"
                  >
                    <div className="text-3xl font-black text-blue-700 w-12 text-center tabular-nums">
                      #{p.jerseyNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-lg leading-tight truncate">{p.name}</div>
                      <div className="text-sm text-muted-foreground">{positionLabel(p.position ?? "")}</div>
                    </div>
                    {(p as any).photoUrl && (
                      <img src={`${API_BASE}${(p as any).photoUrl}`} className="h-12 w-12 rounded-full object-cover border-2 border-blue-200 shrink-0" alt="" />
                    )}
                    <Camera className="h-5 w-5 text-blue-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {search.trim().length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Camera className="h-12 w-12 mx-auto mb-3 opacity-15" />
                <p className="font-semibold text-lg">Ready for photos</p>
                <p className="text-sm mt-1">Search for a player to take their photo</p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-blue-200 shadow-sm">
              <div className="text-3xl font-black text-blue-700 w-12 text-center tabular-nums">
                #{selected?.jerseyNumber}
              </div>
              <div className="flex-1">
                <div className="font-bold text-xl">{selected?.name}</div>
                <div className="text-sm text-muted-foreground">{positionLabel(selected?.position ?? "")}</div>
              </div>
              <button onClick={() => { setSelectedId(null); setPhotoPreview(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {doneId ? (
              <div className="flex flex-col items-center gap-3 py-8 text-green-600">
                {photoPreview && <img src={photoPreview} className="w-40 h-40 rounded-full object-cover border-4 border-green-300 shadow-lg" alt="" />}
                <CheckCircle2 className="h-10 w-10" />
                <p className="font-bold text-xl">Photo saved!</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5">
                {photoPreview ? (
                  <img src={photoPreview} className="w-48 h-48 rounded-full object-cover border-4 border-blue-300 shadow-lg" alt="" />
                ) : (selected as any)?.photoUrl ? (
                  <img src={`${API_BASE}${(selected as any).photoUrl}`} className="w-48 h-48 rounded-full object-cover border-4 border-blue-200 shadow-lg opacity-60" alt="" />
                ) : (
                  <div className="w-48 h-48 rounded-full bg-blue-50 border-4 border-blue-200 flex items-center justify-center">
                    <Camera className="h-16 w-16 text-blue-300" />
                  </div>
                )}

                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); e.target.value = ""; }} />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-colors disabled:opacity-50 shadow-md"
                >
                  <Camera className="h-6 w-6" />
                  {uploading ? "Saving..." : (selected as any)?.photoUrl ? "Retake Photo" : "Take Photo"}
                </button>
                <p className="text-sm text-muted-foreground">Opens camera or file picker</p>
              </div>
            )}
          </div>
        )}
      </div>
    </StationShell>
  );
}

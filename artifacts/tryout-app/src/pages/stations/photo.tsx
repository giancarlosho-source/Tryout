import { useState, useRef, useCallback } from "react";
import { useListPlayers, getGetPlayerQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StationShell } from "@/components/station-shell";
import { Input } from "@/components/ui/input";
import { Search, Camera, CheckCircle2, X, Upload, AlertTriangle } from "lucide-react";
import { positionLabel } from "@/lib/positions";
import { useActiveSession } from "@/hooks/use-active-session";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export default function PhotoStation() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [doneId, setDoneId] = useState<number | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { sessionAge } = useActiveSession();
  const queryClient = useQueryClient();

  const { data: allPlayers, isError, refetch } = useListPlayers({});
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

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const startCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 50);
    } catch {
      setCameraError("Could not access camera. Check browser permissions.");
    }
  };

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("tryoutdesk_token") ?? "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const MAX = 500;
    const scale = Math.min(1, MAX / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob || !selectedId) return;
      stopCamera();
      const preview = URL.createObjectURL(blob);
      setPhotoPreview(preview);
      setUploading(true);
      const form = new FormData();
      form.append("photo", blob, "photo.jpg");
      try {
        const res = await fetch(`${API_BASE}/api/players/${selectedId}/photo`, { method: "POST", body: form, headers: authHeaders() });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(selectedId) });
        setDoneId(selectedId);
        setTimeout(() => { setSelectedId(null); setPhotoPreview(null); setSearch(""); setDoneId(null); }, 2000);
      } catch (e) {
        alert(String(e));
      } finally {
        setUploading(false);
      }
    }, "image/jpeg", 0.92);
  };

  const handleFileChange = async (file: File) => {
    if (!selectedId) return;
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setUploading(true);
    const form = new FormData();
    form.append("photo", file);
    try {
      const res = await fetch(`${API_BASE}/api/players/${selectedId}/photo`, { method: "POST", body: form, headers: authHeaders() });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(selectedId) });
      setDoneId(selectedId);
      setTimeout(() => { setSelectedId(null); setPhotoPreview(null); setSearch(""); setDoneId(null); }, 2000);
    } catch (e) {
      alert(String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <StationShell title="Photo" color="bg-blue-600">
      <div className="max-w-lg mx-auto p-6 space-y-6">
        {isError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 font-bold">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="flex-1">Couldn't load players. Check your connection.</span>
            <button onClick={() => refetch()} className="underline text-sm font-semibold shrink-0">Retry</button>
          </div>
        )}

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
                      <img src={(p as any).photoUrl.startsWith("data:") ? (p as any).photoUrl : `${API_BASE}${(p as any).photoUrl}`} className="h-12 w-12 rounded-full object-cover border-2 border-blue-200 shrink-0" alt="" />
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
              <button onClick={() => { stopCamera(); setSelectedId(null); setPhotoPreview(null); }} aria-label="Cancel and return to search" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {doneId ? (
              <div className="flex flex-col items-center gap-3 py-8 text-green-600">
                {photoPreview && <img src={photoPreview} className="w-40 h-40 rounded-full object-cover border-4 border-green-300 shadow-lg" alt="" />}
                <CheckCircle2 className="h-10 w-10" />
                <p className="font-bold text-xl">Photo saved!</p>
              </div>
            ) : cameraActive ? (
              <div className="flex flex-col items-center gap-4">
                <video ref={videoRef} className="w-64 h-64 rounded-full object-cover border-4 border-blue-300 shadow-lg bg-black" autoPlay playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-3">
                  <button
                    onClick={capturePhoto}
                    disabled={uploading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-colors disabled:opacity-50 shadow-md"
                  >
                    <Camera className="h-6 w-6" />
                    Capture
                  </button>
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-6 py-4 rounded-2xl text-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5">
                {photoPreview ? (
                  <img src={photoPreview} className="w-48 h-48 rounded-full object-cover border-4 border-blue-300 shadow-lg" alt="" />
                ) : (selected as any)?.photoUrl ? (
                  <img src={(selected as any).photoUrl.startsWith("data:") ? (selected as any).photoUrl : `${API_BASE}${(selected as any).photoUrl}`} className="w-48 h-48 rounded-full object-cover border-4 border-blue-200 shadow-lg opacity-60" alt="" />
                ) : (
                  <div className="w-48 h-48 rounded-full bg-blue-50 border-4 border-blue-200 flex items-center justify-center">
                    <Camera className="h-16 w-16 text-blue-300" />
                  </div>
                )}

                {cameraError && <p className="text-red-500 text-sm text-center">{cameraError}</p>}

                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); e.target.value = ""; }} />

                <div className="flex gap-3">
                  <button
                    onClick={startCamera}
                    disabled={uploading}
                    className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-4 rounded-2xl text-lg transition-colors disabled:opacity-50 shadow-md"
                  >
                    <Camera className="h-6 w-6" />
                    Use Camera
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-6 py-4 rounded-2xl text-lg transition-colors disabled:opacity-50 shadow-md"
                  >
                    <Upload className="h-5 w-5" />
                    Upload
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {(selected as any)?.photoUrl ? "Retake or replace photo" : "Take a live photo or upload a file"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </StationShell>
  );
}

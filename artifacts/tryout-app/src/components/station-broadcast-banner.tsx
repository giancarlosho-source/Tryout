import { useEffect, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const AUTO_DISMISS_MS = 15_000;

interface BroadcastMessage {
  id: string;
  text: string;
  createdAt: string;
}

export function StationBroadcastBanner() {
  const [message, setMessage] = useState<BroadcastMessage | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const slug = localStorage.getItem("tryoutdesk_club_slug");
    if (!slug) return;

    const es = new EventSource(`${API_BASE}/api/events/public/${slug}`);
    es.addEventListener("admin:message", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as BroadcastMessage;
        setMessage(data);
      } catch { /* ignore malformed payload */ }
    });
    es.onerror = () => { /* EventSource auto-reconnects on its own */ };

    return () => es.close();
  }, []);

  useEffect(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (!message) return;
    dismissTimerRef.current = setTimeout(() => setMessage(null), AUTO_DISMISS_MS);
    return () => { if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current); };
  }, [message]);

  if (!message) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center p-3 pointer-events-none">
      <div className="pointer-events-auto max-w-lg w-full flex items-start gap-3 bg-gray-900 text-white rounded-2xl shadow-2xl border border-white/10 px-4 py-3 animate-in fade-in slide-in-from-top-2">
        <MessageSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="flex-1 text-sm font-semibold leading-snug">{message.text}</p>
        <button
          onClick={() => setMessage(null)}
          aria-label="Dismiss message"
          className="shrink-0 text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

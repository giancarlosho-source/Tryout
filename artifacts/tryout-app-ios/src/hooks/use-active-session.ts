import { useState, useEffect } from "react";
import { getServerUrl } from "@/lib/server-url";

const API_BASE = getServerUrl();

export type ActiveSession = { event: string; date: string } | null;

export function useActiveSession() {
  const [session, setSession] = useState<ActiveSession>(null);

  useEffect(() => {
    const load = () =>
      fetch(`${API_BASE}/api/settings`)
        .then((r) => r.json())
        .then((s: Record<string, string>) => {
          setSession(
            s["session.event"]
              ? { event: s["session.event"], date: s["session.date"] ?? "" }
              : null
          );
        })
        .catch(() => {});

    load();
    const id = setInterval(load, 10000); // re-check every 10 seconds
    return () => clearInterval(id);
  }, []);

  const sessionAge = session?.event?.match(/^(\d+)U/i)?.[1] ?? null;

  return { session, sessionAge };
}

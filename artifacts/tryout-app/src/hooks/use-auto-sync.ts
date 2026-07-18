import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function useAutoSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      const token = localStorage.getItem("tryoutdesk_token") ?? "";
      const url = `${API_BASE}/api/events${token ? `?token=${encodeURIComponent(token)}` : ""}`;
      es = new EventSource(url);

      es.addEventListener("connected", () => {
        // Connection established — nothing to do
      });

      // Any data-change event triggers a full cache invalidation
      const dataEvents = [
        "players:changed",
        "scores:changed",
        "evaluations:changed",
        "sessions:changed",
        "staff:changed",
      ];
      const refresh = () => {
        queryClient.invalidateQueries({ refetchType: "active" });
      };

      for (const evt of dataEvents) {
        es.addEventListener(evt, refresh);
      }

      es.onerror = () => {
        es?.close();
        es = null;
        // Reconnect after 3 seconds
        retryTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [queryClient]);
}

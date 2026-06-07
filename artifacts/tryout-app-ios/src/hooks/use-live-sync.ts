import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListPlayersQueryKey, getListRankingsQueryKey } from "@workspace/api-client-react";
import { getServerUrl } from "@/lib/server-url";

export function useLiveSync() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = `${getServerUrl()}/api/events`;

    function connect() {
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("connected", () => setConnected(true));

      es.addEventListener("players:changed", () => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListRankingsQueryKey() });
      });

      es.addEventListener("scores:changed", () => {
        queryClient.invalidateQueries({ queryKey: getListRankingsQueryKey() });
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        // Reconnect after 3s
        setTimeout(connect, 3000);
      };
    }

    connect();
    return () => { esRef.current?.close(); };
  }, [queryClient]);

  return { connected };
}

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type RosterSlotInfo = {
  position: string;
  positionLabel: string;
};

type RosterContextValue = {
  rosterMap: Map<number, RosterSlotInfo>;
  setRoster: (slots: { playerId: number; position: string; positionLabel: string }[]) => void;
  clearRoster: () => void;
  isOnRoster: (playerId: number) => boolean;
  getRosterSlot: (playerId: number) => RosterSlotInfo | undefined;
};

const RosterContext = createContext<RosterContextValue | null>(null);

export function RosterProvider({ children }: { children: ReactNode }) {
  const [rosterMap, setRosterMap] = useState<Map<number, RosterSlotInfo>>(new Map());

  const setRoster = useCallback(
    (slots: { playerId: number; position: string; positionLabel: string }[]) => {
      const map = new Map<number, RosterSlotInfo>();
      slots.forEach((s) => map.set(s.playerId, { position: s.position, positionLabel: s.positionLabel }));
      setRosterMap(map);
    },
    []
  );

  const clearRoster = useCallback(() => setRosterMap(new Map()), []);

  const isOnRoster = useCallback((playerId: number) => rosterMap.has(playerId), [rosterMap]);

  const getRosterSlot = useCallback((playerId: number) => rosterMap.get(playerId), [rosterMap]);

  return (
    <RosterContext.Provider value={{ rosterMap, setRoster, clearRoster, isOnRoster, getRosterSlot }}>
      {children}
    </RosterContext.Provider>
  );
}

export function useRoster() {
  const ctx = useContext(RosterContext);
  if (!ctx) throw new Error("useRoster must be used within RosterProvider");
  return ctx;
}

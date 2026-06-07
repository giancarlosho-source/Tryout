import { createContext, useContext, useState, type ReactNode } from "react";
import { useActiveSession, type ActiveSession } from "@/hooks/use-active-session";

export type { ActiveSession };

type SessionContextValue = {
  session: ActiveSession;
  sessionAge: string | null;
  setSession: (s: ActiveSession) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { session, sessionAge } = useActiveSession();

  // setSession is a no-op here — optimistic updates aren't needed since polling is fast
  const setSession = (_s: ActiveSession) => {};

  return (
    <SessionContext.Provider value={{ session, sessionAge, setSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { StaffGate } from "@/components/staff-gate";
import { useLiveSync } from "@/hooks/use-live-sync";

import CheckInStation from "./pages/stations/checkin";
import PhotoStation from "./pages/stations/photo";
import MeasurementsStation from "./pages/stations/measurements";
import EvaluationStation from "./pages/stations/evaluation";
import ServerView from "./pages/server";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient();

function AppInner() {
  useLiveSync();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppInner />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <StaffGate>
            <Switch>
              <Route path="/station/checkin">
                <ErrorBoundary label="Check-In"><CheckInStation /></ErrorBoundary>
              </Route>
              <Route path="/station/photo" component={PhotoStation} />
              <Route path="/station/measurements" component={MeasurementsStation} />
              <Route path="/station/evaluation" component={EvaluationStation} />
              <Route path="/server" component={ServerView} />
              <Route component={NotFound} />
            </Switch>
          </StaffGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

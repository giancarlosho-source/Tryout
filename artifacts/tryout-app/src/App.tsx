import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Activity, Users, TrendingUp, UsersRound, Upload, Swords, ArrowLeftRight, LogOut, UserCheck, ClipboardCheck, ScanLine, QrCode, ShieldCheck } from "lucide-react";
import { HelpButton } from "@/components/help-modal";
import { HELP_REGISTRY } from "@/lib/help-content";
import { RosterProvider } from "@/contexts/roster-context";
import { SessionProvider, useSession } from "@/contexts/session-context";
import { PasswordGate, useAdminAuth } from "@/components/password-gate";
import { ErrorBoundary } from "@/components/error-boundary";

import Dashboard from "./pages/dashboard";
import Players from "./pages/players";
import PlayerProfile from "./pages/player-profile";
import Evaluate from "./pages/evaluate";
import Rankings from "./pages/rankings";
import PositionRankings from "./pages/position-rankings";
import Roster from "./pages/roster";
import Import from "./pages/import";
import Draft from "./pages/draft";
import Coaches from "./pages/coaches";
import StationSelect from "./pages/station-select";
import CheckInStation from "./pages/stations/checkin";
import PhotoStation from "./pages/stations/photo";
import MeasurementsStation from "./pages/stations/measurements";
import EvaluationStation from "./pages/stations/evaluation";
import Compare from "./pages/compare";
import Coverage from "./pages/coverage";
import BulkCheckIn from "./pages/bulk-checkin";
import Sessions from "./pages/sessions";
import PlayerEntry from "./pages/player-entry";
import StaffPage from "./pages/staff";
import ServerView from "./pages/server";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient();

function SessionBadge() {
  const { session } = useSession();
  if (!session?.event) return null;
  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-1.5 flex items-center gap-2 text-xs font-bold text-primary">
      <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
      Active: {session.event}
      {session.date && (
        <span className="font-normal text-primary/70 ml-0.5">
          — {new Date(session.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      )}
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAdminAuth();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/players", label: "Players", icon: Users },
    { href: "/rankings", label: "Rankings", icon: TrendingUp },
    { href: "/roster", label: "Roster", icon: UsersRound },
    { href: "/draft", label: "Live Draft", icon: Swords },
    { href: "/sessions", label: "Sessions & QR", icon: QrCode },
    { href: "/bulk-checkin", label: "Bulk Check-In", icon: ScanLine },
    { href: "/coverage", label: "Coverage", icon: ClipboardCheck },
    { href: "/compare", label: "Compare", icon: ArrowLeftRight },
    { href: "/coaches", label: "Coaches", icon: UserCheck },
    { href: "/import", label: "Import CSV", icon: Upload },
    { href: "/staff", label: "Staff & Roles", icon: ShieldCheck },
  ];

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="flex items-center px-3 py-3 gap-3 border-b border-sidebar-border bg-white">
            <img src="/tribe-logo.png" alt="TryoutDesk" className="h-10 w-10 object-contain flex-shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-base font-black tracking-tight text-primary">TryoutDesk</span>
              <span className="text-xs font-bold text-sidebar-foreground/60 tracking-wide">2026–2027</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="flex flex-col justify-between">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location === item.href}
                        className="h-12 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-sidebar-accent"
                      >
                        <Link href={item.href} className="flex items-center gap-3 text-base">
                          <item.icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <div className="px-4 py-4 border-t border-sidebar-border mt-auto flex items-center justify-between gap-2">
              <p className="text-[10px] text-sidebar-foreground/40 leading-snug">
                Developed by<br />
                <span className="text-sidebar-foreground/60 font-semibold">Giancarlos Hurtado</span>
              </p>
              <button
                onClick={logout}
                title="Lock console"
                className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <SessionBadge />
          {/* Top bar with contextual help */}
          {HELP_REGISTRY[location] && (
            <div className="shrink-0 flex justify-end px-4 py-1.5 border-b bg-background">
              <HelpButton {...HELP_REGISTRY[location]} />
            </div>
          )}
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

// Redirect to /station when running inside Capacitor (native app) or an installed PWA
const isNativeApp =
  !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() ||
  (navigator as { standalone?: boolean }).standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches;

const basePath = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
if (isNativeApp && window.location.pathname !== basePath + "/station") {
  window.location.replace(basePath + "/station");
}

function App() {
  return (
    <ErrorBoundary label="App">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          {/* Station routes are public — no password needed so phones/tablets can scan in */}
          <Switch>
            <Route path="/player" component={PlayerEntry} />
            <Route path="/station" component={StationSelect} />
            <Route path="/station/checkin"><ErrorBoundary label="Check-In"><CheckInStation /></ErrorBoundary></Route>
            <Route path="/station/photo" component={PhotoStation} />
            <Route path="/station/measurements" component={MeasurementsStation} />
            <Route path="/station/evaluation" component={EvaluationStation} />
            <Route path="/server" component={ServerView} />
            <Route>
              {/* Everything else requires admin password */}
              <PasswordGate>
                <SessionProvider>
                <RosterProvider>
                  <AppLayout>
                    <Switch>
                      <Route path="/" component={Dashboard} />
                      <Route path="/players" component={Players} />
                      <Route path="/players/:id" component={PlayerProfile} />
                      <Route path="/evaluate/:playerId" component={Evaluate} />
                      <Route path="/rankings" component={Rankings} />
                      <Route path="/rankings/position" component={PositionRankings} />
                      <Route path="/roster" component={Roster} />
                      <Route path="/draft" component={Draft} />
                      <Route path="/sessions" component={Sessions} />
                      <Route path="/bulk-checkin" component={BulkCheckIn} />
                      <Route path="/coverage" component={Coverage} />
                      <Route path="/compare" component={Compare} />
                      <Route path="/coaches" component={Coaches} />
                      <Route path="/import" component={Import} />
                      <Route path="/staff" component={StaffPage} />
                      <Route component={NotFound} />
                    </Switch>
                  </AppLayout>
                </RosterProvider>
                </SessionProvider>
              </PasswordGate>
            </Route>
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

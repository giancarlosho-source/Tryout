import { useState, useEffect } from "react";
import { useAutoSync } from "@/hooks/use-auto-sync";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Activity, Users, TrendingUp, UsersRound, Upload, Swords, ArrowLeftRight, LogOut, UserCheck, ClipboardCheck, ScanLine, QrCode, ShieldCheck, ImagePlus, Settings, Shield, CreditCard, BookOpen, LifeBuoy } from "lucide-react";
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
import ClubSettings from "./pages/club-settings";
import Admin from "./pages/admin";
import AdminLogin from "./pages/admin-login";
import NotFound from "./pages/not-found";
import VerifyEmail from "./pages/verify-email";
import HelpCenter from "./pages/help-center";

const ADMIN_TOKEN_KEY = "tryoutdesk_admin_token";
const CLUB_TOKEN_KEY = "tryoutdesk_token";

function ImpersonationBanner() {
  if (!localStorage.getItem(ADMIN_TOKEN_KEY)) return null;

  function exitImpersonation() {
    localStorage.removeItem(CLUB_TOKEN_KEY);
    window.location.href = "/admin";
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold shadow-lg">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-amber-400">Admin mode:</span>
        <span className="text-white/80 font-normal">viewing as a club account</span>
      </div>
      <button
        onClick={exitImpersonation}
        className="shrink-0 px-3 py-1 rounded-lg bg-amber-400 text-gray-900 text-xs font-bold hover:bg-amber-300 transition-colors"
      >
        ← Back to Admin Console
      </button>
    </div>
  );
}
import Billing from "./pages/billing";

const SUPER_ADMIN_EMAILS = new Set(
  ((import.meta as { env: { VITE_SUPER_ADMIN_EMAIL?: string } }).env.VITE_SUPER_ADMIN_EMAIL ?? "")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
);

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

const API_BASE_APP = (import.meta as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "";

function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout, club, uploadLogo } = useAdminAuth();
  const [logoSrc, setLogoSrc] = useState<string | null>(club?.logoUrl ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean>(club?.emailVerified ?? true);
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    // Re-read from localStorage in case the verify-email page updated it
    const raw = localStorage.getItem("tryoutdesk_club");
    if (raw) {
      try { setEmailVerified(JSON.parse(raw).emailVerified ?? false); } catch { /* ignore */ }
    }
  }, []);

  async function handleResendVerification() {
    setResendLoading(true);
    try {
      await fetch(`${API_BASE_APP}/api/auth/resend-verification`, { method: "POST" });
      setResendSent(true);
    } catch { /* silent */ } finally {
      setResendLoading(false);
    }
  }

  async function handleLogoClick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/svg+xml,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setLogoUploading(true);
      try {
        const url = await uploadLogo(file);
        setLogoSrc(url);
      } catch {
        // silent — logo stays as is
      } finally {
        setLogoUploading(false);
      }
    };
    input.click();
  }

  const isSuperAdmin = SUPER_ADMIN_EMAILS.size > 0 && SUPER_ADMIN_EMAILS.has(club?.email?.toLowerCase() ?? "");

  const trialDaysLeft = (() => {
    if (club?.status !== "trial" || !club.trialEndsAt) return null;
    const ms = new Date(club.trialEndsAt).getTime() - Date.now();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return days <= 3 ? days : null;
  })();

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
    { href: "/club-settings", label: "Club Settings", icon: Settings },
    { href: "/billing", label: "Billing", icon: CreditCard },
    { href: "/help", label: "Help Center", icon: BookOpen },
    ...(isSuperAdmin ? [{ href: "/admin", label: "Admin Panel", icon: Shield }] : []),
  ];

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="flex flex-col items-center px-4 py-5 gap-3 border-b border-sidebar-border">
            <button
              onClick={handleLogoClick}
              disabled={logoUploading}
              title="Click to upload club logo"
              className="relative h-20 w-20 flex-shrink-0 rounded-2xl overflow-hidden group focus:outline-none bg-white/10 shadow-lg"
            >
              {logoSrc ? (
                <img src={logoSrc} alt="Club logo" className="h-full w-full object-contain p-1" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <ImagePlus className="h-7 w-7 text-white/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                {logoUploading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <ImagePlus className="h-5 w-5 text-white" />}
              </div>
            </button>
            <div className="flex flex-col items-center leading-tight text-center">
              <span className="text-base font-black tracking-tight text-sidebar-foreground">{club?.name ?? "TryoutDesk"}</span>
              <span className="text-xs font-medium text-sidebar-foreground/60 tracking-wide">2026–2027</span>
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
                Powered by<br />
                <span className="text-sidebar-foreground/60 font-semibold">TryoutDesk</span>
              </p>
              <div className="flex items-center gap-1">
                <a
                  href="mailto:support@tryoutdesk.com"
                  title="Email support"
                  className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
                >
                  <LifeBuoy className="h-4 w-4" />
                </a>
                <button
                  onClick={logout}
                  title="Lock console"
                  className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {!emailVerified && (
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-50 border-b border-blue-200 text-blue-800 text-sm font-semibold">
              <span>Please verify your email address — check your inbox for a link from TryoutDesk.</span>
              <button
                onClick={handleResendVerification}
                disabled={resendLoading || resendSent}
                className="shrink-0 px-3 py-1 rounded-lg bg-blue-200 hover:bg-blue-300 text-blue-900 font-bold text-xs transition-colors disabled:opacity-60"
              >
                {resendSent ? "Sent!" : resendLoading ? "Sending…" : "Resend"}
              </button>
            </div>
          )}
          {trialDaysLeft !== null && (
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm font-semibold">
              <span>
                ⚠️ Your free trial {trialDaysLeft <= 0 ? "expires today" : `ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"}`} — subscribe to keep access.
              </span>
              <Link href="/billing" className="shrink-0 px-3 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold text-xs transition-colors">
                Subscribe Now
              </Link>
            </div>
          )}
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
  // Preserve ?club= query param so bookmarked station URLs keep their club context
  const club = new URLSearchParams(window.location.search).get("club");
  window.location.replace(basePath + "/station" + (club ? `?club=${club}` : ""));
}

function AutoSync() {
  useAutoSync();
  return null;
}

function App() {
  return (
    <ErrorBoundary label="App">
    <QueryClientProvider client={queryClient}>
      <AutoSync />
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          {/* Station routes are public — no password needed so phones/tablets can scan in */}
          <Switch>
            <Route path="/verify-email" component={VerifyEmail} />
            <Route path="/player" component={PlayerEntry} />
            <Route path="/admin/login" component={AdminLogin} />
            <Route path="/admin" component={Admin} />
            <Route path="/station/checkin"><ErrorBoundary label="Check-In"><CheckInStation /></ErrorBoundary></Route>
            <Route path="/station/photo" component={PhotoStation} />
            <Route path="/station/measurements" component={MeasurementsStation} />
            <Route path="/station/evaluation" component={EvaluationStation} />
            <Route path="/station/:slug" component={StationSelect} />
            <Route path="/station" component={StationSelect} />
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
                      <Route path="/club-settings" component={ClubSettings} />
                      <Route path="/billing" component={Billing} />
                      <Route path="/help" component={HelpCenter} />
                      <Route component={NotFound} />
                    </Switch>
                  </AppLayout>
                </RosterProvider>
                </SessionProvider>
              </PasswordGate>
            </Route>
          </Switch>
        </WouterRouter>
        <ImpersonationBanner />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

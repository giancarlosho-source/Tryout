import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Activity, Users, TrendingUp, UsersRound, Upload, Swords, ArrowLeftRight, MonitorDot } from "lucide-react";
import { RosterProvider } from "@/contexts/roster-context";

import Dashboard from "./pages/dashboard";
import Players from "./pages/players";
import PlayerProfile from "./pages/player-profile";
import Evaluate from "./pages/evaluate";
import Rankings from "./pages/rankings";
import PositionRankings from "./pages/position-rankings";
import Roster from "./pages/roster";
import Import from "./pages/import";
import Draft from "./pages/draft";
import Compare from "./pages/compare";
import ServerView from "./pages/server";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient();

function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/players", label: "Players", icon: Users },
    { href: "/rankings", label: "Rankings", icon: TrendingUp },
    { href: "/roster", label: "Roster", icon: UsersRound },
    { href: "/draft", label: "Live Draft", icon: Swords },
    { href: "/compare", label: "Compare", icon: ArrowLeftRight },
    { href: "/server", label: "Command Center", icon: MonitorDot },
    { href: "/import", label: "Import CSV", icon: Upload },
  ];

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="flex items-center px-3 py-3 gap-3 border-b border-sidebar-border bg-white">
            <img src="/tribe-logo.png" alt="Tribe VB" className="h-10 w-10 object-contain flex-shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-base font-black tracking-tight text-primary">Tribe Tryouts</span>
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
            <div className="px-4 py-4 border-t border-sidebar-border mt-auto">
              <p className="text-[10px] text-sidebar-foreground/40 leading-snug">
                Developed by<br />
                <span className="text-sidebar-foreground/60 font-semibold">Giancarlos Hurtado</span>
              </p>
            </div>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
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
        <Route path="/compare" component={Compare} />
        <Route path="/server" component={ServerView} />
        <Route path="/import" component={Import} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RosterProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </RosterProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

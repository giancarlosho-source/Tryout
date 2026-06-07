import { useGetPlayerStats, useGetSyncStatus, useTriggerSync } from "@workspace/api-client-react";
import { primaryPosition, positionLabel, positionColor, POSITION_LABELS } from "@/lib/positions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, ClipboardCheck, AlertTriangle, Activity, TrendingUp, Upload, UsersRound } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetPlayerStats();
  const { data: syncStatus } = useGetSyncStatus();
  const triggerSync = useTriggerSync();

  const handleSync = () => {
    triggerSync.mutate({ data: { source: "manual" } });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6 bg-muted/20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Live Tryout Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time overview of evaluations and rankings</p>
        </div>
        <div className="flex items-center gap-4 bg-card px-4 py-2 rounded-lg border shadow-sm">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sync Status</span>
            <span className="text-sm font-medium flex items-center gap-2">
              {syncStatus?.status === 'syncing' ? (
                <><span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" /> Syncing...</>
              ) : syncStatus?.status === 'success' ? (
                <><span className="h-2 w-2 rounded-full bg-green-500" /> Synced</>
              ) : syncStatus?.status === 'error' ? (
                <><span className="h-2 w-2 rounded-full bg-red-500" /> Sync Error</>
              ) : (
                <><span className="h-2 w-2 rounded-full bg-gray-400" /> Idle</>
              )}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-10"
            onClick={handleSync}
            disabled={triggerSync.isPending || syncStatus?.status === 'syncing'}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${triggerSync.isPending || syncStatus?.status === 'syncing' ? 'animate-spin' : ''}`} />
            Refresh Now
          </Button>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-10 w-20 bg-muted rounded animate-pulse" />
            ) : (
              <div className="text-4xl font-black">{stats?.totalPlayers || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Registered for tryout</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Checked In</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-10 w-20 bg-muted rounded animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-black text-primary">{stats?.checkedIn || 0}</div>
                <div className="text-sm font-medium text-muted-foreground">/ {stats?.totalPlayers || 0}</div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Currently in gym</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evaluated</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-10 w-20 bg-muted rounded animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-black">{stats?.evaluated || 0}</div>
                <div className="text-sm font-medium text-muted-foreground">players</div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">With at least one score</p>
          </CardContent>
        </Card>

        <Card className={stats?.missingMeasurements ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "hover-elevate"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${stats?.missingMeasurements ? 'text-red-600 dark:text-red-400' : ''}`}>
              Missing Measurements
            </CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats?.missingMeasurements ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-10 w-20 bg-muted rounded animate-pulse" />
            ) : (
              <div className={`text-4xl font-black ${stats?.missingMeasurements ? 'text-red-600 dark:text-red-400' : ''}`}>
                {stats?.missingMeasurements || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Need height/reach/jump</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>By Position</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {statsLoading ? (
              <div className="space-y-4">
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-32 h-4 bg-muted rounded animate-pulse" />
                    <div className="flex-1 h-4 bg-muted rounded-full animate-pulse" />
                    <div className="w-8 h-4 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (() => {
              // Normalize: group all variants by primary position key
              const POSITION_ORDER = ["Setter", "OutsideHitter", "MiddleBlocker", "Opposite", "Libero", "Undecided"];
              const grouped: Record<string, number> = {};
              for (const pos of (stats?.byPosition ?? [])) {
                const key = primaryPosition(pos.position);
                grouped[key] = (grouped[key] ?? 0) + pos.count;
              }
              const rows = POSITION_ORDER
                .map((key) => ({ key, count: grouped[key] ?? 0 }))
                .filter((r) => r.count > 0);
              const total = stats?.totalPlayers || 1;

              return rows.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">No players imported yet.</div>
              ) : (
                <div className="space-y-3">
                  {rows.map(({ key, count }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-32 text-sm font-semibold truncate">{positionLabel(key)}</div>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${positionColor(key).split(" ")[0].replace("bg-", "bg-").replace("-100", "-400")}`}
                          style={{ width: `${(count / total) * 100}%` }}
                        />
                      </div>
                      <div className="w-8 text-right text-sm font-black tabular-nums">{count}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="text-lg font-bold tracking-tight">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/players" className="block">
              <Card className="hover-elevate cursor-pointer h-full transition-colors hover:border-primary/50">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="p-3 bg-primary/10 text-primary rounded-full">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="font-bold">Player List</div>
                  <div className="text-xs text-muted-foreground">View and filter all players</div>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/rankings" className="block">
              <Card className="hover-elevate cursor-pointer h-full transition-colors hover:border-primary/50">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="p-3 bg-primary/10 text-primary rounded-full">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div className="font-bold">Live Rankings</div>
                  <div className="text-xs text-muted-foreground">Sort by overall or position</div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/roster" className="block">
              <Card className="hover-elevate cursor-pointer h-full transition-colors hover:border-primary/50">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="p-3 bg-primary/10 text-primary rounded-full">
                    <UsersRound className="h-6 w-6" />
                  </div>
                  <div className="font-bold">Roster Builder</div>
                  <div className="text-xs text-muted-foreground">Draft your final 12</div>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/import" className="block">
              <Card className="hover-elevate cursor-pointer h-full transition-colors hover:border-primary/50">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="p-3 bg-primary/10 text-primary rounded-full">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="font-bold">Import CSV</div>
                  <div className="text-xs text-muted-foreground">Load registration data</div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

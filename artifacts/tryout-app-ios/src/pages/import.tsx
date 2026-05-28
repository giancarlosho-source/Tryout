import { useState, useRef, useEffect } from "react";
import {
  useImportPlayersCsv,
  useSyncFromGoogleSheets,
  useGetPlayerStats,
  getListPlayersQueryKey,
  getGetPlayerStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, AlertCircle, FileText, X, Sheet, RefreshCw, Info, Trash2, Loader2 } from "lucide-react";

const SAMPLE_CSV = `jerseyNumber,name,position,checkedIn,height,standingReachInches,verticalJump
1,Emma Rodriguez,Setter,true,68,84,24
3,Maya Johnson,OutsideHitter,true,72,90,28
7,Olivia Chen,MiddleBlocker,true,74,92,29
9,Chloe Brown,Opposite,true,73,90,30
11,Isabella Moore,Libero,true,64,78,20`;

type ImportResult = { imported: number; updated: number; errors: string[] };

function ResultCard({ result }: { result: ImportResult }) {
  const hasErrors = result.errors.length > 0;
  const hasSuccess = result.imported > 0 || result.updated > 0;
  return (
    <Card className={hasErrors && !hasSuccess ? "border-red-200 bg-red-50/50" : hasErrors ? "border-yellow-200 bg-yellow-50/50" : "border-green-200 bg-green-50/50"}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          {result.imported > 0 && (
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              {result.imported} player{result.imported !== 1 ? "s" : ""} imported
            </div>
          )}
          {result.updated > 0 && (
            <div className="flex items-center gap-2 text-blue-700 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              {result.updated} player{result.updated !== 1 ? "s" : ""} updated
            </div>
          )}
          {!hasSuccess && !hasErrors && (
            <div className="text-muted-foreground">No changes made.</div>
          )}
        </div>
        {hasErrors && (
          <div className="space-y-1">
            {result.errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-yellow-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-yellow-600" />
                {err}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Import() {
  const queryClient = useQueryClient();

  // CSV state
  const [csvText, setCsvText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [csvResult, setCsvResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Sheets state
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [tabs, setTabs] = useState<string[] | null>(null);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [sheetGid, setSheetGid] = useState<string | null>(null);
  const [checkedInOnly, setCheckedInOnly] = useState(false);
  const [sheetsResult, setSheetsResult] = useState<ImportResult | null>(null);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  // Extract sheet ID from URL to detect valid URLs
  function extractSheetId(input: string): string | null {
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  // Fetch tabs whenever a valid sheet URL is entered
  useEffect(() => {
    const id = extractSheetId(sheetUrl);
    if (!id) { setTabs(null); return; }
    setTabsLoading(true);
    setTabs(null);
    setSheetName("");
    const params = new URLSearchParams({ sheetUrl: sheetUrl.trim() });
    fetch(`${import.meta.env.BASE_URL}api/sync/sheets/tabs?${params}`)
      .then((r) => r.json())
      .then((data: { tabs?: string[]; gid?: string }) => { setTabs(data.tabs ?? []); setSheetGid(data.gid ?? null); })
      .catch(() => { setTabs([]); })
      .finally(() => setTabsLoading(false));
  }, [sheetUrl]);

  const [confirmClear, setConfirmClear] = useState(false);
  const { data: playerStats } = useGetPlayerStats();

  const importCsv = useImportPlayersCsv();
  const syncSheets = useSyncFromGoogleSheets();

  const clearAllPlayers = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/players/all`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear players");
    },
    onSuccess: () => {
      setConfirmClear(false);
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey() });
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey() });
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setCsvText(e.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "text/csv" || file?.name.endsWith(".csv")) handleFile(file);
  };

  const handleCsvImport = () => {
    if (!csvText.trim()) return;
    importCsv.mutate(
      { data: { csvData: csvText } },
      {
        onSuccess: (data) => { setCsvResult(data); invalidateAll(); },
        onError: () => setCsvResult({ imported: 0, updated: 0, errors: ["Import failed. Check your CSV format and try again."] }),
      }
    );
  };

  const hasMultipleTabs = tabs && tabs.length > 1;
  const canSync = sheetUrl.trim() && !tabsLoading && (!hasMultipleTabs || sheetName.trim());

  const handleSheetsSync = () => {
    if (!canSync) return;
    setSheetsError(null);
    setSheetsResult(null);
    syncSheets.mutate(
      { data: { sheetUrl: sheetUrl.trim(), ...(sheetName.trim() ? { sheetName: sheetName.trim() } : {}), ...(sheetGid ? { gid: sheetGid } : {}), ...(checkedInOnly ? { checkedInOnly: true } : {}) } },
      {
        onSuccess: (data) => { setSheetsResult(data); invalidateAll(); },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
            ?? "Sync failed. Check that the sheet is shared with your connected Google account.";
          setSheetsError(msg);
        },
      }
    );
  };

  const lineCount = csvText.trim().split("\n").filter(Boolean).length;
  const dataRows = Math.max(0, lineCount - 1);

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      <div className="flex-none p-6 pb-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Import Players</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Sync from Google Sheets or upload a CSV. Jersey number is the unique key — existing players are updated, not duplicated. Evaluation scores are never overwritten.
            </p>
          </div>
          <div className="flex-shrink-0">
            {!confirmClear ? (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 className="h-4 w-4" />
                Clear All Players
              </Button>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/40 bg-destructive/5">
                <span className="text-sm font-semibold text-destructive">Delete all {playerStats?.totalPlayers ?? "..."} players and their eval scores?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => clearAllPlayers.mutate()}
                  disabled={clearAllPlayers.isPending}
                >
                  {clearAllPlayers.isPending ? "Deleting…" : "Yes, delete all"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8 max-w-3xl">

        {/* ── Google Sheets Sync ── */}
        <Card className="border-2 border-green-200 bg-green-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Sheet className="h-5 w-5 text-green-700" />
              Google Sheets Sync
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs font-bold">Connected</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Paste your Google Sheet URL below, then click <strong>Sync Now</strong>.
            </p>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 mt-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>Required:</strong> In Google Sheets, click <strong>Share</strong> → set access to <strong>"Anyone with the link"</strong> (Viewer). The sync will not work without this setting.
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Sheet URL or ID</label>
              <div className="relative">
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl}
                  onChange={(e) => { setSheetUrl(e.target.value); setSheetsError(null); setSheetsResult(null); }}
                  className="font-mono text-sm pr-8"
                />
                {tabsLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground absolute right-2.5 top-2.5" />
                )}
              </div>
            </div>
            {extractSheetId(sheetUrl) && (
              <div className="space-y-2">
                <label className="text-sm font-semibold">
                  Tab / Sheet
                  {hasMultipleTabs && <span className="text-destructive ml-1">*</span>}
                  {!hasMultipleTabs && <span className="text-muted-foreground font-normal ml-1">(optional — defaults to first tab)</span>}
                </label>
                {tabsLoading ? (
                  <div className="h-9 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading tabs…
                  </div>
                ) : tabs && tabs.length > 1 ? (
                  <>
                    <Select value={sheetName} onValueChange={setSheetName}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select a tab…" />
                      </SelectTrigger>
                      <SelectContent>
                        {tabs.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!sheetName && (
                      <p className="text-xs text-destructive">Please select a tab to import from.</p>
                    )}
                  </>
                ) : (
                  <Input
                    placeholder="e.g. Players"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="text-sm"
                  />
                )}
              </div>
            )}

            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-800">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Expected columns: <code className="font-mono bg-blue-100 px-1 rounded">jerseyNumber</code>, <code className="font-mono bg-blue-100 px-1 rounded">name</code>, <code className="font-mono bg-blue-100 px-1 rounded">position</code> (required) + <code className="font-mono bg-blue-100 px-1 rounded">checkedIn</code>, <code className="font-mono bg-blue-100 px-1 rounded">height</code>, <code className="font-mono bg-blue-100 px-1 rounded">standingReachInches</code>, <code className="font-mono bg-blue-100 px-1 rounded">verticalJump</code> (optional)</span>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                role="checkbox"
                aria-checked={checkedInOnly}
                tabIndex={0}
                onClick={() => setCheckedInOnly((v) => !v)}
                onKeyDown={(e) => e.key === " " && setCheckedInOnly((v) => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${checkedInOnly ? "bg-green-600" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checkedInOnly ? "translate-x-5" : ""}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">
                Tryout day mode — import checked-in players only
              </span>
            </label>

            <Button
              className="w-full h-11 font-bold bg-green-700 hover:bg-green-800 text-white"
              disabled={!canSync || syncSheets.isPending}
              onClick={handleSheetsSync}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncSheets.isPending ? "animate-spin" : ""}`} />
              {syncSheets.isPending ? "Syncing from Google Sheets..." : "Sync Now"}
            </Button>

            {sheetsError && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {sheetsError}
              </div>
            )}
            {sheetsResult && <ResultCard result={sheetsResult} />}
          </CardContent>
        </Card>

        {/* ── CSV Import ── */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">CSV Import</h2>
            <p className="text-sm text-muted-foreground">Paste CSV data or upload a file.</p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Expected Columns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: "jerseyNumber", required: true },
                  { name: "name", required: true },
                  { name: "position", required: true },
                  { name: "checkedIn", required: false },
                  { name: "height", required: false },
                  { name: "standingReachInches", required: false },
                  { name: "verticalJump", required: false },
                ].map((col) => (
                  <div key={col.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/60 border text-sm font-mono">
                    <span>{col.name}</span>
                    {col.required ? (
                      <Badge variant="default" className="text-xs px-1.5 py-0 h-4 bg-primary">required</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">optional</Badge>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted-foreground space-y-1">
                <div>Position values: <code className="bg-muted px-1 rounded">Setter</code>, <code className="bg-muted px-1 rounded">OutsideHitter</code>, <code className="bg-muted px-1 rounded">MiddleBlocker</code>, <code className="bg-muted px-1 rounded">Opposite</code>, <code className="bg-muted px-1 rounded">Libero</code></div>
                <div>Also accepts: <code className="bg-muted px-1 rounded">OH</code>, <code className="bg-muted px-1 rounded">MB</code>, <code className="bg-muted px-1 rounded">OPP</code>, <code className="bg-muted px-1 rounded">S</code>, <code className="bg-muted px-1 rounded">L</code>, <code className="bg-muted px-1 rounded">DS</code></div>
              </div>
            </CardContent>
          </Card>

          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold text-muted-foreground">Drop a CSV file here, or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Only .csv files</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Or paste CSV data directly</label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={() => setCsvText(SAMPLE_CSV)}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> Load sample
                </Button>
                {csvText && (
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={() => { setCsvText(""); setCsvResult(null); }}>
                    <X className="h-3.5 w-3.5 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); setCsvResult(null); }}
              placeholder={"jerseyNumber,name,position,checkedIn,height,standingReachInches,verticalJump\n1,Jane Smith,Setter,true,68,84,24\n..."}
              className="font-mono text-sm min-h-[200px] resize-y"
            />
            {csvText && (
              <p className="text-xs text-muted-foreground">{lineCount} lines — {dataRows} data row{dataRows !== 1 ? "s" : ""} detected</p>
            )}
          </div>

          <Button
            className="w-full h-12 text-base font-bold"
            disabled={!csvText.trim() || importCsv.isPending}
            onClick={handleCsvImport}
          >
            <Upload className={`h-5 w-5 mr-2 ${importCsv.isPending ? "animate-bounce" : ""}`} />
            {importCsv.isPending ? "Importing..." : `Import ${dataRows > 0 ? `${dataRows} Row${dataRows !== 1 ? "s" : ""}` : "CSV"}`}
          </Button>

          {csvResult && <ResultCard result={csvResult} />}
        </div>
      </div>
    </div>
  );
}

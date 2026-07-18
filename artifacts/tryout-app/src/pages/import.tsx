import { useState, useRef, useEffect, useCallback } from "react";

const HELP = {
  title: "Import",
  description: "Load your players and coaches from a CSV file or Google Sheet instead of adding them one by one.",
  steps: [
    { step: 1, text: "Download the template for players or coaches, fill it in, and upload it." },
    { step: 2, text: "Google Sheets: paste the share URL of your sheet (must be 'Anyone with link can view'). Click Sync." },
    { step: 3, text: "Existing players are matched by jersey number and updated — not duplicated. Evaluation scores are never overwritten." },
    { step: 4, text: "Coaches are matched by name — re-importing updates their role." },
  ],
  tips: [
    "Run the import before tryout day so players are already in the system when iPads start.",
    "You can re-import anytime to pick up roster changes — it's safe to run multiple times.",
  ],
};
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
import { Upload, CheckCircle2, AlertCircle, FileText, X, Sheet, RefreshCw, Info, Trash2, Loader2, Download, Users, UserCheck } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── Templates ────────────────────────────────────────────────────────────────

const PLAYER_TEMPLATE = `jerseyNumber,name,position,age,height,standingReachInches,verticalJump
1,Emma Rodriguez,Setter,16,68,84,24
3,Maya Johnson,OutsideHitter,17,72,90,28
7,Olivia Chen,MiddleBlocker,16,74,92,29
9,Chloe Brown,Opposite,17,73,90,30
11,Isabella Moore,Libero,16,64,78,20`;

const COACH_TEMPLATE = `name,teamName
Sarah Johnson,Evaluator
Mike Chen,Court Coach
Amanda Torres,Evaluator
David Park,Head Coach`;

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Shared components ─────────────────────────────────────────────────────────

type ImportResult = { imported: number; updated: number; errors: string[] };

function ResultCard({ result, noun = "player" }: { result: ImportResult; noun?: string }) {
  const hasErrors = result.errors.length > 0;
  const hasSuccess = result.imported > 0 || result.updated > 0;
  return (
    <Card className={hasErrors && !hasSuccess ? "border-red-200 bg-red-50/50" : hasErrors ? "border-yellow-200 bg-yellow-50/50" : "border-green-200 bg-green-50/50"}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          {result.imported > 0 && (
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              {result.imported} {noun}{result.imported !== 1 ? "s" : ""} imported
            </div>
          )}
          {result.updated > 0 && (
            <div className="flex items-center gap-2 text-blue-700 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              {result.updated} {noun}{result.updated !== 1 ? "s" : ""} updated
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

// ── Main component ────────────────────────────────────────────────────────────

export default function Import() {
  const queryClient = useQueryClient();

  // Player CSV state
  const [csvText, setCsvText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [csvResult, setCsvResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Coach CSV state
  const [coachCsvText, setCoachCsvText] = useState("");
  const [coachDragOver, setCoachDragOver] = useState(false);
  const [coachResult, setCoachResult] = useState<ImportResult | null>(null);
  const [coachImporting, setCoachImporting] = useState(false);
  const coachFileInputRef = useRef<HTMLInputElement>(null);

  const DEFAULT_SHEET_URL = "";

  // Google Sheets state
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_SHEET_URL);
  const [sheetName, setSheetName] = useState("");
  const [tabs, setTabs] = useState<string[] | null>(null);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [sheetGid, setSheetGid] = useState<string | null>(null);
  const [sheetsResult, setSheetsResult] = useState<ImportResult | null>(null);
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  function extractSheetId(input: string): string | null {
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  useEffect(() => {
    const id = extractSheetId(sheetUrl);
    if (!id) { setTabs(null); return; }
    setTabsLoading(true);
    setTabs(null);
    setSheetName("");
    const params = new URLSearchParams({ sheetUrl: sheetUrl.trim() });
    fetch(`${API_BASE}/api/sync/sheets/tabs?${params}`)
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
      const res = await fetch(`${API_BASE}/api/players/all`, { method: "DELETE" });
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

  const handleCoachFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setCoachCsvText(e.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "text/csv" || file?.name.endsWith(".csv")) handleFile(file);
  };

  const handleCoachDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCoachDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "text/csv" || file?.name.endsWith(".csv")) handleCoachFile(file);
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

  const handleCoachImport = async () => {
    if (!coachCsvText.trim()) return;
    setCoachImporting(true);
    setCoachResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/coaches/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData: coachCsvText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCoachResult({ imported: 0, updated: 0, errors: [data.error ?? "Import failed."] });
      } else {
        setCoachResult(data);
      }
    } catch {
      setCoachResult({ imported: 0, updated: 0, errors: ["Could not reach server. Try again."] });
    } finally {
      setCoachImporting(false);
    }
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        if (data.sheetUrl) setSheetUrl(data.sheetUrl); else setSheetUrl(DEFAULT_SHEET_URL);
        if (data.sheetName) setSheetName(data.sheetName);
      })
      .catch(() => {})
      .finally(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    const t = setTimeout(() => {
      fetch(`${API_BASE}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl, sheetName }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [sheetUrl, sheetName, settingsLoaded]);

  const hasMultipleTabs = tabs && tabs.length > 1;
  const canSync = sheetUrl.trim() && !tabsLoading && (!hasMultipleTabs || sheetName.trim());

  const handleSheetsSync = useCallback(() => {
    if (!sheetUrl.trim()) return;
    setSheetsError(null);
    syncSheets.mutate(
      { data: { sheetUrl: sheetUrl.trim(), ...(sheetName.trim() ? { sheetName: sheetName.trim() } : {}), ...(sheetGid ? { gid: sheetGid } : {}) } },
      {
        onSuccess: (data) => { setSheetsResult(data); invalidateAll(); },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
            ?? "Sync failed. Check that the sheet is shared with your connected Google account.";
          setSheetsError(msg);
        },
      }
    );
  }, [sheetUrl, sheetName, sheetGid, syncSheets]);


  const lineCount = csvText.trim().split("\n").filter(Boolean).length;
  const dataRows = Math.max(0, lineCount - 1);
  const coachLineCount = coachCsvText.trim().split("\n").filter(Boolean).length;
  const coachDataRows = Math.max(0, coachLineCount - 1);

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      <div className="flex-none p-6 pb-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Import</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Load players and coaches from CSV templates or Google Sheets. Existing records are updated, not duplicated.
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
                <Button size="sm" variant="destructive" onClick={() => clearAllPlayers.mutate()} disabled={clearAllPlayers.isPending}>
                  {clearAllPlayers.isPending ? "Deleting…" : "Yes, delete all"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-10 max-w-3xl">

        {/* ── Players Section ── */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Players</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 font-semibold"
              onClick={() => downloadCsv("players-template.csv", PLAYER_TEMPLATE)}
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>

          {/* Google Sheets Sync */}
          <Card className="border-2 border-green-200 bg-green-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Sheet className="h-5 w-5 text-green-700" />
                Google Sheets Sync
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs font-bold">Connected</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">Paste your Google Sheet URL and click Sync Now.</p>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 mt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                <span><strong>Required:</strong> In Google Sheets, click <strong>Share</strong> → set access to <strong>"Anyone with the link"</strong> (Viewer).</span>
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
                  {tabsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground absolute right-2.5 top-2.5" />}
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
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Select a tab…" /></SelectTrigger>
                        <SelectContent>
                          {tabs.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {!sheetName && <p className="text-xs text-destructive">Please select a tab to import from.</p>}
                    </>
                  ) : (
                    <Input placeholder="e.g. Players" value={sheetName} onChange={(e) => setSheetName(e.target.value)} className="text-sm" />
                  )}
                </div>
              )}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-800">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Expected columns: <code className="font-mono bg-blue-100 px-1 rounded">jerseyNumber</code>, <code className="font-mono bg-blue-100 px-1 rounded">name</code>, <code className="font-mono bg-blue-100 px-1 rounded">position</code> (required) + <code className="font-mono bg-blue-100 px-1 rounded">age</code>, <code className="font-mono bg-blue-100 px-1 rounded">height</code>, <code className="font-mono bg-blue-100 px-1 rounded">standingReachInches</code>, <code className="font-mono bg-blue-100 px-1 rounded">verticalJump</code> (optional)</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                <span>Sync before your tryout starts — not during. Re-syncing mid-tryout can overwrite player names and jersey numbers.</span>
              </div>
              <Button className="w-full h-11 font-bold bg-green-700 hover:bg-green-800 text-white" disabled={!canSync || syncSheets.isPending} onClick={handleSheetsSync}>
                <RefreshCw className={`h-4 w-4 mr-2 ${syncSheets.isPending ? "animate-spin" : ""}`} />
                {syncSheets.isPending ? "Syncing from Google Sheets..." : "Sync Now"}
              </Button>
              {sheetsError && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{sheetsError}
                </div>
              )}
              {sheetsResult && <ResultCard result={sheetsResult} />}
            </CardContent>
          </Card>

          {/* Player CSV Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">CSV Upload</CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload the players template or any CSV with the required columns.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { name: "jerseyNumber", required: true },
                  { name: "name", required: true },
                  { name: "position", required: true },
                  { name: "age", required: false },
                  { name: "height", required: false },
                  { name: "standingReachInches", required: false },
                  { name: "verticalJump", required: false },
                ].map((col) => (
                  <div key={col.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/60 border text-sm font-mono">
                    <span>{col.name}</span>
                    {col.required
                      ? <Badge variant="default" className="text-xs px-1.5 py-0 h-4 bg-primary">required</Badge>
                      : <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">optional</Badge>}
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Position values: <code className="bg-muted px-1 rounded">Setter</code>, <code className="bg-muted px-1 rounded">OutsideHitter</code>, <code className="bg-muted px-1 rounded">MiddleBlocker</code>, <code className="bg-muted px-1 rounded">Opposite</code>, <code className="bg-muted px-1 rounded">Libero</code> — also accepts <code className="bg-muted px-1 rounded">S</code>, <code className="bg-muted px-1 rounded">OH</code>, <code className="bg-muted px-1 rounded">MB</code>, <code className="bg-muted px-1 rounded">OPP</code>, <code className="bg-muted px-1 rounded">L</code>
              </div>

              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="font-semibold text-muted-foreground">Drop a CSV file here, or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Only .csv files</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Or paste CSV data directly</label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7"
                      onClick={() => setCsvText(PLAYER_TEMPLATE)}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Load sample
                    </Button>
                    {csvText && (
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7"
                        onClick={() => { setCsvText(""); setCsvResult(null); }}>
                        <X className="h-3.5 w-3.5 mr-1" /> Clear
                      </Button>
                    )}
                  </div>
                </div>
                <Textarea
                  value={csvText}
                  onChange={(e) => { setCsvText(e.target.value); setCsvResult(null); }}
                  placeholder={"jerseyNumber,name,position,age,height\n1,Jane Smith,Setter,16,68\n..."}
                  className="font-mono text-sm min-h-[160px] resize-y"
                />
                {csvText && <p className="text-xs text-muted-foreground">{lineCount} lines — {dataRows} data row{dataRows !== 1 ? "s" : ""} detected</p>}
              </div>

              <Button className="w-full h-12 text-base font-bold" disabled={!csvText.trim() || importCsv.isPending} onClick={handleCsvImport}>
                <Upload className={`h-5 w-5 mr-2 ${importCsv.isPending ? "animate-bounce" : ""}`} />
                {importCsv.isPending ? "Importing..." : `Import ${dataRows > 0 ? `${dataRows} Player${dataRows !== 1 ? "s" : ""}` : "Players"}`}
              </Button>

              {csvResult && <ResultCard result={csvResult} />}
            </CardContent>
          </Card>
        </div>

        {/* ── Coaches Section ── */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Coaches</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 font-semibold"
              onClick={() => downloadCsv("coaches-template.csv", COACH_TEMPLATE)}
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">CSV Upload</CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload the coaches template. Coaches are matched by name — re-importing updates their role.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { name: "name", required: true },
                  { name: "teamName", required: true },
                ].map((col) => (
                  <div key={col.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/60 border text-sm font-mono">
                    <span>{col.name}</span>
                    <Badge variant="default" className="text-xs px-1.5 py-0 h-4 bg-primary">required</Badge>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Role values: <code className="bg-muted px-1 rounded">Evaluator</code>, <code className="bg-muted px-1 rounded">Court Coach</code>, <code className="bg-muted px-1 rounded">Head Coach</code>, <code className="bg-muted px-1 rounded">Assistant Coach</code>, <code className="bg-muted px-1 rounded">Staff</code>
              </div>

              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${coachDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"}`}
                onDragOver={(e) => { e.preventDefault(); setCoachDragOver(true); }}
                onDragLeave={() => setCoachDragOver(false)}
                onDrop={handleCoachDrop}
                onClick={() => coachFileInputRef.current?.click()}
              >
                <input ref={coachFileInputRef} type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoachFile(f); }} />
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="font-semibold text-muted-foreground">Drop a CSV file here, or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Only .csv files</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Or paste CSV data directly</label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7"
                      onClick={() => setCoachCsvText(COACH_TEMPLATE)}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Load sample
                    </Button>
                    {coachCsvText && (
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7"
                        onClick={() => { setCoachCsvText(""); setCoachResult(null); }}>
                        <X className="h-3.5 w-3.5 mr-1" /> Clear
                      </Button>
                    )}
                  </div>
                </div>
                <Textarea
                  value={coachCsvText}
                  onChange={(e) => { setCoachCsvText(e.target.value); setCoachResult(null); }}
                  placeholder={"name,teamName\nSarah Johnson,Evaluator\nMike Chen,Court Coach\n..."}
                  className="font-mono text-sm min-h-[120px] resize-y"
                />
                {coachCsvText && <p className="text-xs text-muted-foreground">{coachLineCount} lines — {coachDataRows} data row{coachDataRows !== 1 ? "s" : ""} detected</p>}
              </div>

              <Button className="w-full h-12 text-base font-bold" disabled={!coachCsvText.trim() || coachImporting} onClick={handleCoachImport}>
                <Upload className={`h-5 w-5 mr-2 ${coachImporting ? "animate-bounce" : ""}`} />
                {coachImporting ? "Importing..." : `Import ${coachDataRows > 0 ? `${coachDataRows} Coach${coachDataRows !== 1 ? "es" : ""}` : "Coaches"}`}
              </Button>

              {coachResult && <ResultCard result={coachResult} noun="coach" />}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

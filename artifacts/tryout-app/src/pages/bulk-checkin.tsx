import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListPlayersQueryKey } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, Hash, Trash2, ScanLine } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type CheckedPlayer = { id: number; jerseyNumber: string; name: string };
type Result = { checked: CheckedPlayer[]; notFound: string[] };

type QueueEntry =
  | { type: "success"; jerseyNumber: string; name: string }
  | { type: "notfound"; jerseyNumber: string };

export default function BulkCheckIn() {
  const [input, setInput] = useState("");
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Extract jersey numbers: split on whitespace, commas, newlines
  const parseNumbers = (raw: string) =>
    raw
      .split(/[\s,]+/)
      .map((s) => s.replace(/^#/, "").trim())
      .filter(Boolean);

  const submit = useCallback(
    async (raw: string) => {
      const nums = parseNumbers(raw);
      if (nums.length === 0) return;

      setSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/api/players/bulk-checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jerseyNumbers: nums }),
        });
        if (!res.ok) throw new Error("Server error");
        const data: Result = await res.json();

        const newEntries: QueueEntry[] = [
          ...data.checked.map((p) => ({
            type: "success" as const,
            jerseyNumber: p.jerseyNumber ?? "",
            name: p.name,
          })),
          ...data.notFound.map((n) => ({ type: "notfound" as const, jerseyNumber: n })),
        ];

        // Sort so successes come first, then not-found, matching original order
        const orderMap = new Map(nums.map((n, i) => [n, i]));
        newEntries.sort((a, b) => (orderMap.get(a.jerseyNumber) ?? 99) - (orderMap.get(b.jerseyNumber) ?? 99));

        setQueue((prev) => [...newEntries, ...prev]);
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey({}) });
      } catch {
        // Show all as errors if request fails
        setQueue((prev) => [
          ...nums.map((n) => ({ type: "notfound" as const, jerseyNumber: n })),
          ...prev,
        ]);
      } finally {
        setSubmitting(false);
        setInput("");
        inputRef.current?.focus();
      }
    },
    [queryClient]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === ",") {
      e.preventDefault();
      submit(input);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    const nums = parseNumbers(text);
    if (nums.length > 1) {
      // Multi-value paste → submit immediately
      e.preventDefault();
      submit(text);
    }
    // Single value: let it land in the input naturally
  };

  const successCount = queue.filter((e) => e.type === "success").length;
  const errorCount = queue.filter((e) => e.type === "notfound").length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-none p-6 pb-4 border-b">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ScanLine className="h-6 w-6 text-green-600" /> Bulk Check-In
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Type or scan jersey numbers — press Enter or Space after each one
            </p>
          </div>
          {queue.length > 0 && (
            <div className="flex items-center gap-3">
              {successCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {successCount} checked in
                </span>
              )}
              {errorCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                  <XCircle className="h-3.5 w-3.5" /> {errorCount} not found
                </span>
              )}
              <button
                onClick={() => setQueue([])}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear log
              </button>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="mt-4 relative max-w-lg">
          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            inputMode="numeric"
            placeholder="Jersey number — Enter or Space to confirm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={submitting}
            className="w-full pl-12 pr-4 h-14 text-xl font-bold rounded-xl border-2 border-input bg-white shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all disabled:opacity-50 tabular-nums"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 ml-1">
          Paste a list of numbers to check in multiple at once
        </p>
      </div>

      {/* Log */}
      <div className="flex-1 overflow-auto p-6">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <ScanLine className="h-14 w-14 opacity-10" />
            <p className="font-semibold text-lg">Waiting for jerseys</p>
            <p className="text-sm">Scan a barcode or type a number above</p>
          </div>
        ) : (
          <div className="max-w-lg space-y-2">
            {queue.map((entry, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl border-2 transition-all
                  ${entry.type === "success"
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"}`}
              >
                <span className="text-2xl font-black tabular-nums w-14 text-right shrink-0">
                  #{entry.jerseyNumber}
                </span>
                <div className="flex-1 min-w-0">
                  {entry.type === "success" ? (
                    <div className="font-bold text-green-800 truncate">{entry.name}</div>
                  ) : (
                    <div className="font-semibold text-red-600">Not found</div>
                  )}
                </div>
                {entry.type === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

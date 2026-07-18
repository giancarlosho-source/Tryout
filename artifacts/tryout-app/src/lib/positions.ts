// Jersey colors match the actual tryout jersey colors:
// Pink = Setter, Purple = Outside/Opposite, Red = Middle Blocker, Teal = Libero/DS
export const POSITION_COLORS: Record<string, string> = {
  Setter: "bg-pink-100 text-pink-700 border-pink-200",
  OutsideHitter: "bg-purple-100 text-purple-700 border-purple-200",
  MiddleBlocker: "bg-red-100 text-red-700 border-red-200",
  Opposite: "bg-purple-100 text-purple-700 border-purple-200",
  Libero: "bg-teal-100 text-teal-700 border-teal-200",
};

export const POSITION_LABELS: Record<string, string> = {
  Setter: "Setter",
  OutsideHitter: "Outside Hitter",
  MiddleBlocker: "Middle Blocker",
  Opposite: "Opposite",
  Libero: "Libero/DS",
};

const NORMALIZE: Record<string, string> = {
  "outside hitter": "OutsideHitter",
  "oh": "OutsideHitter",
  "middle blocker": "MiddleBlocker",
  "mb": "MiddleBlocker",
  "middle": "MiddleBlocker",
  "setter": "Setter",
  "s": "Setter",
  "opposite": "Opposite",
  "opp": "Opposite",
  "rs": "Opposite",
  "right side": "Opposite",
  "libero": "Libero",
  "l": "Libero",
  "defensive specialist": "Libero",
  "ds": "Libero",
  "libero/ds": "Libero",
};

export function primaryPosition(position: string | null | undefined): string {
  if (!position) return "";
  const raw = position.split("/")[0].trim();
  return NORMALIZE[raw.toLowerCase()] ?? raw;
}

export function secondaryPosition(position: string | null | undefined): string | null {
  if (!position) return null;
  const parts = position.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : null;
}

const POSITION_BAR_COLORS: Record<string, string> = {
  Setter: "#ec4899",       // pink-500
  OutsideHitter: "#a855f7", // purple-500
  MiddleBlocker: "#ef4444", // red-500
  Opposite: "#a855f7",      // purple-500
  Libero: "#14b8a6",        // teal-500
};

export function positionColor(position: string): string {
  return POSITION_COLORS[primaryPosition(position)] ?? "bg-secondary/10 text-secondary-foreground border-secondary/20";
}

export function positionBarColor(position: string): string {
  return POSITION_BAR_COLORS[primaryPosition(position)] ?? "#94a3b8";
}

export function positionLabel(position: string): string {
  return POSITION_LABELS[primaryPosition(position)] ?? primaryPosition(position);
}

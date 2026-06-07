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

export function primaryPosition(position: string): string {
  return position.split("/")[0];
}

export function secondaryPosition(position: string): string | null {
  const parts = position.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : null;
}

export function positionColor(position: string): string {
  return POSITION_COLORS[primaryPosition(position)] ?? "bg-secondary/10 text-secondary-foreground border-secondary/20";
}

export function positionLabel(position: string): string {
  return POSITION_LABELS[primaryPosition(position)] ?? primaryPosition(position);
}

// All valid player position labels — first segment is the primary slot
export const POSITION_LABELS = [
  "Setter",
  "Setter/PIN",
  "Setter/DS",
  "PIN/Setter",
  "PIN/MB",
  "PIN/DS",
  "PIN",
  "MB/PIN",
  "DS/Setter",
  "DS/PIN",
  "DS/L",
  "Undecided",
] as const;

export type PositionLabel = typeof POSITION_LABELS[number];

// Primary slot each label maps to (used for scoring, roster slots, filtering)
export const PRIMARY_POSITION: Record<string, "Setter" | "PIN" | "MB" | "DS"> = {
  "Setter":     "Setter",
  "Setter/PIN": "Setter",
  "Setter/DS":  "Setter",
  "PIN/Setter": "PIN",
  "PIN/MB":     "PIN",
  "PIN/DS":     "PIN",
  "PIN":        "PIN",
  "MB/PIN":     "MB",
  "DS/Setter":  "DS",
  "DS/PIN":     "DS",
  "DS/L":       "DS",
  "Undecided":  "PIN", // fallback
};

export function getPrimaryPosition(position: string | null | undefined): "Setter" | "PIN" | "MB" | "DS" {
  if (!position) return "PIN";
  return PRIMARY_POSITION[position] ?? (position as "Setter" | "PIN" | "MB" | "DS");
}

// Badge colors by primary position
export const POSITION_COLORS: Record<string, string> = {
  Setter:    "bg-purple-100 text-purple-700 border-purple-200",
  "Setter/PIN": "bg-purple-100 text-purple-700 border-purple-200",
  "Setter/DS":  "bg-purple-100 text-purple-700 border-purple-200",
  "PIN/Setter": "bg-blue-100 text-blue-700 border-blue-200",
  "PIN/MB":     "bg-blue-100 text-blue-700 border-blue-200",
  "PIN/DS":     "bg-blue-100 text-blue-700 border-blue-200",
  PIN:          "bg-blue-100 text-blue-700 border-blue-200",
  "MB/PIN":     "bg-green-100 text-green-700 border-green-200",
  "DS/Setter":  "bg-pink-100 text-pink-700 border-pink-200",
  "DS/PIN":     "bg-pink-100 text-pink-700 border-pink-200",
  "DS/L":       "bg-pink-100 text-pink-700 border-pink-200",
  Undecided:    "bg-gray-100 text-gray-600 border-gray-200",
  // legacy compat
  OutsideHitter: "bg-blue-100 text-blue-700 border-blue-200",
  MiddleBlocker: "bg-green-100 text-green-700 border-green-200",
  Opposite:      "bg-orange-100 text-orange-700 border-orange-200",
  Libero:        "bg-pink-100 text-pink-700 border-pink-200",
};

// Short abbreviation for each position (used in draft badges)
export const POSITION_ABBR: Record<string, string> = {
  "Setter":     "S",
  "Setter/PIN": "S/P",
  "Setter/DS":  "S/DS",
  "PIN/Setter": "P/S",
  "PIN/MB":     "P/MB",
  "PIN/DS":     "P/DS",
  "PIN":        "PIN",
  "MB/PIN":     "MB/P",
  "DS/Setter":  "DS/S",
  "DS/PIN":     "DS/P",
  "DS/L":       "DS/L",
  "Undecided":  "?",
  // legacy compat
  OutsideHitter: "OH",
  MiddleBlocker: "MB",
  Opposite:      "OPP",
  Libero:        "L",
};

// Filter groups for the Players / Draft pages
export const POSITION_FILTER_GROUPS = [
  { label: "Setter", values: ["Setter", "Setter/PIN", "Setter/DS"] },
  { label: "PIN",    values: ["PIN", "PIN/Setter", "PIN/MB", "PIN/DS"] },
  { label: "MB",     values: ["MB/PIN"] },
  { label: "DS",     values: ["DS/Setter", "DS/PIN", "DS/L"] },
  { label: "Undecided", values: ["Undecided"] },
] as const;

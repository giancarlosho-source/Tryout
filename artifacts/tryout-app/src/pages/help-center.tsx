import { useState } from "react";
import { PlayCircle, BookOpen, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { HELP_REGISTRY } from "@/lib/help-content";

const SECTIONS = [
  {
    label: "Setup & Data",
    items: ["/import", "/sessions", "/staff", "/coaches"],
  },
  {
    label: "Day-of Operations",
    items: ["/", "/bulk-checkin", "/coverage", "/players"],
  },
  {
    label: "After Tryouts",
    items: ["/rankings", "/compare", "/draft", "/roster"],
  },
];

// Map path → nav label used in the sidebar
const PATH_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/players": "Players",
  "/rankings": "Rankings",
  "/roster": "Roster",
  "/draft": "Live Draft",
  "/sessions": "Sessions & QR",
  "/bulk-checkin": "Bulk Check-In",
  "/coverage": "Coverage",
  "/coaches": "Coaches",
  "/import": "Import CSV",
  "/staff": "Staff & Roles",
  "/compare": "Compare",
};

function VideoCard({ path }: { path: string }) {
  const content = HELP_REGISTRY[path];
  const [playing, setPlaying] = useState(false);

  if (!content) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Thumbnail / player area */}
      <div className="relative bg-muted aspect-video flex items-center justify-center">
        {content.videoUrl && playing ? (
          <iframe
            src={content.videoUrl + "?autoplay=1"}
            className="absolute inset-0 w-full h-full"
            allowFullScreen
            allow="autoplay; fullscreen"
            title={content.title}
          />
        ) : content.videoUrl ? (
          <button
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 group bg-navy/5 hover:bg-primary/10 transition-colors"
          >
            <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <PlayCircle className="h-8 w-8 text-primary-foreground" />
            </div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Watch video</span>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
            <PlayCircle className="h-10 w-10" />
            <span className="text-xs font-semibold uppercase tracking-wider">Coming soon</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded">
            {PATH_LABELS[path] ?? content.title}
          </span>
        </div>
        <h3 className="font-bold text-sm text-foreground mb-1 leading-snug">{content.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">{content.description}</p>
        <Link
          href={path}
          className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Go to {PATH_LABELS[path] ?? content.title} <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

export default function HelpCenter() {
  const totalVideos = Object.values(HELP_REGISTRY).filter((h) => h.videoUrl).length;
  const total = Object.keys(HELP_REGISTRY).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-muted/20">
      {/* Header */}
      <div className="shrink-0 border-b bg-card px-6 py-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Help Center</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Video walkthroughs for every feature</p>
            </div>
          </div>
          {totalVideos < total && (
            <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-1.5 font-semibold">
              {totalVideos} of {total} videos live — more coming soon
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-10">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                {section.label}
              </h2>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {section.items.map((path) => (
                <VideoCard key={path} path={path} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

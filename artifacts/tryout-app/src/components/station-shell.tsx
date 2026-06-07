import { useLocation } from "wouter";
import { ArrowLeftRight } from "lucide-react";

interface StationShellProps {
  title: string;
  color: string;
  children: React.ReactNode;
}

export function StationShell({ title, color, children }: StationShellProps) {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className={`${color} text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-md`}>
        <div className="flex items-center gap-3">
          <img src="/tribe-logo.png" alt="" className="h-8 w-8 object-contain opacity-90" onError={(e) => (e.currentTarget.style.display = "none")} />
          <div>
            <div className="text-xs font-bold opacity-70 uppercase tracking-widest">Tribe Tryouts</div>
            <div className="text-lg font-black leading-tight">{title} Station</div>
          </div>
        </div>
        <button
          onClick={() => navigate("/station")}
          className="flex items-center gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Switch Station
        </button>
      </header>
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}

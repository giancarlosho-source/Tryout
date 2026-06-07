import { useEffect } from "react";
import { useLocation } from "wouter";
import { ScanLine, Camera, Ruler, ClipboardCheck, LogOut } from "lucide-react";
import { useStaffAuth } from "./staff-gate";

const ALL_TABS = [
  { path: "/station/checkin", label: "Check-In", icon: ScanLine, roles: ["checkin", "admin"] },
  { path: "/station/photo", label: "Photo", icon: Camera, roles: ["photo", "admin"] },
  { path: "/station/measurements", label: "Measurements", icon: Ruler, roles: ["measurements", "admin"] },
  { path: "/station/evaluation", label: "Evaluation", icon: ClipboardCheck, roles: ["evaluator", "admin"] },
];

interface StationShellProps {
  title?: string;
  color?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function StationShell({ children, actions }: StationShellProps) {
  const [location, navigate] = useLocation();
  const { staff, logout } = useStaffAuth();

  const role = staff?.role ?? "evaluator";
  const tabs = ALL_TABS.filter((t) => t.roles.includes(role));

  // Redirect to first allowed tab if current page isn't allowed
  useEffect(() => {
    const allowed = tabs.some((t) => t.path === location);
    if (!allowed && tabs.length > 0) {
      navigate(tabs[0].path);
    }
  }, [location, role]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Staff header */}
      {staff && (
        <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">{staff.name}</span>
          <div className="flex items-center gap-1">
            {actions}
            <button onClick={logout} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors ml-1">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {children}
      </div>

      {/* Only show tab bar if the role has more than one station */}
      {tabs.length > 1 && (
        <nav className="shrink-0 bg-white border-t border-gray-200 flex">
          {tabs.map(({ path, label, icon: Icon }) => {
            const active = location === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors
                  ${active ? "text-primary" : "text-gray-400 hover:text-gray-600"}`}
              >
                <Icon className={`h-6 w-6 ${active ? "stroke-[2.5]" : "stroke-2"}`} />
                <span className={`text-[10px] font-bold tracking-wide ${active ? "text-primary" : ""}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

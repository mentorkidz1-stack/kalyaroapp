import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/cours", label: "Cours", icon: "📚" },
  { to: "/epreuves", label: "Épreuves", icon: "📝" },
  { to: "/evaluations", label: "Évaluations", icon: "🗒️" },
];

export function StudentTabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex bg-surface border-t border-line">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className="flex-1 flex flex-col items-center gap-1 py-2.5">
          {({ isActive }) => (
            <>
              <span
                className={`w-[22px] h-[22px] rounded-[7px] flex items-center justify-center text-xs transition-colors ${
                  isActive ? "bg-primary" : "bg-line"
                }`}
              >
                {tab.icon}
              </span>
              <span
                className={`font-mono text-[10px] font-bold transition-colors ${
                  isActive ? "text-primary" : "text-ink-soft"
                }`}
              >
                {tab.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

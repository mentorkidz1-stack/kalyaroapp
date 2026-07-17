import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { StreakPill } from "../design-system";

export function AppHeader({
  title,
  subtitle,
  variant = "primary",
  streak,
  onBack,
}: {
  title: string;
  subtitle?: string;
  variant?: "primary" | "deep" | "alert";
  streak?: number;
  onBack?: () => void;
}) {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const bg = variant === "deep" ? "bg-primary-deep" : variant === "alert" ? "bg-alert" : "bg-primary";

  return (
    <div className={`${bg} text-white px-5 py-4`}>
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Retour"
              className="text-lg leading-none opacity-75 hover:opacity-100 shrink-0"
            >
              ✕
            </button>
          )}
          <div>
            {subtitle && <div className="text-[11px] opacity-75 font-mono uppercase tracking-wide">{subtitle}</div>}
            <div className="font-display font-extrabold text-lg leading-tight">{title}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {streak !== undefined && <StreakPill count={streak} />}
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/connexion");
            }}
            className="text-xs font-mono opacity-75 underline"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}

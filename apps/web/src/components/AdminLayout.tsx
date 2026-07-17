import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BrandMark, SidebarCategory, SidebarItem } from "../design-system";
import { useAuthStore } from "../stores/auth";

const navItems = [
  { to: "/admin", label: "📊 Tableau de bord", end: true },
  { to: "/admin/utilisateurs", label: "👤 Comptes" },
  { to: "/admin/structure", label: "🏫 Classes & filières" },
  { to: "/admin/cours", label: "📄 Cours" },
  { to: "/admin/epreuves", label: "📝 Épreuves & corrigés" },
  { to: "/admin/evaluations", label: "🗒️ Évaluations" },
  { to: "/admin/copies", label: "🖊️ Correction des copies" },
  { to: "/admin/validation", label: "✅ File de validation IA" },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen bg-bg flex">
      <aside className="w-[230px] shrink-0 bg-primary-deep text-white p-[22px_16px] flex flex-col">
        <div className="flex items-center gap-2 mb-6">
          <BrandMark size="sm" />
          <span className="font-display font-extrabold text-lg">Kalyaro</span>
        </div>
        <SidebarCategory>Administration</SidebarCategory>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {({ isActive }) => <SidebarItem active={isActive}>{item.label}</SidebarItem>}
          </NavLink>
        ))}
        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="text-xs text-white/60 mb-2 truncate">{user?.nom}</div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/connexion");
            }}
            className="text-xs font-mono text-white/70 underline"
          >
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="flex-1 p-7 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}

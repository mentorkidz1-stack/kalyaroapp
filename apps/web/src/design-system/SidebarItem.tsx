import type { ReactNode } from "react";

export function SidebarCategory({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] tracking-widest uppercase text-white/45 mt-[18px] mb-2 ml-[14px]">
      {children}
    </div>
  );
}

/** Contenu visuel d'un item de sidebar — sans balise interactive propre, pour pouvoir
 * être placé à l'intérieur d'un `NavLink`/`<a>`/`<button>` sans imbrication invalide. */
export function SidebarItem({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <div
      className={`block px-[14px] py-[11px] rounded-xl text-[13px] font-bold font-sans mb-1 transition-colors ${
        active ? "bg-white/[.14] text-white" : "text-white/70 hover:text-white"
      }`}
    >
      {children}
    </div>
  );
}

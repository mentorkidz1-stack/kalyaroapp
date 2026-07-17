import type { ReactNode } from "react";

type BadgeVariant = "ai" | "manual" | "ok" | "warn";

const variantClasses: Record<BadgeVariant, string> = {
  ai: "bg-primary-tint text-primary-deep",
  manual: "bg-accent-tint text-[#8A5A0E]",
  ok: "bg-primary-tint text-primary-deep",
  warn: "bg-alert-tint text-alert",
};

export function Badge({ variant, children }: { variant: BadgeVariant; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-[9px] py-1 rounded-full ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}

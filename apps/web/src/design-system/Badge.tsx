import type { ReactNode } from "react";

export type BadgeVariant =
  | "ai"
  | "manual"
  | "ok"
  | "warn"
  // Niveaux de maîtrise d'une notion, du plus fragile au plus durable.
  | "neutral"
  | "fragile"
  | "acquis"
  | "consolide"
  | "durable";

const variantClasses: Record<BadgeVariant, string> = {
  ai: "bg-primary-tint text-primary-deep",
  manual: "bg-accent-tint text-[#8A5A0E]",
  ok: "bg-primary-tint text-primary-deep",
  warn: "bg-alert-tint text-alert",
  neutral: "bg-line text-ink-soft",
  fragile: "bg-accent-tint text-[#8A5A0E]",
  acquis: "bg-primary-tint text-primary-deep",
  consolide: "bg-primary text-white",
  durable: "bg-primary-deep text-white",
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

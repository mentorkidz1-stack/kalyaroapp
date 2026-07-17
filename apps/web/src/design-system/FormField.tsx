import type { ReactNode } from "react";

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">{label}</span>
      {children}
    </label>
  );
}

export const fieldInputClass =
  "w-full px-3 py-2 rounded-[10px] border-2 border-line font-sans text-sm focus:outline-none focus:border-primary";

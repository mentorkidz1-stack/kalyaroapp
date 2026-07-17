import type { ReactNode } from "react";

type FeedbackVariant = "ok" | "warn";

const variantClasses: Record<FeedbackVariant, string> = {
  ok: "bg-primary-tint text-primary-deep",
  warn: "bg-alert-tint text-[#8f3323]",
};

export function FeedbackBlock({ variant, children }: { variant: FeedbackVariant; children: ReactNode }) {
  return (
    <div className={`mt-[14px] px-4 py-[14px] rounded-[14px] text-[13px] font-semibold leading-relaxed ${variantClasses[variant]}`}>
      {children}
    </div>
  );
}

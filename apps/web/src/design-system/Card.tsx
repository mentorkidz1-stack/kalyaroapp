import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-surface border border-line rounded p-4 ${className}`} {...props} />;
}

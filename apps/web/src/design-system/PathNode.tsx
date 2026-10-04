import type { ReactNode } from "react";

/** current : à travailler · acquired : acquis du jour · done : consolidé · durable : durable. */
export type NodeState = "durable" | "done" | "acquired" | "current" | "locked";

interface PathNodeProps {
  state: NodeState;
  label: string;
  sub: ReactNode;
  side: "left" | "right";
  onClick?: () => void;
}

const bubbleClasses: Record<NodeState, string> = {
  durable: "bg-primary-deep text-white",
  done: "bg-primary text-white",
  acquired: "bg-primary-tint text-primary-deep",
  current: "bg-accent text-primary-deep bubble-pulse",
  locked: "bg-[#EDEFE8] text-[#A9B0A2]",
};

const bubbleContent: Record<NodeState, string> = {
  durable: "★",
  done: "✓",
  acquired: "✓",
  current: "▶",
  locked: "🔒",
};

export function PathNode({ state, label, sub, side, onClick }: PathNodeProps) {
  const flexDir = side === "left" ? "flex-row" : "flex-row-reverse text-right";
  return (
    <button
      type="button"
      disabled={state === "locked"}
      onClick={onClick}
      className={`flex items-center gap-3 w-full ${flexDir} ${state === "locked" ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`w-14 h-14 rounded-full flex-none flex items-center justify-center font-display font-extrabold text-[15px] border-[3px] border-surface shadow-[0_4px_0_rgba(0,0,0,0.08)] ${bubbleClasses[state]}`}
      >
        {bubbleContent[state]}
      </span>
      <span>
        <div className="text-[13px] font-bold text-ink">{label}</div>
        <div className="text-[11px] font-mono text-ink-soft mt-0.5">{sub}</div>
      </span>
    </button>
  );
}

export function Thread() {
  return (
    <div
      className="w-[2px] h-[26px] mx-auto"
      style={{ backgroundImage: "repeating-linear-gradient(var(--line) 0 4px, transparent 4px 8px)" }}
    />
  );
}

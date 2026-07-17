export function StreakPill({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-[6px] bg-white/[.14] px-[10px] py-[5px] rounded-full font-mono text-xs font-semibold text-white">
      🔥 {count}
    </span>
  );
}

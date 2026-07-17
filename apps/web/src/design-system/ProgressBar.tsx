export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-2 bg-white/[.22] rounded-lg mt-[14px] overflow-hidden">
      <div className="h-full bg-accent rounded-lg transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
}

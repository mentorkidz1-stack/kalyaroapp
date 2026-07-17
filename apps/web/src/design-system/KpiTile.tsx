export function KpiTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-bg border border-line rounded-2xl px-4 py-[14px]">
      <div className="font-display font-extrabold text-2xl text-ink">{value}</div>
      <div className="text-[11px] font-mono text-ink-soft uppercase tracking-wide">{label}</div>
    </div>
  );
}

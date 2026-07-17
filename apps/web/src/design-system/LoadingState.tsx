export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" role="status" aria-label={label ?? "Chargement"}>
      <div className="w-9 h-9 rounded-full border-[3px] border-line border-t-primary animate-spin" />
      {label && <p className="font-mono text-[11px] text-ink-soft uppercase tracking-wide">{label}</p>}
    </div>
  );
}

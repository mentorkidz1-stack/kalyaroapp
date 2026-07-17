export function Spinner() {
  return (
    <div className="flex items-center justify-center py-10" role="status" aria-label="Chargement">
      <div className="w-8 h-8 rounded-full border-[3px] border-line border-t-primary animate-spin" />
    </div>
  );
}

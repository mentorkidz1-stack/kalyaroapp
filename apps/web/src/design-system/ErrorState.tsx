import { Button } from "./Button";

export function ErrorState({
  message = "Une erreur est survenue. Réessaie dans un instant.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="text-center py-8 px-4 rounded bg-alert-tint">
      <div className="text-2xl mb-2">⚠️</div>
      <p className="text-sm font-semibold text-[#8f3323]">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="ghost" onClick={onRetry}>
            Réessayer
          </Button>
        </div>
      )}
    </div>
  );
}

import type { ReactNode } from "react";
import { Card } from "./Card";
import { Button } from "./Button";

export function EmptyState({
  icon = "📭",
  title,
  message,
  action,
}: {
  icon?: string;
  title?: string;
  message: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <Card className="text-center py-8">
      <div className="text-3xl mb-3">{icon}</div>
      {title && <p className="font-display font-bold text-base text-ink mb-1">{title}</p>}
      <p className="text-sm text-ink-soft">{message}</p>
      {action && (
        <div className="mt-4">
          <Button variant="ghost" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </Card>
  );
}

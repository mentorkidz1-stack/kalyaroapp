import type { CSSProperties, ReactNode } from "react";
import { Card } from "./Card";

type ConfettiStyle = CSSProperties & Record<"--tx" | "--ty" | "--rot", string>;

const CONFETTI_COLORS = ["#1B7A5C", "#F2A93B", "#0E4E3B"];
const CONFETTI_COUNT = 10;

export function MasteryCelebration({
  title,
  message,
  children,
}: {
  title: string;
  message: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden text-center py-8 pop-in shadow-lift">
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
          const angle = (i / CONFETTI_COUNT) * 2 * Math.PI;
          const dist = 70 + (i % 3) * 20;
          const style: ConfettiStyle = {
            "--tx": `${Math.cos(angle) * dist}px`,
            "--ty": `${Math.sin(angle) * dist - 20}px`,
            "--rot": `${(i * 47) % 360}deg`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${i * 20}ms`,
          };
          return <span key={i} className="confetti-piece" style={style} />;
        })}
      </div>
      <div className="text-5xl mb-4">🎉</div>
      <p className="font-display font-bold text-lg text-ink mb-2">{title}</p>
      <p className="text-sm text-ink-soft mb-6">{message}</p>
      {children}
    </Card>
  );
}

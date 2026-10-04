import { prisma } from "../db/prisma.js";
import { beninDayKey } from "./benin-day.js";

export { beninDayKey };

function daysBetweenBeninDayKeys(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / msPerDay);
}

export function computeNextStreakCount(lastActivityAt: Date | null, streakCount: number, now: Date): number {
  if (!lastActivityAt) return 1;
  const diff = daysBetweenBeninDayKeys(beninDayKey(lastActivityAt), beninDayKey(now));
  if (diff <= 0) return streakCount;
  if (diff === 1) return streakCount + 1;
  return 1;
}

export function projectCurrentStreak(streakCount: number, lastActivityAt: Date | null, now: Date): number {
  if (!lastActivityAt) return 0;
  const diff = daysBetweenBeninDayKeys(beninDayKey(lastActivityAt), beninDayKey(now));
  if (diff <= 1) return streakCount;
  return 0;
}

export async function recordDailyActivity(eleveId: string, now = new Date()): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: eleveId },
    select: { streakCount: true, lastActivityAt: true },
  });
  const streakCount = computeNextStreakCount(user.lastActivityAt, user.streakCount, now);
  await prisma.user.update({
    where: { id: eleveId },
    data: { streakCount, lastActivityAt: now },
  });
}

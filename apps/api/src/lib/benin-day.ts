// Le Bénin est en UTC+1 toute l'année (pas d'heure d'été) : un décalage fixe suffit.
const BENIN_OFFSET_MS = 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Jour calendaire béninois ("AAAA-MM-JJ") de l'instant donné. */
export function beninDayKey(date: Date): string {
  return new Date(date.getTime() + BENIN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Minuit (heure du Bénin) du jour situé `days` jours après celui de `date`. */
export function startOfBeninDay(date: Date, days = 0): Date {
  return new Date(Date.parse(`${beninDayKey(date)}T00:00:00Z`) + days * MS_PER_DAY - BENIN_OFFSET_MS);
}

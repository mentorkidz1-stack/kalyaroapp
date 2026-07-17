import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

export interface StreakData {
  streakCount: number;
}

export function useStreak() {
  return useQuery({
    queryKey: ["streak"],
    queryFn: () => api.get<StreakData>("/api/eleve/streak"),
  });
}

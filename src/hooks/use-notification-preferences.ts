"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationPreferencesRepo } from "@/lib/repos/notification-preferences-repo";

export function notificationPreferencesKey(householdId: string, profileId: string) {
  return ["notification-preferences", householdId, profileId] as const;
}

export function useNotificationPreferences(householdId: string | undefined, profileId: string | undefined) {
  return useQuery({
    queryKey: notificationPreferencesKey(householdId ?? "", profileId ?? ""),
    queryFn: () => notificationPreferencesRepo.get(householdId!, profileId!),
    enabled: !!householdId && !!profileId,
  });
}

export function useInvalidateNotificationPreferences(householdId: string | undefined, profileId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && profileId && queryClient.invalidateQueries({ queryKey: notificationPreferencesKey(householdId, profileId) });
}

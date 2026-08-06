"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { profileNotificationPreferencesRepo } from "@/lib/repos/profile-notification-preferences-repo";

export function profileNotificationPreferencesKey(profileId: string) {
  return ["profile-notification-preferences", profileId] as const;
}

export function useProfileNotificationPreferences(profileId: string | undefined) {
  return useQuery({
    queryKey: profileNotificationPreferencesKey(profileId ?? ""),
    queryFn: () => profileNotificationPreferencesRepo.get(profileId!),
    enabled: !!profileId,
  });
}

export function useInvalidateProfileNotificationPreferences(profileId: string | undefined) {
  const queryClient = useQueryClient();
  return () => profileId && queryClient.invalidateQueries({ queryKey: profileNotificationPreferencesKey(profileId), refetchType: "all" });
}

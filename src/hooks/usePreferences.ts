import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/lib/commands";

const PREFS_KEY = ["preferences"];

export function usePreferences() {
  return useQuery({
    queryKey: PREFS_KEY,
    queryFn: async () => Object.fromEntries(await commands.listPreferences()) as Record<string, string>,
  });
}

export function useSetPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => commands.setPreference(key, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}

export function useBackupNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => commands.backupNow(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PREFS_KEY }), // refreshes last_backup_at
  });
}

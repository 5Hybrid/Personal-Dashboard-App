import { useMutation, useQuery } from "@tanstack/react-query";
import { commands } from "@/lib/commands";

export function useObsidianSearch(query: string) {
  return useQuery({
    queryKey: ["search", "obsidian", query],
    queryFn: () => commands.searchObsidianVault(query),
    enabled: query.trim().length > 0,
  });
}

export function useObsidianNote(relativePath: string | null) {
  return useQuery({
    queryKey: ["obsidian-note", relativePath],
    queryFn: () => commands.readObsidianNote(relativePath as string),
    enabled: !!relativePath,
  });
}

export function useTestObsidianVault() {
  return useMutation({
    mutationFn: (path: string) => commands.testObsidianVault(path),
  });
}

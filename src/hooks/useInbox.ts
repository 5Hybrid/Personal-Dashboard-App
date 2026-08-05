import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/lib/commands";
import type { InboxItemInput } from "@/types";

const INBOX_KEY = ["inbox"];

export function useInboxItems() {
  return useQuery({ queryKey: INBOX_KEY, queryFn: commands.listInboxItems });
}

export function useCreateInboxItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InboxItemInput) => commands.createInboxItem(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INBOX_KEY }),
  });
}

export function useDeleteInboxItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commands.deleteInboxItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INBOX_KEY }),
  });
}

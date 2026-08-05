import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/lib/commands";
import type { PersonalRecord, PersonalRecordInput } from "@/types";

const PR_KEY = ["personal-records"];

export function usePersonalRecords() {
  return useQuery({ queryKey: PR_KEY, queryFn: commands.listPersonalRecords });
}

export function useCreatePersonalRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PersonalRecordInput) => commands.createPersonalRecord(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PR_KEY }),
  });
}

export function useUpdatePersonalRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (record: PersonalRecord) => commands.updatePersonalRecord(record),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PR_KEY }),
  });
}

export function useDeletePersonalRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commands.deletePersonalRecord(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PR_KEY }),
  });
}

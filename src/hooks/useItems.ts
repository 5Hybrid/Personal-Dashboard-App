import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/lib/commands";
import type { Item, ItemInput } from "@/types";

const ITEMS_KEY = ["items"];

export function useItems() {
  return useQuery({ queryKey: ITEMS_KEY, queryFn: commands.listItems });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ItemInput) => commands.createItem(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: Item) => commands.updateItem(item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
}

export function useSoftDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commands.softDeleteItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
}

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export const adminKeys = {
  all: ["admin"] as const,
  users: (params?: {
    page?: number;
    per_page?: number;
    sort?: string;
    order?: string;
    search?: string;
    disabled?: boolean;
  }) => ["admin", "users", params] as const,
  base: ["admin", "users"] as const,
};

export function userListOptions(params?: {
  page?: number;
  per_page?: number;
  sort?: string;
  order?: string;
  search?: string;
  disabled?: boolean;
}) {
  return queryOptions({
    queryKey: adminKeys.users(params),
    queryFn: () => api.listUsers(params),
  });
}

export function useUpdateUserName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateUserName(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.base }),
  });
}

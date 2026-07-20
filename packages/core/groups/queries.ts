import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const groupKeys = {
  all: (wsId: string) => ["groups", wsId] as const,
  lists: (wsId: string) => ["groups", wsId, "list"] as const,
  detail: (wsId: string, id: string) => ["groups", wsId, "detail", id] as const,
  messages: (groupId: string) => ["groups", "messages", groupId] as const,
  tasks: (groupId: string) => ["groups", "tasks", groupId] as const,
};

export function groupsOptions(wsId: string) {
  return queryOptions({
    queryKey: groupKeys.lists(wsId),
    queryFn: () => api.listGroups(),
    staleTime: Infinity,
  });
}

export function groupOptions(wsId: string, id: string) {
  return queryOptions({
    queryKey: groupKeys.detail(wsId, id),
    queryFn: () => api.getGroup(id),
    staleTime: Infinity,
    enabled: !!id,
  });
}

export function groupMessagesOptions(groupId: string, params?: { before?: string; after?: string; limit?: number }) {
  return queryOptions({
    queryKey: [...groupKeys.messages(groupId), params],
    queryFn: () => api.listGroupMessages(groupId, params),
    staleTime: Infinity,
    enabled: !!groupId,
  });
}

export function groupTasksOptions(groupId: string) {
  return queryOptions({
    queryKey: groupKeys.tasks(groupId),
    queryFn: () => api.listGroupTasks(groupId),
    staleTime: Infinity,
    enabled: !!groupId,
  });
}

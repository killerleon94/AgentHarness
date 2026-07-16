import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; announcement?: string }) => api.createGroup(data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; announcement?: string }) =>
      api.updateGroup(id, data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteGroup(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, ...data }: { groupId: string; member_type: "member" | "agent"; member_id: string }) =>
      api.inviteMember(groupId, data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useBatchInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, members }: { groupId: string; members: { member_type: "member" | "agent"; member_id: string }[] }) =>
      api.batchInviteMembers(groupId, { members }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, memberId }: { groupId: string; memberId: string }) =>
      api.removeMember(groupId, memberId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => api.leaveGroup(groupId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

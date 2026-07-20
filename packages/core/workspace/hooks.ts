"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "../hooks";
import { memberListOptions, agentListOptions } from "./queries";

export function useActorName() {
  const wsId = useWorkspaceId();
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: agents = [] } = useQuery(agentListOptions(wsId));

  const findMember = (userId: string) => members.find((m) => m.user_id === userId);

  const getMemberName = (userId: string) => {
    const m = findMember(userId);
    return m?.name ?? "Unknown";
  };

  const isMemberDisabled = (userId: string) => {
    const m = findMember(userId);
    return m?.user_disabled === true;
  };

  const isMemberAdmin = (userId: string) => {
    const m = findMember(userId);
    return m?.user_role === "admin";
  };

  const getAgentName = (agentId: string) => {
    const a = agents.find((a) => a.id === agentId);
    return a?.name ?? "Unknown Agent";
  };

  const getActorName = (type: string, id: string) => {
    if (type === "member") return getMemberName(id);
    if (type === "agent") return getAgentName(id);
    return "System";
  };

  const getActorInitials = (type: string, id: string) => {
    const name = getActorName(type, id);
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getActorAvatarUrl = (type: string, id: string): string | null => {
    if (type === "member") return findMember(id)?.avatar_url ?? null;
    if (type === "agent") return agents.find((a) => a.id === id)?.avatar_url ?? null;
    return null;
  };

  return {
    getMemberName,
    getAgentName,
    getActorName,
    getActorInitials,
    getActorAvatarUrl,
    isMemberDisabled,
    isMemberAdmin,
  };
}

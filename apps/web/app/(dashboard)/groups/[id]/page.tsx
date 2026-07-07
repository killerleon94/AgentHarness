"use client";

import { use } from "react";
import { GroupChat } from "@multica/views/groups/group-chat";
import { useWorkspaceStore } from "@multica/core/workspace";
import { useAuthStore } from "@multica/core/auth";

export default function GroupChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const wsId = useWorkspaceStore((s) => s.workspace?.id);
  const userId = useAuthStore((s) => s.user?.id);

  if (!wsId || !userId) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return <GroupChat groupId={id} wsId={wsId} currentUserId={userId} />;
}

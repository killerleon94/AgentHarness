"use client";

import { GroupList } from "@multica/views/groups/group-list";
import { useWorkspaceStore } from "@multica/core/workspace";

export default function GroupsPage() {
  const wsId = useWorkspaceStore((s) => s.workspace?.id);

  if (!wsId) {
    return <div className="p-6 text-muted-foreground">Loading workspace...</div>;
  }

  return <GroupList wsId={wsId} />;
}

"use client";

import { cn } from "@multica/ui/lib/utils";
import { ActorAvatar as ActorAvatarBase } from "@multica/ui/components/common/actor-avatar";
import { useActorName } from "@multica/core/workspace/hooks";

interface ActorAvatarProps {
  actorType: string;
  actorId: string;
  size?: number;
  className?: string;
}

export function ActorAvatar({ actorType, actorId, size, className }: ActorAvatarProps) {
  const { getActorName, getActorInitials, getActorAvatarUrl, isMemberDisabled } = useActorName();
  const disabled = actorType === "member" && isMemberDisabled(actorId);
  return (
    <ActorAvatarBase
      name={getActorName(actorType, actorId)}
      initials={getActorInitials(actorType, actorId)}
      avatarUrl={getActorAvatarUrl(actorType, actorId)}
      isAgent={actorType === "agent"}
      size={size}
      className={cn(disabled && "opacity-50 grayscale", className)}
    />
  );
}

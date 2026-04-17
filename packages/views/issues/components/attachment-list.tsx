"use client";

import { ChevronDown, Paperclip } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { issueAttachmentsOptions } from "@multica/core/issues/queries";
import { useAuthStore } from "@multica/core/auth";
import { AttachmentCard } from "./attachment-card";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@multica/ui/lib/utils";
import type { Attachment } from "@multica/core/types";

interface AttachmentListProps {
  issueId: string;
  t?: (key: string, fallback: string) => string;
}

export function AttachmentList({ issueId, t = (_, fallback) => fallback }: AttachmentListProps) {
  const user = useAuthStore((s) => s.user);
  const [collapsed, setCollapsed] = useState(false);
  const queryClient = useQueryClient();

  const { data: attachments = [], isLoading } = useQuery(issueAttachmentsOptions(issueId));

  const handleDelete = (id: string) => {
    queryClient.setQueryData(issueAttachmentsOptions(issueId).queryKey, (old: Attachment[] | undefined) => {
      if (!Array.isArray(old)) return old;
      return old.filter((a) => a.id !== id);
    });
  };

  if (isLoading) {
    return (
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              collapsed && "-rotate-90",
            )}
          />
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{t('issueDetail.labels.attachments', 'Attachments')}</span>
        </button>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5">
          <span className="text-[11px] text-muted-foreground tabular-nums font-medium">
            {attachments.length}
          </span>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <AttachmentCard
              key={attachment.id}
              attachment={attachment}
              currentUserId={user?.id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

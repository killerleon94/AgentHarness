"use client";

import { memo } from "react";
import { AppLink } from "../../navigation";
import type { Issue } from "@multica/core/types";
import { ActorAvatar } from "../../common/actor-avatar";
import { useIssueSelectionStore } from "@multica/core/issues/stores/selection-store";
import { PriorityIcon } from "./priority-icon";
import { ProgressRing } from "./progress-ring";
import { PRIORITY_CONFIG } from "@multica/core/issues/config";

export interface ChildProgress {
  done: number;
  total: number;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export const ListRow = memo(function ListRow({
  issue,
  childProgress,
}: {
  issue: Issue;
  childProgress?: ChildProgress;
}) {
  const selected = useIssueSelectionStore((s) => s.selectedIds.has(issue.id));
  const toggle = useIssueSelectionStore((s) => s.toggle);
  const priorityCfg = PRIORITY_CONFIG[issue.priority];

  return (
    <div
      className={`group/row flex items-center h-14 px-4 text-sm transition-all duration-200 hover:bg-muted/30 cursor-pointer ${
        selected ? "bg-primary/5 border-l-2 border-l-primary" : ""
      }`}
    >
      {/* Priority indicator + checkbox */}
      <div className="relative flex items-center justify-center w-6 h-6 mr-3">
        <div className={`absolute left-0 w-[3px] h-full rounded-full ${priorityCfg.dotColor} opacity-0 group-hover/row:opacity-100 transition-opacity`} />
        <PriorityIcon
          priority={issue.priority}
          className={`size-4 text-muted-foreground/40 transition-opacity ${selected ? "opacity-0" : "group-hover/row:opacity-0"}`}
        />
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggle(issue.id)}
          className={`absolute inset-0 cursor-pointer accent-primary size-4 rounded transition-opacity ${
            selected ? "" : "opacity-0 group-hover/row:opacity-100"
          }`}
        />
      </div>

      {/* Main content */}
      <AppLink
        href={`/issues/${issue.id}`}
        className="flex flex-1 items-center gap-4 min-w-0"
      >
        {/* Identifier */}
        <span className="w-20 shrink-0 text-xs font-semibold text-muted-foreground/50 tracking-wide">
          {issue.identifier}
        </span>

        {/* Title + sub-issue progress */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="text-sm font-medium text-foreground truncate">{issue.title}</span>
          {childProgress && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1">
              <ProgressRing done={childProgress.done} total={childProgress.total} size={12} />
              <span className="text-[11px] text-muted-foreground tabular-nums font-semibold">
                {childProgress.done}/{childProgress.total}
              </span>
            </span>
          )}
        </div>

        {/* Due date */}
        {issue.due_date && (
          <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg ${
            new Date(issue.due_date) < new Date()
              ? "bg-rose-100/70 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
              : "bg-muted/60 text-muted-foreground/70"
          }`}>
            {formatDate(issue.due_date)}
          </span>
        )}

        {/* Assignee */}
        {issue.assignee_type && issue.assignee_id && (
          <ActorAvatar
            actorType={issue.assignee_type}
            actorId={issue.assignee_id}
            size={28}
            className="shrink-0 ring-2 ring-background shadow-sm"
          />
        )}
      </AppLink>
    </div>
  );
});

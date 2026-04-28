"use client";

import { memo } from "react";
import { AppLink } from "../../navigation";
import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Issue } from "@multica/core/types";
import { CalendarDays } from "lucide-react";
import { ActorAvatar } from "../../common/actor-avatar";
import { PriorityIcon } from "./priority-icon";
import { PRIORITY_CONFIG } from "@multica/core/issues/config";
import { ProgressRing } from "./progress-ring";
import { useViewStore } from "@multica/core/issues/stores/view-store-context";
import type { ChildProgress } from "./list-row";
import type { IssuePriority } from "@multica/core/types";

type TranslateFn = (key: string, fallback: string) => string;

function getPriorityDictKey(priority: IssuePriority): string {
  const map: Record<string, string> = {
    urgent: "urgent",
    high: "high",
    medium: "medium",
    low: "low",
    none: "none",
  };
  return map[priority] || priority;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export const BoardCardContent = memo(function BoardCardContent({
  issue,
  childProgress,
  t,
}: {
  issue: Issue;
  childProgress?: ChildProgress;
  t?: TranslateFn;
}) {
  const cardProperties = useViewStore((s) => s.cardProperties);
  const priorityCfg = PRIORITY_CONFIG[issue.priority];
  const defaultT = (_key: string, fallback: string) => fallback;
  const translate = t || defaultT;

  const showPriority = cardProperties.priority && issue.priority !== 'none';
  const showDueDate = cardProperties.dueDate && issue.due_date;
  const showAssignee = cardProperties.assignee && issue.assignee_type && issue.assignee_id;

  const hasBottomRow = showPriority || showDueDate || childProgress || showAssignee;

  return (
    <div className="group/card relative rounded-xl bg-background border border-border/40 p-3 shadow-sm hover:shadow-md hover:border-border/60 transition-all cursor-pointer">
      {/* Priority stripe */}
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${priorityCfg.dotColor}`} />
      
      {/* Identifier */}
      <p className="text-[10px] font-semibold text-muted-foreground/40 tracking-wider uppercase mb-1">
        {issue.identifier}
      </p>

      {/* Title */}
      <p className="text-sm font-medium leading-snug text-foreground line-clamp-2 mb-2">
        {issue.title}
      </p>

      {/* Bottom row */}
      {hasBottomRow && (
        <div className="flex items-center gap-2 pt-1.5 border-t border-border/30">
          {showPriority && (
            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${priorityCfg.badgeBg} ${priorityCfg.badgeText}`}>
              <PriorityIcon priority={issue.priority} className="h-3 w-3" inheritColor />
              {translate(`board.issues.${getPriorityDictKey(issue.priority)}`, priorityCfg.label)}
            </span>
          )}
          
          {showDueDate && (
            <span
              className={`flex items-center gap-1 text-[10px] font-medium ml-auto ${
                new Date(issue.due_date!) < new Date()
                  ? "text-rose-500"
                  : "text-muted-foreground"
              }`}
            >
              <CalendarDays className="size-3" />
              {formatDate(issue.due_date!)}
            </span>
          )}

          {childProgress && (
            <div className="flex items-center gap-1 ml-auto">
              <ProgressRing done={childProgress.done} total={childProgress.total} size={10} />
              <span className="text-[10px] text-muted-foreground tabular-nums font-medium">
                {childProgress.done}/{childProgress.total}
              </span>
            </div>
          )}

          {showAssignee && (
            <ActorAvatar
              actorType={issue.assignee_type!}
              actorId={issue.assignee_id!}
              size={20}
              className="ring-1 ring-background shadow-sm"
            />
          )}
        </div>
      )}
    </div>
  );
});

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args;
  if (isSorting || wasDragging) return false;
  return defaultAnimateLayoutChanges(args);
};

export const DraggableBoardCard = memo(function DraggableBoardCard({ issue, childProgress, t }: { issue: Issue; childProgress?: ChildProgress; t?: TranslateFn }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issue.id,
    data: { status: issue.status },
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group/drag transition-all duration-200 ${isDragging ? "opacity-60 scale-105 z-50" : ""}`}
    >
      <AppLink
        href={`/issues/${issue.id}`}
        className={`block ${isDragging ? "pointer-events-none" : ""}`}
      >
        <BoardCardContent issue={issue} childProgress={childProgress} t={t} />
      </AppLink>
    </div>
  );
});

// packages/views/issues/components/board-column.tsx
"use client";

import { useMemo, type ReactNode } from "react";
import { EyeOff, MoreHorizontal, Plus } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Issue, IssueStatus } from "@multica/core/types";
import { Button } from "@multica/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@multica/ui/components/ui/dropdown-menu";
import { STATUS_CONFIG } from "@multica/core/issues/config";
import { useModalStore } from "@multica/core/modals";
import { useViewStoreApi } from "@multica/core/issues/stores/view-store-context";
import { StatusIcon } from "./status-icon";
import { DraggableBoardCard } from "./board-card";
import type { ChildProgress } from "./list-row";

import { fallbackT, type TranslateFn } from "@multica/core";

export function BoardColumn({
  status,
  issueIds,
  issueMap,
  childProgressMap,
  totalCount,
  footer,
  t = fallbackT,
}: {
  status: IssueStatus;
  issueIds: string[];
  issueMap: Map<string, Issue>;
  childProgressMap?: Map<string, ChildProgress>;
  totalCount?: number;
  footer?: ReactNode;
  t?: TranslateFn;
}) {
  const cfg = STATUS_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const viewStoreApi = useViewStoreApi();

  const resolvedIssues = useMemo(
    () =>
      issueIds.flatMap((id) => {
        const issue = issueMap.get(id);
        return issue ? [issue] : [];
      }),
    [issueIds, issueMap],
  );

  const getStatusLabel = () => {
    const keyMap: Record<string, string> = {
      'backlog': 'backlog',
      'todo': 'todo',
      'in_progress': 'inProgress',
      'in_review': 'inReview',
      'done': 'done',
      'blocked': 'blocked',
      'cancelled': 'cancelled',
    };
    
    const dictKey = keyMap[status];
    
    if (dictKey) {
      return t(`board.statuses.${dictKey}`, cfg.label);
    }
    
    return cfg.label;
  };

  return (
    <div className="flex w-[300px] shrink-0 flex-col rounded-xl bg-muted/30 border border-border/40 max-h-full">
      {/* Colored accent header */}
      <div className={`relative rounded-t-xl ${cfg.columnBg} px-3 pt-3 pb-2 flex-none`}>
        <div className={`absolute top-0 left-3 right-3 h-[2px] rounded-full ${cfg.dividerColor}`} />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${cfg.badgeBg} ${cfg.badgeText}`}>
              <StatusIcon status={status} className="h-3.5 w-3.5" inheritColor />
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-semibold ${cfg.badgeText}`}>
                {getStatusLabel()}
              </span>
              <span className="text-[11px] text-muted-foreground/50">
                {totalCount ?? issueIds.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 cursor-pointer"
                    onClick={() => useModalStore.getState().open("create-issue", { status })}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent>{t('board.addIssue', 'Add issue')}</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 cursor-pointer">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-44 p-1">
                <DropdownMenuItem onClick={() => viewStoreApi.getState().hideStatus(status)} className="cursor-pointer rounded-lg px-2.5 py-2 text-sm hover:bg-muted/50">
                  <EyeOff className="size-3.5 mr-2 text-muted-foreground" />
                  {t('board.hideColumn', 'Hide column')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      
      {/* Cards container */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-b-xl px-2 pt-2 pb-2 min-h-[200px] overflow-y-auto overflow-x-hidden ${
          isOver 
            ? `bg-primary/5 border border-primary/20` 
            : ``
        }`}
      >
        <div className="space-y-2">
          <SortableContext items={issueIds} strategy={verticalListSortingStrategy}>
            {resolvedIssues.map((issue) => (
              <DraggableBoardCard key={issue.id} issue={issue} childProgress={childProgressMap?.get(issue.id)} t={t} />
            ))}
          </SortableContext>
          {issueIds.length === 0 && (
            <div className="py-8 text-center">
              <div className="text-xs text-muted-foreground/40">{t('board.noIssues', 'No issues')}</div>
            </div>
          )}
          {footer}
        </div>
      </div>
    </div>
  );
}

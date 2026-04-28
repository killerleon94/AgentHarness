"use client";

import { useMemo } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Accordion } from "@base-ui/react/accordion";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import { Button } from "@multica/ui/components/ui/button";
import type { Issue, IssueStatus } from "@multica/core/types";
import { useLoadMoreDoneIssues } from "@multica/core/issues/mutations";
import type { MyIssuesFilter } from "@multica/core/issues/queries";
import { STATUS_CONFIG } from "@multica/core/issues/config";
import { useModalStore } from "@multica/core/modals";
import { useViewStore } from "@multica/core/issues/stores/view-store-context";
import { useIssueSelectionStore } from "@multica/core/issues/stores/selection-store";
import { sortIssues } from "../utils/sort";
import { StatusIcon } from "./status-icon";
import { ListRow, type ChildProgress } from "./list-row";
import { InfiniteScrollSentinel } from "./infinite-scroll-sentinel";

const EMPTY_PROGRESS_MAP = new Map<string, ChildProgress>();

type TranslateFn = (key: string, fallback: string) => string;

const getStatusDictKey = (status: IssueStatus): string => {
  const map: Record<string, string> = {
    'backlog': 'backlog',
    'todo': 'todo',
    'in_progress': 'inProgress',
    'in_review': 'inReview',
    'done': 'done',
    'blocked': 'blocked',
    'cancelled': 'cancelled',
  };
  return map[status] || status;
};

export function ListView({
  issues,
  visibleStatuses,
  childProgressMap = EMPTY_PROGRESS_MAP,
  doneTotal: doneTotalOverride,
  myIssuesScope,
  myIssuesFilter,
  t = (_, fallback) => fallback,
}: {
  issues: Issue[];
  visibleStatuses: IssueStatus[];
  childProgressMap?: Map<string, ChildProgress>;
  doneTotal?: number;
  myIssuesScope?: string;
  myIssuesFilter?: MyIssuesFilter;
  t?: TranslateFn;
}) {
  const sortBy = useViewStore((s) => s.sortBy);
  const sortDirection = useViewStore((s) => s.sortDirection);
  const listCollapsedStatuses = useViewStore(
    (s) => s.listCollapsedStatuses
  );
  const toggleListCollapsed = useViewStore(
    (s) => s.toggleListCollapsed
  );
  const selectedIds = useIssueSelectionStore((s) => s.selectedIds);
  const select = useIssueSelectionStore((s) => s.select);
  const deselect = useIssueSelectionStore((s) => s.deselect);
  const myIssuesOpts = myIssuesScope ? { scope: myIssuesScope, filter: myIssuesFilter ?? {} } : undefined;
  const { loadMore, hasMore, isLoading: loadingMore, doneTotal: hookDoneTotal } =
    useLoadMoreDoneIssues(myIssuesOpts);
  const displayDoneTotal = doneTotalOverride ?? hookDoneTotal;

  const issuesByStatus = useMemo(() => {
    const map = new Map<IssueStatus, Issue[]>();
    for (const status of visibleStatuses) {
      const filtered = issues.filter((i) => i.status === status);
      map.set(status, sortIssues(filtered, sortBy, sortDirection));
    }
    return map;
  }, [issues, visibleStatuses, sortBy, sortDirection]);

  const expandedStatuses = useMemo(
    () =>
      visibleStatuses.filter(
        (s) => !listCollapsedStatuses.includes(s)
      ),
    [visibleStatuses, listCollapsedStatuses]
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <Accordion.Root
        multiple
        className="divide-y divide-border/40"
        value={expandedStatuses}
        onValueChange={(value: string[]) => {
          for (const status of visibleStatuses) {
            const wasExpanded = expandedStatuses.includes(status);
            const isExpanded = value.includes(status);
            if (wasExpanded !== isExpanded) {
              toggleListCollapsed(status as IssueStatus);
            }
          }
        }}
      >
        {visibleStatuses.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const statusIssues = issuesByStatus.get(status) ?? [];
          const statusIssueIds = statusIssues.map((i) => i.id);
          const selectedCount = statusIssueIds.filter((id) => selectedIds.has(id)).length;
          const allSelected = statusIssues.length > 0 && selectedCount === statusIssues.length;
          const someSelected = selectedCount > 0;

          return (
            <Accordion.Item key={status} value={status}>
              <Accordion.Header className="group/header">
                <div className={`flex items-center h-12 px-4 gap-3 bg-muted/20 hover:bg-muted/30 transition-colors duration-200 ${someSelected ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={() => {
                        if (allSelected) {
                          deselect(statusIssueIds);
                        } else {
                          select(statusIssueIds);
                        }
                      }}
                      className="cursor-pointer accent-primary size-4 rounded"
                    />
                  </div>
                  <Accordion.Trigger className="group/trigger flex flex-1 items-center gap-3 h-full text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg">
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-aria-expanded/trigger:rotate-90" />
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${cfg.badgeBg} ${cfg.badgeText}`}>
                      <StatusIcon status={status} className="h-4 w-4" inheritColor />
                      <span className="text-sm font-bold">{t(`board.statuses.${getStatusDictKey(status)}`, cfg.label)}</span>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground/60">
                      {status === "done" ? displayDoneTotal : statusIssues.length}
                    </span>
                  </Accordion.Trigger>
                  <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-all duration-200"
                            onClick={() =>
                              useModalStore
                                .getState()
                                .open("create-issue", { status })
                            }
                          >
                            <Plus className="size-4" />
                          </Button>
                        }
                      >
                        <TooltipContent>{t('board.addIssue', 'Add issue')}</TooltipContent>
                      </TooltipTrigger>
                    </Tooltip>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Panel>
                <div className="divide-y divide-border/30">
                  {statusIssues.length > 0 ? (
                    <>
                      {statusIssues.map((issue) => (
                        <ListRow key={issue.id} issue={issue} childProgress={childProgressMap.get(issue.id)} />
                      ))}
                      {status === "done" && hasMore && (
                        <InfiniteScrollSentinel onVisible={loadMore} loading={loadingMore} />
                      )}
                    </>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="text-xs text-muted-foreground/40 font-medium">{t('board.noIssues', 'No issues')}</div>
                    </div>
                  )}
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion.Root>
    </div>
  );
}

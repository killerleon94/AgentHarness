// packages/views/issues/components/board-view.tsx
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Eye, MoreHorizontal } from "lucide-react";
import type { Issue, IssueStatus } from "@multica/core/types";
import { Button } from "@multica/ui/components/ui/button";
import { useLoadMoreDoneIssues } from "@multica/core/issues/mutations";
import type { MyIssuesFilter } from "@multica/core/issues/queries";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@multica/ui/components/ui/dropdown-menu";
import { ALL_STATUSES, STATUS_CONFIG } from "@multica/core/issues/config";
import {
  useViewStoreApi,
  useViewStore,
} from "@multica/core/issues/stores/view-store-context";
import type {
  SortField,
  SortDirection,
} from "@multica/core/issues/stores/view-store";
import { sortIssues } from "../utils/sort";
import { StatusIcon } from "./status-icon";
import { BoardColumn } from "./board-column";
import { BoardCardContent } from "./board-card";
import { InfiniteScrollSentinel } from "./infinite-scroll-sentinel";
import type { ChildProgress } from "./list-row";

// 定义翻译函数类型
type TranslateFn = (key: string, fallback: string) => string;

const COLUMN_IDS = new Set<string>(ALL_STATUSES);

const kanbanCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) {
    // Prefer card collisions over column collisions so that
    // dragging down within a column finds the target card
    // instead of the column droppable.
    const cards = pointer.filter((c) => !COLUMN_IDS.has(c.id as string));
    if (cards.length > 0) return cards;
  }
  // Fallback: closestCenter finds the nearest card even when
  // the pointer is in a gap between cards (common when dragging down).
  return closestCenter(args);
};

/** Build column ID arrays from TQ issue data, respecting current sort. */
function buildColumns(
  issues: Issue[],
  visibleStatuses: IssueStatus[],
  sortBy: SortField,
  sortDirection: SortDirection,
): Record<IssueStatus, string[]> {
  const cols = {} as Record<IssueStatus, string[]>;
  for (const status of visibleStatuses) {
    const sorted = sortIssues(
      issues.filter((i) => i.status === status),
      sortBy,
      sortDirection,
    );
    cols[status] = sorted.map((i) => i.id);
  }
  return cols;
}

/** Compute a float position for `activeId` based on its neighbors in [ids](file://e:\AgentHarness\packages\views\issues\components\batch-action-toolbar.tsx#L36-L36). */
function computePosition(
  ids: string[],
  activeId: string,
  issueMap: Map<string, Issue>,
): number {
  const idx = ids.indexOf(activeId);
  if (idx === -1) return 0;
  const getPos = (id: string) => issueMap.get(id)?.position ?? 0;
  if (ids.length === 1) return issueMap.get(activeId)?.position ?? 0;
  if (idx === 0) return getPos(ids[1]!) - 1;
  if (idx === ids.length - 1) return getPos(ids[idx - 1]!) + 1;
  return (getPos(ids[idx - 1]!) + getPos(ids[idx + 1]!)) / 2;
}

/** Find which column (status) contains a given ID (issue or column droppable). */
function findColumn(
  columns: Record<IssueStatus, string[]>,
  id: string,
  visibleStatuses: IssueStatus[],
): IssueStatus | null {
  if (visibleStatuses.includes(id as IssueStatus)) return id as IssueStatus;
  for (const [status, ids] of Object.entries(columns)) {
    if (ids.includes(id)) return status as IssueStatus;
  }
  return null;
}

const EMPTY_PROGRESS_MAP = new Map<string, ChildProgress>();

export function BoardView({
  issues,
  allIssues,
  visibleStatuses,
  hiddenStatuses,
  onMoveIssue,
  childProgressMap = EMPTY_PROGRESS_MAP,
  doneTotal: doneTotalOverride,
  myIssuesScope,
  myIssuesFilter,
  t = (_, fallback) => fallback, // 接收翻译函数
}: {
  issues: Issue[];
  allIssues: Issue[];
  visibleStatuses: IssueStatus[];
  hiddenStatuses: IssueStatus[];
  onMoveIssue: (
    issueId: string,
    newStatus: IssueStatus,
    newPosition?: number,
  ) => void;
  childProgressMap?: Map<string, ChildProgress>;
  /** Override the done-column count (e.g. with a server-filtered total). */
  doneTotal?: number;
  /** When set, use the My Issues load-more hook instead of the workspace one. */
  myIssuesScope?: string;
  myIssuesFilter?: MyIssuesFilter;
  t?: TranslateFn;
}) {
  const sortBy = useViewStore((s) => s.sortBy);
  const sortDirection = useViewStore((s) => s.sortDirection);
  const myIssuesOpts = myIssuesScope
    ? { scope: myIssuesScope, filter: myIssuesFilter ?? {} }
    : undefined;
  const {
    loadMore,
    hasMore,
    isLoading: loadingMore,
    doneTotal: hookDoneTotal,
  } = useLoadMoreDoneIssues(myIssuesOpts);
  const displayDoneTotal = doneTotalOverride ?? hookDoneTotal;

  // --- Drag state ---
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const isDraggingRef = useRef(false);

  // --- Local columns state ---
  // Between drags: follows TQ via useEffect.
  // During drag: local-only, driven by onDragOver/onDragEnd.
  const [columns, setColumns] = useState<Record<IssueStatus, string[]>>(() =>
    buildColumns(issues, visibleStatuses, sortBy, sortDirection),
  );
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  // Sync local columns when TQ data or view settings change (and not dragging).
  useEffect(() => {
    if (!isDraggingRef.current) {
      setColumns(buildColumns(issues, visibleStatuses, sortBy, sortDirection));
    }
  }, [issues, visibleStatuses, sortBy, sortDirection]);

  // Keep a fast lookup map for issue data during drag calculations.
  const issueMapRef = useRef(new Map<string, Issue>());
  useEffect(() => {
    const map = new Map<string, Issue>();
    for (const i of issues) map.set(i.id, i);
    issueMapRef.current = map;
  }, [issues]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    isDraggingRef.current = true;
    const issue = issueMapRef.current.get(active.id as string);
    if (issue) setActiveIssue(issue);
  }, []);

  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (!over) return;
      const activeId = active.id as string;
      const overId = over.id as string;

      const prevColumns = columnsRef.current;
      const activeCol = findColumn(prevColumns, activeId, visibleStatuses);
      const overCol = findColumn(prevColumns, overId, visibleStatuses);

      if (!activeCol || !overCol) return;

      // If moving to a different column
      if (activeCol !== overCol) {
        setColumns((prev) => {
          const next = { ...prev };
          const sourceIds = [...(next[activeCol] ?? [])];
          const destIds = [...(next[overCol] ?? [])];

          // Remove from source
          const idx = sourceIds.indexOf(activeId);
          if (idx !== -1) sourceIds.splice(idx, 1);

          // Insert into destination
          const overIdx = destIds.indexOf(overId);
          if (overIdx !== -1) {
            destIds.splice(overIdx, 0, activeId);
          } else {
            destIds.push(activeId);
          }

          next[activeCol] = sourceIds;
          next[overCol] = destIds;
          columnsRef.current = next;
          return next;
        });
      } else {
        // Reordering within the same column
        if (activeId === overId) return;
        setColumns((prev) => {
          const next = { ...prev };
          const ids = [...(next[activeCol] ?? [])];
          const oldIdx = ids.indexOf(activeId);
          const newIdx = ids.indexOf(overId);
          if (oldIdx === -1 || newIdx === -1) return prev;
          const moved = arrayMove(ids, oldIdx, newIdx);
          next[activeCol] = moved;
          columnsRef.current = next;
          return next;
        });
      }
    },
    [visibleStatuses],
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      isDraggingRef.current = false;
      setActiveIssue(null);

      if (!over) {
        // Reset to TQ state if dropped outside
        setColumns(
          buildColumns(issues, visibleStatuses, sortBy, sortDirection),
        );
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;
      const finalColumns = columnsRef.current;

      const activeCol = findColumn(finalColumns, activeId, visibleStatuses);
      const overCol = findColumn(finalColumns, overId, visibleStatuses);

      if (!activeCol || !overCol) return;

      // Calculate new position
      const colIds = finalColumns[overCol] ?? [];
      const newPos = computePosition(colIds, activeId, issueMapRef.current);

      // Trigger mutation
      onMoveIssue(activeId, overCol, newPos);

      // Optimistically update TQ store sort to 'position' if not already
      // This is handled in IssuesPage handleMoveIssue mostly, but good to ensure consistency
    },
    [issues, visibleStatuses, sortBy, sortDirection, onMoveIssue],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollision}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 min-h-0 gap-4 overflow-x-auto p-4">
        {visibleStatuses.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            issueIds={columns[status] ?? []}
            issueMap={issueMapRef.current}
            childProgressMap={childProgressMap}
            totalCount={status === "done" ? displayDoneTotal : undefined}
            t={t} // 传递 t 给 BoardColumn
            footer={
              status === "done" && hasMore ? (
                <InfiniteScrollSentinel
                  onVisible={loadMore}
                  loading={loadingMore}
                />
              ) : undefined
            }
          />
        ))}

        {hiddenStatuses.length > 0 && (
          <HiddenColumnsPanel
            hiddenStatuses={hiddenStatuses}
            issues={allIssues}
            t={t} // 传递 t 给 HiddenColumnsPanel
          />
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeIssue ? (
          <div className="w-[280px] rotate-2 scale-105 cursor-grabbing opacity-90 shadow-lg shadow-black/10">
            <BoardCardContent
              issue={activeIssue}
              childProgress={childProgressMap.get(activeIssue.id)}
              t={t}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function HiddenColumnsPanel({
  hiddenStatuses,
  issues,
  t = (_, fallback) => fallback,
}: {
  hiddenStatuses: IssueStatus[];
  issues: Issue[];
  t?: TranslateFn;
}) {
  const viewStoreApi = useViewStoreApi();
  return (
    <div className="flex w-[240px] shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-sm font-medium text-muted-foreground">
          {t("board.hiddenColumns", "Hidden columns")}
        </span>
      </div>
      <div className="flex-1 space-y-0.5">
        {hiddenStatuses.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const count = issues.filter((i) => i.status === status).length;
          return (
            <div
              key={status}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <StatusIcon status={status} className="h-3.5 w-3.5" />
                {/* 这里也可以考虑国际化状态名，但通常隐藏列只显示英文或简写即可，若需国际化可解开注释 */}
                {/* <span className="text-sm">{t(`board.statuses.${status}`, cfg.label)}</span> */}
                <span className="text-sm">{cfg.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{count}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-muted-foreground"
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => viewStoreApi.getState().showStatus(status)}
                    >
                      <Eye className="size-3.5" />
                      {t("board.showColumn", "Show column")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

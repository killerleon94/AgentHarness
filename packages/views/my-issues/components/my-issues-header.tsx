"use client";

import { useMemo } from "react";
import { useStore } from "zustand";
import {
  ArrowDownUp,
  Check,
  CircleDot,
  Columns3,
  Command,
  Filter,
  List,
  Plus,
  Settings2,
  SignalHigh,
  SortAsc,
  SortDesc,
  X,
} from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@multica/ui/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@multica/ui/components/ui/popover";
import { cn } from "@multica/ui/lib/utils";
import {
  ALL_STATUSES,
  STATUS_CONFIG,
  PRIORITY_ORDER,
  PRIORITY_CONFIG,
} from "@multica/core/issues/config";
import { StatusIcon, PriorityIcon } from "../../issues/components";
import {
  SORT_OPTIONS,
  CARD_PROPERTY_OPTIONS,
} from "@multica/core/issues/stores/view-store";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import type { Issue } from "@multica/core/types";
import { myIssuesViewStore, type MyIssuesScope } from "@multica/core/issues/stores/my-issues-view-store";
import { useModalStore } from "@multica/core/modals";

import { withT, type TranslateFn } from "@multica/core";

interface MyIssuesHeaderProps {
  allIssues: Issue[];
  t?: TranslateFn;
}

// ---------------------------------------------------------------------------
// HoverCheck
// ---------------------------------------------------------------------------

const FILTER_ITEM_CLASS =
  "group/fitem pr-1.5! [&>[data-slot=dropdown-menu-checkbox-item-indicator]]:hidden";

function HoverCheck({ checked }: { checked: boolean }) {
  return (
    <div
      className="border-input data-[selected=true]:border-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground pointer-events-none size-4 shrink-0 rounded-[4px] border transition-all select-none *:[svg]:opacity-0 data-[selected=true]:*:[svg]:opacity-100 opacity-0 group-hover/fitem:opacity-100 group-focus/fitem:opacity-100 data-[selected=true]:opacity-100"
      data-selected={checked}
    >
      <Check className="size-3.5 text-current" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActiveFilterCount(state: {
  statusFilters: string[];
  priorityFilters: string[];
}) {
  let count = 0;
  if (state.statusFilters.length > 0) count++;
  if (state.priorityFilters.length > 0) count++;
  return count;
}

function useIssueCounts(allIssues: Issue[]) {
  return useMemo(() => {
    const status = new Map<string, number>();
    const priority = new Map<string, number>();

    for (const issue of allIssues) {
      status.set(issue.status, (status.get(issue.status) ?? 0) + 1);
      priority.set(issue.priority, (priority.get(issue.priority) ?? 0) + 1);
    }

    return { status, priority };
  }, [allIssues]);
}

// ---------------------------------------------------------------------------
// Scope config
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MyIssuesHeader
// ---------------------------------------------------------------------------

export function MyIssuesHeader({ allIssues, t: tProp }: MyIssuesHeaderProps) {
  const t = withT(tProp);

  const getScopeLabel = (key: string, fallback: string) => t(`myIssues.scopes.${key}.label`, fallback);
  const getScopeDesc = (key: string, fallback: string) => t(`myIssues.scopes.${key}.description`, fallback);

  const SCOPES: { value: MyIssuesScope; label: string; description: string }[] = [
    { value: "assigned", label: getScopeLabel("assigned", "Assigned"), description: getScopeDesc("assigned", "Issues assigned to me") },
    { value: "created", label: getScopeLabel("created", "Created"), description: getScopeDesc("created", "Issues I created") },
    { value: "agents", label: getScopeLabel("agents", "My Agents"), description: getScopeDesc("agents", "Issues assigned to my agents") },
  ];

  const viewMode = useStore(myIssuesViewStore, (s) => s.viewMode);
  const statusFilters = useStore(myIssuesViewStore, (s) => s.statusFilters);
  const priorityFilters = useStore(myIssuesViewStore, (s) => s.priorityFilters);
  const sortBy = useStore(myIssuesViewStore, (s) => s.sortBy);
  const sortDirection = useStore(myIssuesViewStore, (s) => s.sortDirection);
  const cardProperties = useStore(myIssuesViewStore, (s) => s.cardProperties);
  const scope = useStore(myIssuesViewStore, (s) => s.scope);
  const act = myIssuesViewStore.getState();

  const counts = useIssueCounts(allIssues);

  const hasActiveFilters =
    getActiveFilterCount({ statusFilters, priorityFilters }) > 0;

  const sortKeyMap: Record<string, string> = {
    position: "manual",
    priority: "priority",
    due_date: "dueDate",
    created_at: "createdAt",
    title: "title",
    updated_at: "updatedAt",
  };
  const sortLabel = t(`issuesHeader.sortOptions.${sortKeyMap[sortBy] || "manual"}`, SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Manual");

  return (
    <div className="shrink-0 bg-background/80 backdrop-blur-md border-b border-border/60">
      {/* Main toolbar */}
      <div className="flex h-14 items-center justify-between px-4 gap-4">
        {/* Left: Scope tabs - styled as command bar segments */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/40 border border-border/40">
          {SCOPES.map((s) => (
            <Tooltip key={s.value}>
              <TooltipTrigger
                render={
                  <button
                    className={`px-3.5 h-7 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer ${
                      scope === s.value
                        ? "bg-background shadow-sm text-foreground border border-border/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                    onClick={() => act.setScope(s.value)}
                  >
                    {s.label}
                  </button>
                }
              />
              <TooltipContent side="bottom">{s.description}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Center: Quick stats */}
        <div className="hidden lg:flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="font-medium">{counts.status.get('in_progress') ?? 0}</span>
            <span>{t('issuesHeader.stats.inProgress', 'In Progress')}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="font-medium">{counts.status.get('in_review') ?? 0}</span>
            <span>{t('issuesHeader.stats.inReview', 'In Review')}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium">{counts.status.get('done') ?? 0}</span>
            <span>{t('issuesHeader.stats.done', 'Done')}</span>
          </span>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2">
          {/* Create button - prominent */}
          <Button
            size="sm"
            className="h-8 gap-1.5 px-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm cursor-pointer"
            onClick={() => useModalStore.getState().open("create-issue", {})}
          >
            <Plus className="size-4" />
            <span>{t('issuesHeader.newIssue', 'New Issue')}</span>
          </Button>

          {/* Filter with active count */}
          <DropdownMenu>
            <Tooltip>
              <DropdownMenuTrigger
                render={
                  <TooltipTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className={`h-8 w-8 rounded-lg transition-all duration-200 cursor-pointer ${
                          hasActiveFilters
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <Filter className="size-4" />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent side="bottom">{t('issuesHeader.filter', 'Filter')}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-auto p-1.5">
              {/* Status */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer hover:bg-muted/60 transition-colors">
                  <CircleDot className="size-4 text-blue-500" />
                  <span className="flex-1 font-medium">{t('common.status', 'Status')}</span>
                  {statusFilters.length > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      {statusFilters.length}
                    </span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-auto min-w-48 p-1.5">
                  {ALL_STATUSES.map((s) => {
                    const checked = statusFilters.includes(s);
                    const count = counts.status.get(s) ?? 0;
                    const statusKeyMap: Record<string, string> = {
                      backlog: "backlog",
                      todo: "todo",
                      in_progress: "inProgress",
                      in_review: "inReview",
                      done: "done",
                      blocked: "blocked",
                      cancelled: "cancelled",
                    };
                    const dictKey = statusKeyMap[s] || s;
                    const statusLabel = t(`board.statuses.${dictKey}`, STATUS_CONFIG[s].label);

                    return (
                      <DropdownMenuCheckboxItem
                        key={s}
                        checked={checked}
                        onCheckedChange={() => act.toggleStatusFilter(s)}
                        className={FILTER_ITEM_CLASS}
                      >
                        <HoverCheck checked={checked} />
                        <StatusIcon status={s} className="h-4 w-4" />
                        <span className="flex-1">{statusLabel}</span>
                        {count > 0 && (
                          <span className="text-xs text-muted-foreground/60">
                            {count}
                          </span>
                        )}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Priority */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer hover:bg-muted/60 transition-colors">
                  <SignalHigh className="size-4 text-orange-500" />
                  <span className="flex-1 font-medium">{t('common.priority', 'Priority')}</span>
                  {priorityFilters.length > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                      {priorityFilters.length}
                    </span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-auto min-w-44 p-1.5">
                  {PRIORITY_ORDER.map((p) => {
                    const checked = priorityFilters.includes(p);
                    const count = counts.priority.get(p) ?? 0;
                    const priorityKeyMap: Record<string, string> = {
                      urgent: "urgent",
                      high: "high",
                      medium: "medium",
                      low: "low",
                      none: "noPriority",
                    };
                    const dictKey = priorityKeyMap[p] || p;
                    const priorityLabel = t(`board.priorities.${dictKey}`, PRIORITY_CONFIG[p].label);

                    return (
                      <DropdownMenuCheckboxItem
                        key={p}
                        checked={checked}
                        onCheckedChange={() => act.togglePriorityFilter(p)}
                        className={FILTER_ITEM_CLASS}
                      >
                        <HoverCheck checked={checked} />
                        <PriorityIcon priority={p} />
                        <span className="flex-1">{priorityLabel}</span>
                        {count > 0 && (
                          <span className="text-xs text-muted-foreground/60">
                            {count}
                          </span>
                        )}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Reset */}
              {hasActiveFilters && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={act.clearFilters} className="cursor-pointer text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 focus:text-rose-600">
                    <X className="size-4 mr-2" />
                    {t('issuesHeader.resetAllFilters', 'Reset all')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Display settings */}
          <Popover>
            <Tooltip>
              <PopoverTrigger
                render={
                  <TooltipTrigger
                    render={
                      <Button variant="outline" size="icon-sm" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 cursor-pointer">
                        <Settings2 className="size-4" />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent side="bottom">{t('issuesHeader.displaySettings', 'Display settings')}</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-80 p-0 shadow-xl shadow-slate-200/20 dark:shadow-slate-950/40 rounded-xl border-border/60 overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border/50 bg-muted/30">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <ArrowDownUp className="size-3.5" />
                  {t('issuesHeader.ordering', 'Ordering')}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 justify-between h-9 text-sm font-medium rounded-lg"
                        >
                          {sortLabel}
                          <SortDesc className="size-4 text-muted-foreground" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="start" className="w-auto">
                      {SORT_OPTIONS.map((opt) => (
                        <DropdownMenuItem key={opt.value} onClick={() => act.setSortBy(opt.value)} className="cursor-pointer">
                          {t(`issuesHeader.sortOptions.${sortKeyMap[opt.value] || "manual"}`, opt.label)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() =>
                      act.setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                    }
                    title={sortDirection === "asc" ? t('issuesHeader.ascending', 'Ascending') : t('issuesHeader.descending', 'Descending')}
                    className="h-9 w-9 rounded-lg"
                  >
                    {sortDirection === "asc" ? (
                      <SortAsc className="size-4" />
                    ) : (
                      <SortDesc className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="px-4 py-3.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Command className="size-3.5" />
                  {t('issuesHeader.cardProperties', 'Card properties')}
                </div>
                <div className="mt-3 space-y-2.5">
                  {CARD_PROPERTY_OPTIONS.map((opt) => {
                    const propKeyMap: Record<string, string> = {
                      'assignee': 'issuesHeader.cardPropertyOptions.assignee',
                      'priority': 'issuesHeader.cardPropertyOptions.priority',
                      'dueDate': 'issuesHeader.cardPropertyOptions.dueDate',
                      'description': 'issuesHeader.cardPropertyOptions.description',
                    };
                    const labelKey = propKeyMap[opt.key];
                    const label = labelKey ? t(labelKey, opt.label) : opt.label;

                    const handleToggle = (key: string) => {
                      act.toggleCardProperty(key as any);
                    };

                    return (
                      <label
                        key={opt.key}
                        className="flex cursor-pointer items-center justify-between py-1"
                      >
                        <span className="text-sm font-medium">{label}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={cardProperties[opt.key]}
                          onClick={() => handleToggle(opt.key)}
                          className={cn(
                            "relative inline-flex h-[14px] w-[24px] items-center rounded-full transition-colors cursor-pointer",
                            cardProperties[opt.key] ? "bg-primary" : "bg-input"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block size-3 rounded-full bg-background shadow transition-transform",
                              cardProperties[opt.key] ? "translate-x-[calc(100%-2px)]" : "translate-x-0"
                            )}
                          />
                        </button>
                      </label>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/40 border border-border/40">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => act.setViewMode("board")}
                    className={`p-1.5 rounded-md transition-all duration-200 cursor-pointer ${
                      viewMode === "board"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <Columns3 className="size-4" />
                  </button>
                }
              />
              <TooltipContent side="bottom">{t('issuesHeader.boardView', 'Board view')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => act.setViewMode("list")}
                    className={`p-1.5 rounded-md transition-all duration-200 cursor-pointer ${
                      viewMode === "list"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <List className="size-4" />
                  </button>
                }
              />
              <TooltipContent side="bottom">{t('issuesHeader.listView', 'List view')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

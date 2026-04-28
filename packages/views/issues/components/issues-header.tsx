"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  Check,
  CircleDot,
  Command,
  Filter,
  FolderKanban,
  FolderMinus,
  LayoutGrid,
  List,
  Plus,
  Search,
  Settings2,
  SignalHigh,
  SortAsc,
  SortDesc,
  User,
  UserMinus,
  UserPen,
  X,
} from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
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
import { StatusIcon, PriorityIcon } from ".";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { memberListOptions, agentListOptions } from "@multica/core/workspace/queries";
import { projectListOptions } from "@multica/core/projects/queries";
import { ActorAvatar } from "../../common/actor-avatar";
import {
  SORT_OPTIONS,
  CARD_PROPERTY_OPTIONS,
  type ActorFilterValue,
} from "@multica/core/issues/stores/view-store";
import { useViewStore, useViewStoreApi } from "@multica/core/issues/stores/view-store-context";
import {
  useIssuesScopeStore,
  type IssuesScope,
} from "@multica/core/issues/stores/issues-scope-store";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import type { Issue, IssueStatus, IssuePriority } from "@multica/core/types";
import { useModalStore } from "@multica/core/modals";

type TranslateFn = (key: string, fallback: string) => string;

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

function getActiveFilterCount(state: {
  statusFilters: string[];
  priorityFilters: string[];
  assigneeFilters: ActorFilterValue[];
  includeNoAssignee: boolean;
  creatorFilters: ActorFilterValue[];
  projectFilters: string[];
  includeNoProject: boolean;
}) {
  let count = 0;
  if (state.statusFilters.length > 0) count++;
  if (state.priorityFilters.length > 0) count++;
  if (state.assigneeFilters.length > 0 || state.includeNoAssignee) count++;
  if (state.creatorFilters.length > 0) count++;
  if (state.projectFilters.length > 0 || state.includeNoProject) count++;
  return count;
}

function useIssueCounts(allIssues: Issue[]) {
  return useMemo(() => {
    const status = new Map<string, number>();
    const priority = new Map<string, number>();
    const assignee = new Map<string, number>();
    const creator = new Map<string, number>();
    const project = new Map<string, number>();
    let noAssignee = 0;
    let noProject = 0;

    for (const issue of allIssues) {
      status.set(issue.status, (status.get(issue.status) ?? 0) + 1);
      priority.set(issue.priority, (priority.get(issue.priority) ?? 0) + 1);

      if (!issue.assignee_id) {
        noAssignee++;
      } else {
        const aKey = `${issue.assignee_type}:${issue.assignee_id}`;
        assignee.set(aKey, (assignee.get(aKey) ?? 0) + 1);
      }

      const cKey = `${issue.creator_type}:${issue.creator_id}`;
      creator.set(cKey, (creator.get(cKey) ?? 0) + 1);

      if (!issue.project_id) {
        noProject++;
      } else {
        project.set(issue.project_id, (project.get(issue.project_id) ?? 0) + 1);
      }
    }

    return { status, priority, assignee, creator, noAssignee, project, noProject };
  }, [allIssues]);
}

const SCOPES_DEFAULTS = [
  { value: "all" as IssuesScope },
  { value: "members" as IssuesScope },
  { value: "agents" as IssuesScope },
];

function ActorSubContent({
  counts,
  selected,
  onToggle,
  showNoAssignee,
  includeNoAssignee,
  onToggleNoAssignee,
  noAssigneeCount,
  t = (_, fb) => fb,
}: {
  counts: Map<string, number>;
  selected: ActorFilterValue[];
  onToggle: (value: ActorFilterValue) => void;
  showNoAssignee?: boolean;
  includeNoAssignee?: boolean;
  onToggleNoAssignee?: () => void;
  noAssigneeCount?: number;
  t?: TranslateFn;
}) {
  const [search, setSearch] = useState("");
  const wsId = useWorkspaceId();
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const query = search.trim().toLowerCase();
  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(query),
  );
  const filteredAgents = agents.filter((a) =>
    !a.archived_at && a.name.toLowerCase().includes(query),
  );

  const isSelected = (type: "member" | "agent", id: string) =>
    selected.some((f) => f.type === type && f.id === id);

  return (
    <>
      <div className="px-3 py-2.5 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2 px-2.5 h-8 rounded-md bg-background border border-border/50">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.searchPlaceholder', 'Search...')}
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto p-1.5">
        {showNoAssignee &&
          (!query || t('issuesHeader.noAssignee', 'No assignee').toLowerCase().includes(query) || "unassigned".includes(query)) && (
            <DropdownMenuCheckboxItem
              checked={includeNoAssignee ?? false}
              onCheckedChange={() => onToggleNoAssignee?.()}
              className={FILTER_ITEM_CLASS}
            >
              <HoverCheck checked={includeNoAssignee ?? false} />
              <UserMinus className="size-3.5 text-muted-foreground" />
              {t('issuesHeader.noAssignee', 'No assignee')}
              {(noAssigneeCount ?? 0) > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {noAssigneeCount}
                </span>
              )}
            </DropdownMenuCheckboxItem>
          )}

        {filteredMembers.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('common.members', 'Members')}</DropdownMenuLabel>
            {filteredMembers.map((m) => {
              const checked = isSelected("member", m.user_id);
              const count = counts.get(`member:${m.user_id}`) ?? 0;
              return (
                <DropdownMenuCheckboxItem
                  key={m.user_id}
                  checked={checked}
                  onCheckedChange={() =>
                    onToggle({ type: "member", id: m.user_id })
                  }
                  className={FILTER_ITEM_CLASS}
                >
                  <HoverCheck checked={checked} />
                  <ActorAvatar actorType="member" actorId={m.user_id} size={18} />
                  <span className="truncate">{m.name}</span>
                  {count > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {count}
                    </span>
                  )}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuGroup>
        )}

        {filteredAgents.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('common.agents', 'Agents')}</DropdownMenuLabel>
            {filteredAgents.map((a) => {
              const checked = isSelected("agent", a.id);
              const count = counts.get(`agent:${a.id}`) ?? 0;
              return (
                <DropdownMenuCheckboxItem
                  key={a.id}
                  checked={checked}
                  onCheckedChange={() =>
                    onToggle({ type: "agent", id: a.id })
                  }
                  className={FILTER_ITEM_CLASS}
                >
                  <HoverCheck checked={checked} />
                  <ActorAvatar actorType="agent" actorId={a.id} size={18} />
                  <span className="truncate">{a.name}</span>
                  {count > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {count}
                    </span>
                  )}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuGroup>
        )}

        {filteredMembers.length === 0 && filteredAgents.length === 0 && search && (
          <div className="px-2 py-3 text-center text-sm text-muted-foreground">
            {t('issuesHeader.noResults', 'No results')}
          </div>
        )}
      </div>
    </>
  );
}

function ProjectSubContent({
  counts,
  selected,
  onToggle,
  includeNoProject,
  onToggleNoProject,
  noProjectCount,
  t = (_, fb) => fb,
}: {
  counts: Map<string, number>;
  selected: string[];
  onToggle: (projectId: string) => void;
  includeNoProject: boolean;
  onToggleNoProject: () => void;
  noProjectCount: number;
  t?: TranslateFn;
}) {
  const [search, setSearch] = useState("");
  const wsId = useWorkspaceId();
  const { data: projects = [] } = useQuery(projectListOptions(wsId));
  const query = search.trim().toLowerCase();
  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(query),
  );

  return (
    <>
      <div className="px-3 py-2.5 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2 px-2.5 h-8 rounded-md bg-background border border-border/50">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.searchPlaceholder', 'Search...')}
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto p-1.5">
        {(!query || t('issuesHeader.noProject', 'No project').toLowerCase().includes(query) || "unassigned".includes(query)) && (
          <DropdownMenuCheckboxItem
            checked={includeNoProject}
            onCheckedChange={() => onToggleNoProject()}
            className={FILTER_ITEM_CLASS}
          >
            <HoverCheck checked={includeNoProject} />
            <FolderMinus className="size-3.5 text-muted-foreground" />
            {t('issuesHeader.noProject', 'No project')}
            {noProjectCount > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">
                {noProjectCount}
              </span>
            )}
          </DropdownMenuCheckboxItem>
        )}

        {filtered.map((p) => {
          const checked = selected.includes(p.id);
          const count = counts.get(p.id) ?? 0;
          return (
            <DropdownMenuCheckboxItem
              key={p.id}
              checked={checked}
              onCheckedChange={() => onToggle(p.id)}
              className={FILTER_ITEM_CLASS}
            >
              <HoverCheck checked={checked} />
              <span className="size-3.5 flex items-center justify-center shrink-0">
                {p.icon || <FolderKanban className="size-3.5 text-muted-foreground" />}
              </span>
              <span className="truncate">{p.title}</span>
              {count > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {count}
                </span>
              )}
            </DropdownMenuCheckboxItem>
          );
        })}

        {filtered.length === 0 && search && (
          <div className="px-2 py-3 text-center text-sm text-muted-foreground">
            {t('issuesHeader.noResults', 'No results')}
          </div>
        )}
      </div>
    </>
  );
}

export function IssuesHeader({ scopedIssues, t = (_, fb) => fb }: { scopedIssues: Issue[]; t?: TranslateFn }) {
  const scope = useIssuesScopeStore((s) => s.scope);
  const setScope = useIssuesScopeStore((s) => s.setScope);

  const viewMode = useViewStore((s) => s.viewMode);
  const statusFilters = useViewStore((s) => s.statusFilters);
  const priorityFilters = useViewStore((s) => s.priorityFilters);
  const assigneeFilters = useViewStore((s) => s.assigneeFilters);
  const includeNoAssignee = useViewStore((s) => s.includeNoAssignee);
  const creatorFilters = useViewStore((s) => s.creatorFilters);
  const projectFilters = useViewStore((s) => s.projectFilters);
  const includeNoProject = useViewStore((s) => s.includeNoProject);
  const sortBy = useViewStore((s) => s.sortBy);
  const sortDirection = useViewStore((s) => s.sortDirection);
  const cardProperties = useViewStore((s) => s.cardProperties);
  const act = useViewStoreApi().getState();

  const counts = useIssueCounts(scopedIssues);

  const hasActiveFilters =
    getActiveFilterCount({
      statusFilters,
      priorityFilters,
      assigneeFilters,
      includeNoAssignee,
      creatorFilters,
      projectFilters,
      includeNoProject,
    }) > 0;

  const currentSortOption = SORT_OPTIONS.find((o) => o.value === sortBy);
  
  const getSortLabel = (value: string) => {
    const map: Record<string, string> = {
      'position': 'issuesHeader.sortOptions.manual',
      'created_at': 'issuesHeader.sortOptions.createdAt',
      'updated_at': 'issuesHeader.sortOptions.updatedAt',
      'due_date': 'issuesHeader.sortOptions.dueDate',
      'priority': 'issuesHeader.sortOptions.priority',
      'title': 'issuesHeader.sortOptions.title',
    };
    const key = map[value];
    return key ? t(key, value) : value;
  };

  const sortLabel = currentSortOption ? getSortLabel(currentSortOption.value) : t('issuesHeader.sortOptions.manual', 'Manual');

  const getStatusDictKey = (status: IssueStatus) => {
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

  const getPriorityDictKey = (priority: IssuePriority) => {
    const map: Record<string, string> = {
      'urgent': 'urgent',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
      'none': 'noPriority',
    };
    return map[priority] || priority;
  };

  return (
    <div className="shrink-0 bg-background/80 backdrop-blur-md border-b border-border/60">
      {/* Main toolbar */}
      <div className="flex h-14 items-center justify-between px-4 gap-4">
        {/* Left: Scope tabs - styled as command bar segments */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/40 border border-border/40">
          {SCOPES_DEFAULTS.map((s) => {
            const scopeKey = `issuesHeader.scopes.${s.value}`;
            const label = t(`${scopeKey}.label`, s.value);
            const description = t(`${scopeKey}.description`, "");
            
            return (
              <Tooltip key={s.value}>
                <TooltipTrigger
                  render={
                    <button
                      className={`px-3.5 h-7 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer ${
                        scope === s.value
                          ? "bg-background shadow-sm text-foreground border border-border/60"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }`}
                      onClick={() => setScope(s.value)}
                    >
                      {label}
                    </button>
                  }
                />
                {description && <TooltipContent side="bottom">{description}</TooltipContent>}
              </Tooltip>
            );
          })}
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
                    const dictKey = getStatusDictKey(s);
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
                    const dictKey = getPriorityDictKey(p);
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

              {/* Assignee */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer hover:bg-muted/60 transition-colors">
                  <User className="size-4 text-purple-500" />
                  <span className="flex-1 font-medium">{t('common.assignee', 'Assignee')}</span>
                  {(assigneeFilters.length > 0 || includeNoAssignee) && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                      {assigneeFilters.length + (includeNoAssignee ? 1 : 0)}
                    </span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-auto min-w-52 p-0">
                  <ActorSubContent
                    counts={counts.assignee}
                    selected={assigneeFilters}
                    onToggle={act.toggleAssigneeFilter}
                    showNoAssignee
                    includeNoAssignee={includeNoAssignee}
                    onToggleNoAssignee={act.toggleNoAssignee}
                    noAssigneeCount={counts.noAssignee}
                    t={t}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Creator */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer hover:bg-muted/60 transition-colors">
                  <UserPen className="size-4 text-teal-500" />
                  <span className="flex-1 font-medium">{t('common.creator', 'Creator')}</span>
                  {creatorFilters.length > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                      {creatorFilters.length}
                    </span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-auto min-w-52 p-0">
                  <ActorSubContent
                    counts={counts.creator}
                    selected={creatorFilters}
                    onToggle={act.toggleCreatorFilter}
                    t={t}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Project */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer hover:bg-muted/60 transition-colors">
                  <FolderKanban className="size-4 text-amber-500" />
                  <span className="flex-1 font-medium">{t('common.project', 'Project')}</span>
                  {(projectFilters.length > 0 || includeNoProject) && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                      {projectFilters.length + (includeNoProject ? 1 : 0)}
                    </span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-auto min-w-52 p-0">
                  <ProjectSubContent
                    counts={counts.project}
                    selected={projectFilters}
                    onToggle={act.toggleProjectFilter}
                    includeNoProject={includeNoProject}
                    onToggleNoProject={act.toggleNoProject}
                    noProjectCount={counts.noProject}
                    t={t}
                  />
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
                          {getSortLabel(opt.value)}
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
                    <LayoutGrid className="size-4" />
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
